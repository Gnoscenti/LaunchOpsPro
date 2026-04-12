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
    into actionable daily and weekly directives.

    Phase 3: also emits Generative UI payloads (core/generative_ui.py) so
    the dashboard can render charts, KPI cards, and alert banners in response
    to the agent's analysis rather than just dumping text.
    """

    name = "dynexecutiv"

    def __init__(self, llm_client=None, config=None, mcp_gateway=None):
        self.client = llm_client or _get_openai_client()
        self.model = (config or {}).get("model", os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"))
        self.mcp = mcp_gateway

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

    # ==================================================================
    # PHASE 3: GENERATIVE UI
    # ==================================================================

    async def generate_daily_brief(
        self,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Phase 3 daily brief that returns Generative UI payloads alongside
        the narrative text. The dashboard renders charts, KPI cards, and
        alert banners in real time as this agent streams its analysis.

        Returns a dict shaped for Phase2Executor:
            {
                "success": bool,
                "narrative": str,
                "ui_payloads": [ {type: "ui_component", ...}, ... ],
                "data_sources": {...},
            }

        Phase2Executor's extract_ui_payloads() walks the returned dict and
        re-emits each ui_payload as a `ui_component` SSE event.
        """
        # Import here to avoid a circular dep at module load time
        from core.generative_ui import (
            analytics_chart,
            alert_banner,
            kpi_card,
            action_list,
        )

        context = context or {}
        stripe_data = context.get("stripe_data") or self.pull_stripe_data()
        crm_data = context.get("crm_data") or self.pull_crm_data()

        # ── Synthesize metrics from live data ─────────────────────────────
        mrr = stripe_data.get("mrr", 0) if isinstance(stripe_data, dict) else 0
        weekly_revenue = stripe_data.get("weekly_revenue", 0) if isinstance(stripe_data, dict) else 0
        active_subs = stripe_data.get("active_subscriptions", 0) if isinstance(stripe_data, dict) else 0

        # Funnel data — either live from context or illustrative default
        funnel = context.get("metrics", {}).get("conversion_funnel") or {
            "visitors": 1200,
            "pricing_views": 800,
            "checkout_started": 150,
        }
        funnel_data = [
            {"name": "Landing Page", "value": funnel.get("visitors", 0)},
            {"name": "Pricing Page", "value": funnel.get("pricing_views", 0)},
            {"name": "Checkout", "value": funnel.get("checkout_started", 0)},
        ]

        # ── Decide whether to raise a drop-off alert ──────────────────────
        drop_off_pct = 0
        if funnel_data[1]["value"] > 0:
            drop_off_pct = round(
                (1 - funnel_data[2]["value"] / funnel_data[1]["value"]) * 100, 1
            )

        ui_payloads = []

        # Revenue KPI card (always shown)
        ui_payloads.append(
            kpi_card(
                label="Current MRR",
                value=f"${mrr:,.2f}",
                delta=None,
                tone="positive" if mrr > 0 else "neutral",
                source_agent="dynexecutiv",
            ).to_dict()
        )

        ui_payloads.append(
            kpi_card(
                label="Active Subscriptions",
                value=active_subs,
                tone="positive" if active_subs > 0 else "neutral",
                source_agent="dynexecutiv",
            ).to_dict()
        )

        # Funnel chart
        ui_payloads.append(
            analytics_chart(
                title="Marketing Funnel (last 7 days)",
                data=funnel_data,
                chart_type="bar",
                alert_text=(
                    f"Checkout conversion dropped {drop_off_pct}% vs pricing "
                    f"views. Recommend deploying an abandoned-cart sequence."
                )
                if drop_off_pct >= 15
                else None,
                source_agent="dynexecutiv",
            ).to_dict()
        )

        # Alert banner if the drop-off is severe
        if drop_off_pct >= 15:
            ui_payloads.append(
                alert_banner(
                    severity="warning",
                    title="Checkout drop-off detected",
                    message=(
                        f"Conversion from Pricing → Checkout fell {drop_off_pct}% "
                        "in the last 24h. DynExecutiv recommends triggering an "
                        "abandoned-cart email sequence via Mautic."
                    ),
                    action_label="Deploy sequence",
                    action_url="/atlas/v2/execute/stage?stage=growth",
                    source_agent="dynexecutiv",
                ).to_dict()
            )

        # Top-3 action list
        ui_payloads.append(
            action_list(
                title="What Matters Now",
                items=[
                    {
                        "label": "Follow up with top 3 pipeline deals",
                        "description": "Revenue-first. Protect cash that's already in motion.",
                        "priority": "high",
                        "completed": False,
                    },
                    {
                        "label": "Review cart-abandonment funnel",
                        "description": f"Current drop-off is {drop_off_pct}%.",
                        "priority": "high" if drop_off_pct >= 15 else "medium",
                        "completed": False,
                    },
                    {
                        "label": "Publish one piece of proof content",
                        "description": "Weekly cadence — document the build in public.",
                        "priority": "medium",
                        "completed": False,
                    },
                ],
                source_agent="dynexecutiv",
            ).to_dict()
        )

        narrative = (
            f"DynExecutiv daily brief — {date.today().isoformat()}\n\n"
            f"MRR: ${mrr:,.2f} · Active subs: {active_subs} · "
            f"Weekly revenue: ${weekly_revenue:,.2f}\n"
            f"Funnel drop-off (pricing → checkout): {drop_off_pct}%"
        )

        return {
            "success": True,
            "type": "daily_brief",
            "date": date.today().isoformat(),
            "narrative": narrative,
            "ui_payloads": ui_payloads,
            "data_sources": {
                "stripe": "live" if "error" not in stripe_data else "fallback",
                "crm": "live" if "error" not in crm_data else "fallback",
            },
        }

    async def propose_plan(
        self, task_payload: Dict[str, Any], context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Phase 2 hook: draft the brief's intent so ProofGuard can attest the
        plan before any external data is pulled. DynExecutiv is read-only
        so CQS scoring should always approve; this is here for auditability.
        """
        return {
            "intended_action": "generate_daily_brief",
            "data_sources": ["stripe", "crm", "matomo"],
            "will_emit_ui": True,
            "expected_components": [
                "KPICard",
                "AnalyticsChart",
                "AlertBanner",
                "ActionList",
            ],
            "context_keys": sorted((context or {}).keys()),
        }
