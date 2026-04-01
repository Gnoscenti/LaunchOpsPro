"""Metrics Enforcement agent — the ruthless financial auditor.

Tracks: MRR, Conversion rate (course -> launch -> executiv),
        Deployment time, CAC, LTV.
Rule:   If it doesn't increase revenue or reduce cost -> cut it.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
import json
import sqlite3
import os

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


DB_PATH = os.path.join(os.environ.get("ARTIFACTS_PATH", "./data/artifacts"), "metrics.db")


class MetricsStore:
    """SQLite-backed metrics history for trend analysis."""

    def __init__(self, db_path: str = DB_PATH):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.conn = sqlite3.connect(db_path)
        self._init_tables()

    def _init_tables(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS daily_metrics (
                date TEXT PRIMARY KEY,
                mrr REAL DEFAULT 0,
                active_subs INTEGER DEFAULT 0,
                new_subs INTEGER DEFAULT 0,
                churned_subs INTEGER DEFAULT 0,
                revenue_today REAL DEFAULT 0,
                refunds_today REAL DEFAULT 0,
                course_signups INTEGER DEFAULT 0,
                launch_conversions INTEGER DEFAULT 0,
                executiv_conversions INTEGER DEFAULT 0,
                cac REAL DEFAULT 0,
                ltv REAL DEFAULT 0,
                ad_spend REAL DEFAULT 0,
                visitors INTEGER DEFAULT 0,
                deployment_time_minutes REAL DEFAULT 0,
                recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tool_costs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tool_name TEXT NOT NULL,
                monthly_cost REAL NOT NULL,
                category TEXT DEFAULT 'subscription',
                revenue_attribution REAL DEFAULT 0,
                last_reviewed TEXT,
                status TEXT DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS cut_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                item TEXT NOT NULL,
                reason TEXT NOT NULL,
                monthly_savings REAL DEFAULT 0,
                action_taken TEXT DEFAULT 'recommended'
            );
        """)
        self.conn.commit()

    def record_daily(self, metrics: Dict[str, Any]):
        """Record today's metrics snapshot."""
        today = date.today().isoformat()
        cols = [
            "date", "mrr", "active_subs", "new_subs", "churned_subs",
            "revenue_today", "refunds_today", "course_signups",
            "launch_conversions", "executiv_conversions", "cac", "ltv",
            "ad_spend", "visitors", "deployment_time_minutes",
        ]
        vals = [today] + [metrics.get(c, 0) for c in cols[1:]]
        placeholders = ",".join(["?"] * len(cols))
        col_names = ",".join(cols)

        self.conn.execute(
            f"INSERT OR REPLACE INTO daily_metrics ({col_names}) VALUES ({placeholders})",
            vals,
        )
        self.conn.commit()

    def get_weekly_trend(self) -> List[Dict[str, Any]]:
        """Get the last 7 days of metrics."""
        week_ago = (date.today() - timedelta(days=7)).isoformat()
        cursor = self.conn.execute(
            "SELECT * FROM daily_metrics WHERE date >= ? ORDER BY date",
            (week_ago,),
        )
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]

    def get_tool_costs(self) -> List[Dict[str, Any]]:
        """Get all active tool subscriptions."""
        cursor = self.conn.execute(
            "SELECT * FROM tool_costs WHERE status = 'active'"
        )
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]

    def log_cut(self, item: str, reason: str, savings: float):
        """Log a cut recommendation that was executed."""
        self.conn.execute(
            "INSERT INTO cut_log (date, item, reason, monthly_savings, action_taken) VALUES (?,?,?,?,?)",
            (date.today().isoformat(), item, reason, savings, "executed"),
        )
        self.conn.commit()


