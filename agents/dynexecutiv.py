"""DynExecutiv agent — Decision and coordination engine.

Pulls live data from Stripe, SuiteCRM, and Matomo to produce:
  - Daily "What Matters Now" agenda
  - Weekly Executive Brief (JSON, Markdown, or HTML)
  - Revenue-first prioritization with risk flags
  - Task orchestration directives
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, date, timedelta
import json
import os
import requests

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


def _get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY", "")
    base_url = os.environ.get("OPENAI_API_BASE", os.environ.get("OPENAI_BASE_URL", ""))
    kwargs = {"api_key": api_key} if api_key else {}
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs) if OpenAI else None


class DynExecutivAgent:
    """Decision engine that synthesizes CRM, revenue, and content data
    into actionable daily and weekly directives."""

    name = "dynexecutiv"

    def __init__(self, llm_client=None, config=None):
        self.client = llm_client or _get_openai_client()
        self.model = (config or {}).get("model", os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"))

    # ==================================================================
    # DATA CONNECTORS
    # ==================================================================

    def pull_stripe_data(self) -> Dict[str, Any]:
        """Pull live revenue data from Stripe."""
        try:
            import stripe
            stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
            if not stripe.api_key:
                return {"error": "Stripe key not configured", "mrr": 0}

            # Current MRR from active subscriptions
            subs = stripe.Subscription.list(status="active", limit=100)
            mrr = sum(
                s.items.data[0].price.unit_amount / 100 for s in subs.data
                if s.items.data
            )

            # Recent charges (last 7 days)
            week_ago = int((datetime.now() - timedelta(days=7)).timestamp())
            charges = stripe.Charge.list(created={"gte": week_ago}, limit=100)
            weekly_revenue = sum(c.amount / 100 for c in charges.data if c.paid)

            # Recent refunds
            refunds = stripe.Refund.list(created={"gte": week_ago}, limit=100)
            weekly_refunds = sum(r.amount / 100 for r in refunds.data)

            return {
                "mrr": mrr,
                "active_subscriptions": len(subs.data),
                "weekly_revenue": weekly_revenue,
                "weekly_refunds": weekly_refunds,
                "net_weekly": weekly_revenue - weekly_refunds,
            }
        except Exception as e:
            return {"error": str(e), "mrr": 0}

    def pull_crm_data(
        self, crm_url: str = "http://localhost:8081", api_token: str = ""
    ) -> Dict[str, Any]:
        """Pull pipeline data from SuiteCRM v8 REST API."""
        try:
            headers = {
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            }
            # Get open opportunities
            resp = requests.get(
                f"{crm_url}/api/v8/modules/Opportunities",
                headers=headers,
                params={"filter[sales_stage][ne]": "Closed Won", "page[size]": 50},
                timeout=10,
            )
            if resp.status_code != 200:
                return {"error": f"CRM returned {resp.status_code}", "deals": []}

            data = resp.json().get("data", [])
            deals = []
            for d in data:
                attrs = d.get("attributes", {})
                deals.append({
                    "name": attrs.get("name", "Unknown"),
                    "amount": float(attrs.get("amount", 0)),
                    "stage": attrs.get("sales_stage", "Unknown"),
                    "close_date": attrs.get("date_closed", ""),
                })

            total_pipeline = sum(d["amount"] for d in deals)
            stalled = [d for d in deals if d["stage"] in ("Needs Analysis", "Prospecting")]

            return {
                "total_pipeline_value": total_pipeline,
                "open_deals": len(deals),
                "stalled_deals": len(stalled),
                "deals": deals[:20],
            }
        except Exception as e:
            return {"error": str(e), "deals": []}

    def pull_content_metrics(
        self, matomo_url: str = "http://localhost:8083", site_id: int = 1, token: str = ""
    ) -> Dict[str, Any]:
        """Pull content performance from Matomo."""
        try:
            params = {
                "module": "API",
                "method": "VisitsSummary.get",
                "idSite": site_id,
                "period": "week",
                "date": "today",
                "format": "JSON",
                "token_auth": token,
            }
            resp = requests.get(matomo_url, params=params, timeout=10)
            if resp.status_code != 200:
                return {"error": f"Matomo returned {resp.status_code}"}
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    # ==================================================================
    # DECISION ENGINE
    # ==================================================================

    def generate_daily_agenda(
        self,
        crm_data: Optional[Dict[str, Any]] = None,
        stripe_data: Optional[Dict[str, Any]] = None,
        content_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate the 'What Matters Now' daily agenda."""

        # Pull live data if not provided
        if stripe_data is None:
            stripe_data = self.pull_stripe_data()
        if crm_data is None:
            crm_data = self.pull_crm_data()

        system_msg = """You are the DynExecutiv Decision Engine.
Your output drives a founder's entire day. Be specific. Name deals, amounts, deadlines.

Rules:
1. Revenue-first. The #1 item must directly generate or protect revenue.
2. Flag risks that could cost money in the next 48 hours.
3. No busywork. If it doesn't move MRR, it doesn't make the list.

Output a JSON object:
  what_matters_now: string — the single most important thing today
  top_3_moves: list of 3 objects with "action" and "expected_outcome"
  risk_flags: list of objects with "risk" and "mitigation"
  proof_artifact: string — what to capture as evidence of progress
"""

        user_msg = f"""LIVE DATA:
Stripe: {json.dumps(stripe_data)}
CRM: {json.dumps(crm_data)}
Content: {json.dumps(content_data or {})}
Date: {date.today().isoformat()}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.4,
            max_tokens=2048,
        )

        return {
            "type": "daily_agenda",
            "date": date.today().isoformat(),
            "data_sources": {
                "stripe": "live" if "error" not in stripe_data else "fallback",
                "crm": "live" if "error" not in crm_data else "fallback",
            },
            "response": response.choices[0].message.content,
        }

    def generate_weekly_brief(
        self,
        crm_data: Optional[Dict[str, Any]] = None,
        stripe_data: Optional[Dict[str, Any]] = None,
        content_data: Optional[Dict[str, Any]] = None,
        daily_reviews: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Generate the Weekly Executive Brief."""

        if stripe_data is None:
            stripe_data = self.pull_stripe_data()
        if crm_data is None:
            crm_data = self.pull_crm_data()

        system_msg = """You are the DynExecutiv Decision Engine producing a Weekly Executive Brief.
This brief will be reviewed every Monday morning. Make it count.

Output a JSON object:
  executive_summary: string — 2-3 sentences on the week
  mrr_status: object with "current", "previous", "delta_percent"
  pipeline_velocity: object with "new_deals", "closed_won", "stalled"
  content_performance: object with "views", "conversions", "top_piece"
  cut_recommendations: list of objects with "item" and "reason"
  top_3_priorities_next_week: list of strings
  sprint_grade: string — A/B/C/D/F with one-line justification
"""

        user_msg = f"""LIVE DATA:
Stripe: {json.dumps(stripe_data)}
CRM: {json.dumps(crm_data)}
Content: {json.dumps(content_data or {})}
Daily reviews this week: {json.dumps(daily_reviews or [])}
Week ending: {date.today().isoformat()}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.5,
            max_tokens=2048,
        )

        return {
            "type": "weekly_brief",
            "week_ending": date.today().isoformat(),
            "response": response.choices[0].message.content,
        }

    # ==================================================================
    # BRIEF RENDERING
    # ==================================================================

    def render_brief_html(self, brief_data: Dict[str, Any]) -> str:
        """Render a weekly brief as styled HTML for PDF export."""
        try:
            content = json.loads(brief_data.get("response", "{}"))
        except json.JSONDecodeError:
            content = {"raw": brief_data.get("response", "")}

        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>DynExecutiv Weekly Brief — {brief_data.get('week_ending', '')}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a1a; }}
  h1 {{ border-bottom: 3px solid #2563eb; padding-bottom: 10px; }}
  h2 {{ color: #2563eb; margin-top: 30px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
  th, td {{ border: 1px solid #e5e7eb; padding: 10px; text-align: left; }}
  th {{ background: #f3f4f6; font-weight: 600; }}
  .grade {{ font-size: 48px; font-weight: bold; color: #2563eb; text-align: center; padding: 20px; }}
  .cut {{ color: #dc2626; font-weight: 600; }}
</style></head><body>
<h1>DynExecutiv Weekly Brief</h1>
<p><strong>Week Ending:</strong> {brief_data.get('week_ending', 'N/A')}</p>
<pre>{json.dumps(content, indent=2)}</pre>
</body></html>"""
        return html
