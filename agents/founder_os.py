"""Founder OS agent — daily operating system for zero-drift execution.

Rules:
  1. No new tools unless MRR > $20k/mo.
  2. Every day includes 1 revenue action + 1 proof artifact.
  3. No busywork. If it doesn't move revenue, it doesn't go on the list.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, date
import json
import os

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None


def _get_openai_client():
    """Build an OpenAI client from environment or core config."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    base_url = os.environ.get("OPENAI_API_BASE", os.environ.get("OPENAI_BASE_URL", ""))
    kwargs = {"api_key": api_key} if api_key else {}
    if base_url:
        kwargs["base_url"] = base_url
    return OpenAI(**kwargs) if OpenAI else None


def _get_model():
    return os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")


class FounderOSAgent:
    """The daily operating system. Produces morning agenda, midday check,
    evening review, and weekly sprint plans."""

    name = "founder_os"

    REVENUE_RULE = (
        "Every day MUST include exactly 1 revenue action (close a deal, "
        "send an invoice, publish a paid offering, run a sales call) and "
        "1 proof artifact (screenshot, receipt, analytics snapshot, or "
        "customer testimonial) that proves the action happened."
    )

    TOOL_GATE = (
        "No new tools, subscriptions, or platforms may be adopted unless "
        "current MRR exceeds $20,000/month. Work with what you have."
    )

    def __init__(self, llm_client=None, config=None):
        self.client = llm_client or _get_openai_client()
        self.model = (config or {}).get("model", _get_model())
        # Lazy import to avoid pulling core.temporal at module-load time
        from core.temporal import TemporalManager

        self.temporal_engine = TemporalManager()

    # ------------------------------------------------------------------
    # Dynexis Daily Command Center — pomodoro-driven agenda
    # ------------------------------------------------------------------
    async def generate_daily_agenda(
        self,
        priorities: Optional[List[Dict[str, Any]]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Return the Dynexis DailyCommandCenter payload.

        Pulls raw priorities (either passed in, or derived from a minimal
        default list), applies TemporalManager.build_agenda() to cap them
        at 3 sprints and add pomodoro time blocks, then returns a generative
        UI component descriptor the dashboard knows how to render.

        Returned shape matches core/generative_ui.py conventions:
            {
                "type": "ui_component",
                "component": "DailyCommandCenter",
                "props": {
                    "title": "What Matters Now",
                    "sprints": [...],
                    "focus_minutes": 25,
                    "total_committed_minutes": 75,
                    "revenue_rule": "...",
                    "tool_gate_status": "LOCKED" | "OPEN",
                },
                "source_agent": "founder_os",
            }
        """
        raw_priorities = priorities or self._default_priorities(context or {})
        sprints = self.temporal_engine.build_agenda(raw_priorities)

        current_mrr = (context or {}).get("current_mrr", 0.0) or (
            context or {}
        ).get("metrics", {}).get("current_mrr", 0.0)
        tool_gate = "LOCKED" if float(current_mrr or 0) < 20000 else "OPEN"

        return {
            "type": "ui_component",
            "component": "DailyCommandCenter",
            "props": {
                "title": "What Matters Now",
                "date": date.today().isoformat(),
                "sprints": sprints,
                "focus_minutes": self.temporal_engine.focus_minutes,
                "break_minutes": self.temporal_engine.break_minutes,
                "total_committed_minutes": self.temporal_engine.total_committed_minutes(
                    len(sprints)
                ),
                "revenue_rule": self.REVENUE_RULE,
                "tool_gate_status": tool_gate,
                "current_mrr": float(current_mrr or 0),
            },
            "source_agent": "founder_os",
        }

    def _default_priorities(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Baseline priorities when no live data is passed in. The top 3 are
        selected deterministically so the UI renders without an LLM call.
        Override by passing `priorities=` to generate_daily_agenda().
        """
        pipeline_deals = context.get("pipeline_deals") or []
        stripe_data = context.get("stripe_data") or {}
        has_pending_formation = bool(context.get("needs_formation_approval"))

        candidates: List[Dict[str, Any]] = []

        if has_pending_formation:
            candidates.append(
                {
                    "name": "Approve Legal Formation Docs",
                    "description": (
                        "Review paperwork_agent output and sign off on "
                        "Articles / Operating Agreement."
                    ),
                    "roi": 99,
                }
            )

        if pipeline_deals:
            top_deal = max(pipeline_deals, key=lambda d: float(d.get("amount", 0)))
            candidates.append(
                {
                    "name": f"Close {top_deal.get('name', 'top pipeline deal')}",
                    "description": f"Expected revenue: ${float(top_deal.get('amount', 0)):,.0f}",
                    "roi": 95,
                }
            )

        if stripe_data.get("mrr", 0) > 0:
            candidates.append(
                {
                    "name": "Review Stripe webhook health",
                    "description": "Confirm no failed events in the last 24h.",
                    "roi": 70,
                }
            )

        candidates.append(
            {
                "name": "Publish one proof artifact",
                "description": "Revenue-first discipline — ship evidence, not busywork.",
                "roi": 80,
            }
        )

        # Always include the Mautic welcome sequence review if there's any
        # growth activity — high-leverage activation move.
        candidates.append(
            {
                "name": "Review Mautic welcome sequence",
                "description": "Top-of-funnel retention check.",
                "roi": 65,
            }
        )

        return candidates

    # ------------------------------------------------------------------
    # Morning Agenda
    # ------------------------------------------------------------------
    def morning_agenda(
        self,
        current_mrr: float = 0.0,
        pipeline_deals: Optional[List[Dict[str, Any]]] = None,
        carryover_tasks: Optional[List[str]] = None,
        content_metrics: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate the morning 'Top 3 Revenue Moves' agenda."""
        pipeline_deals = pipeline_deals or []
        carryover_tasks = carryover_tasks or []

        if not self.client:
            return {"type": "morning_agenda", "date": date.today().isoformat(),
                    "status": "skipped", "reason": "No LLM client available"}

        system_msg = f"""You are Founder OS — a ruthless daily operating system.
{self.REVENUE_RULE}
{self.TOOL_GATE}
Current MRR: ${current_mrr:,.2f}

Output a JSON object with these exact keys:
  revenue_action: string — the ONE revenue action for today
  growth_action: string — one growth/pipeline action
  ops_action: string — one operational action (only if critical)
  proof_artifact: string — what artifact proves the revenue action happened
  risk_flags: list of strings — anything that could derail today
  tool_gate_status: string — "LOCKED" if MRR < $20k, else "OPEN"
"""

        user_msg = f"""Pipeline deals: {json.dumps(pipeline_deals)}
Carryover from yesterday: {json.dumps(carryover_tasks)}
Content metrics: {json.dumps(content_metrics or {})}

Generate today's morning agenda. Be specific. Name the deal, the dollar amount, the exact next step."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.3,
            max_tokens=1024,
        )

        return {
            "type": "morning_agenda",
            "date": date.today().isoformat(),
            "response": response.choices[0].message.content,
        }

    # ------------------------------------------------------------------
    # Midday Check
    # ------------------------------------------------------------------
    def midday_check(
        self,
        morning_agenda: Optional[Dict[str, Any]] = None,
        completed_so_far: Optional[List[str]] = None,
        current_blockers: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Midday checkpoint: blockers + next immediate step."""
        morning_agenda = morning_agenda or {}
        completed_so_far = completed_so_far or []
        current_blockers = current_blockers or []

        if not self.client:
            return {"type": "midday_check", "date": date.today().isoformat(),
                    "status": "skipped", "reason": "No LLM client available"}

        system_msg = f"""You are Founder OS performing a midday check.
{self.REVENUE_RULE}
If the revenue action has NOT been completed yet, it becomes the ONLY priority.

Output a JSON object:
  revenue_action_status: "DONE" or "BLOCKED" or "IN_PROGRESS"
  current_blocker: string or null
  unblock_step: string — the single next action to unblock or advance
  afternoon_priority: string — what to focus on for the rest of the day
"""

        user_msg = f"""Morning agenda: {json.dumps(morning_agenda)}
Completed so far: {json.dumps(completed_so_far)}
Current blockers: {json.dumps(current_blockers)}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.3,
            max_tokens=512,
        )

        return {
            "type": "midday_check",
            "date": date.today().isoformat(),
            "response": response.choices[0].message.content,
        }

    # ------------------------------------------------------------------
    # Evening Review
    # ------------------------------------------------------------------
    def evening_review(
        self,
        morning_agenda: Optional[Dict[str, Any]] = None,
        completed_tasks: Optional[List[str]] = None,
        proof_artifact_url: Optional[str] = None,
        revenue_collected: float = 0.0,
    ) -> Dict[str, Any]:
        """Evening review: wins, misses, carryover."""
        morning_agenda = morning_agenda or {}
        completed_tasks = completed_tasks or []

        if not self.client:
            return {"type": "evening_review", "date": date.today().isoformat(),
                    "status": "skipped", "reason": "No LLM client available"}

        system_msg = f"""You are Founder OS performing an evening review.
{self.REVENUE_RULE}
Be honest. If the revenue action didn't happen, say so and explain why.
If no proof artifact was produced, flag it as a MISS.

Output a JSON object:
  wins: list of strings
  misses: list of strings
  proof_artifact_submitted: boolean
  revenue_action_completed: boolean
  revenue_collected_today: number
  carryover_tasks: list of strings — what carries to tomorrow
  streak_status: string — "MAINTAINED" or "BROKEN" with reason
"""

        user_msg = f"""Morning agenda: {json.dumps(morning_agenda)}
Completed tasks: {json.dumps(completed_tasks)}
Proof artifact URL: {proof_artifact_url or "NONE SUBMITTED"}
Revenue collected today: ${revenue_collected:,.2f}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.3,
            max_tokens=1024,
        )

        return {
            "type": "evening_review",
            "date": date.today().isoformat(),
            "response": response.choices[0].message.content,
        }

    # ------------------------------------------------------------------
    # Weekly Sprint Plan
    # ------------------------------------------------------------------
    def weekly_sprint_plan(
        self,
        current_mrr: float = 0.0,
        last_week_reviews: Optional[List[Dict[str, Any]]] = None,
        pipeline_deals: Optional[List[Dict[str, Any]]] = None,
        content_performance: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate the weekly sprint plan for the upcoming week."""
        last_week_reviews = last_week_reviews or []
        pipeline_deals = pipeline_deals or []
        content_performance = content_performance or {}

        if not self.client:
            return {"type": "weekly_sprint_plan", "week_starting": date.today().isoformat(),
                    "status": "skipped", "reason": "No LLM client available"}

        system_msg = f"""You are Founder OS generating a weekly sprint plan.
{self.REVENUE_RULE}
{self.TOOL_GATE}
Current MRR: ${current_mrr:,.2f}

Analyze last week's daily reviews. Identify patterns.
Output a JSON object:
  week_theme: string — one sentence describing the week's focus
  revenue_target: number — dollar target for the week
  daily_revenue_actions: list of 5 objects, each with "day" and "action"
  content_plan: list of 5 objects, each with "day" and "content_piece"
  kill_list: list of strings — things to stop doing this week
  sprint_success_criteria: string — how we know the week was a win
"""

        user_msg = f"""Last week's daily reviews: {json.dumps(last_week_reviews[-7:] if last_week_reviews else [])}
Pipeline deals: {json.dumps(pipeline_deals)}
Content performance: {json.dumps(content_performance)}"""

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
            "type": "weekly_sprint_plan",
            "week_starting": date.today().isoformat(),
            "response": response.choices[0].message.content,
        }