class MetricsAgent:
    """Enforces the metrics framework with real data and automated cut rules."""

    name = "metrics_agent"

    def __init__(self, llm_client=None, config=None):
        if llm_client:
            self.client = llm_client
        elif OpenAI:
            api_key = os.environ.get("OPENAI_API_KEY", "")
            base_url = os.environ.get("OPENAI_API_BASE", os.environ.get("OPENAI_BASE_URL", ""))
            kwargs = {"api_key": api_key} if api_key else {}
            if base_url:
                kwargs["base_url"] = base_url
            self.client = OpenAI(**kwargs)
        else:
            self.client = None
        self.model = (config or {}).get("model", os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"))
        self.store = MetricsStore()

    # ------------------------------------------------------------------
    # Conversion Funnel
    # ------------------------------------------------------------------

    def calculate_conversion_funnel(
        self,
        visitors: int,
        course_signups: int,
        launch_conversions: int,
        executiv_conversions: int,
    ) -> Dict[str, Any]:
        """Calculate the course -> launch -> executiv conversion funnel."""
        return {
            "visitor_to_course": round((course_signups / visitors * 100), 2) if visitors > 0 else 0,
            "course_to_launch": round((launch_conversions / course_signups * 100), 2) if course_signups > 0 else 0,
            "launch_to_executiv": round((executiv_conversions / launch_conversions * 100), 2) if launch_conversions > 0 else 0,
            "overall": round((executiv_conversions / visitors * 100), 2) if visitors > 0 else 0,
            "raw": {
                "visitors": visitors,
                "course_signups": course_signups,
                "launch_conversions": launch_conversions,
                "executiv_conversions": executiv_conversions,
            },
        }

    # ------------------------------------------------------------------
    # CAC vs LTV Analysis
    # ------------------------------------------------------------------

    def cac_ltv_analysis(
        self,
        ad_spend_30d: float,
        new_customers_30d: int,
        avg_monthly_revenue_per_customer: float,
        avg_customer_lifetime_months: float,
    ) -> Dict[str, Any]:
        """Calculate CAC, LTV, and the ratio."""
        cac = (ad_spend_30d / new_customers_30d) if new_customers_30d > 0 else 0
        ltv = avg_monthly_revenue_per_customer * avg_customer_lifetime_months
        ratio = (ltv / cac) if cac > 0 else float("inf")

        status = "HEALTHY" if ratio >= 3 else "WARNING" if ratio >= 1 else "CRITICAL"

        return {
            "cac": round(cac, 2),
            "ltv": round(ltv, 2),
            "ltv_to_cac_ratio": round(ratio, 2),
            "status": status,
            "recommendation": (
                "Healthy unit economics. Scale spend."
                if status == "HEALTHY"
                else "Marginal. Optimize funnel before scaling."
                if status == "WARNING"
                else "STOP SPENDING. CAC exceeds LTV. Fix funnel or cut channel."
            ),
        }

    # ------------------------------------------------------------------
    # Automated Cut Evaluation
    # ------------------------------------------------------------------

    def evaluate_and_cut(
        self, financial_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Evaluate all tools and campaigns. Cut anything that doesn't pay for itself."""

        tool_costs = self.store.get_tool_costs()
        weekly_trend = self.store.get_weekly_trend()

        system_msg = """You are a ruthless financial auditor for a solo founder startup.
CORE RULE: If a tool, subscription, or campaign does not demonstrably increase revenue or reduce cost, it MUST be cut. No exceptions. No "nice to have."

Analyze the data and output a JSON object:
  mrr_status: object with "current", "trend" ("up"/"down"/"flat"), "delta_percent"
  cac_ltv_verdict: string — "HEALTHY", "WARNING", or "CRITICAL"
  tools_to_cut: list of objects with "name", "monthly_cost", "reason"
  tools_to_keep: list of objects with "name", "monthly_cost", "justification"
  campaigns_to_cut: list of objects with "name", "spend", "reason"
  total_monthly_savings: number
  enforcement_actions: list of strings — specific things to do THIS WEEK
"""

        user_msg = f"""Tool costs: {json.dumps(tool_costs)}
Weekly metrics trend: {json.dumps(weekly_trend)}
Additional financial data: {json.dumps(financial_data or {})}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.2,
            max_tokens=2048,
        )

        return {
            "type": "cut_evaluation",
            "date": date.today().isoformat(),
            "response": response.choices[0].message.content,
        }

    # ------------------------------------------------------------------
    # Legacy compatibility
    # ------------------------------------------------------------------

    def evaluate_tools_and_campaigns(self, financial_data: Dict[str, Any]) -> Dict[str, Any]:
        """Legacy method — wraps evaluate_and_cut for backward compatibility."""
        return self.evaluate_and_cut(financial_data)

    # ------------------------------------------------------------------
    # Weekly Metrics Snapshot
    # ------------------------------------------------------------------

    def weekly_snapshot(self) -> Dict[str, Any]:
        """Produce a complete weekly metrics snapshot."""
        trend = self.store.get_weekly_trend()
        tools = self.store.get_tool_costs()

        if trend:
            latest = trend[-1]
            earliest = trend[0]
            mrr_delta = latest.get("mrr", 0) - earliest.get("mrr", 0)
        else:
            latest = {}
            mrr_delta = 0

        total_tool_cost = sum(t.get("monthly_cost", 0) for t in tools)

        return {
            "type": "weekly_snapshot",
            "date": date.today().isoformat(),
            "mrr": latest.get("mrr", 0),
            "mrr_delta_7d": mrr_delta,
            "active_subs": latest.get("active_subs", 0),
            "total_tool_cost_monthly": total_tool_cost,
            "funnel": {
                "visitors_7d": sum(d.get("visitors", 0) for d in trend),
                "course_signups_7d": sum(d.get("course_signups", 0) for d in trend),
                "launch_conversions_7d": sum(d.get("launch_conversions", 0) for d in trend),
                "executiv_conversions_7d": sum(d.get("executiv_conversions", 0) for d in trend),
            },
            "days_tracked": len(trend),
        }
