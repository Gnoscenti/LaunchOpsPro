"""
LaunchOps Stage Handlers — Wires real agents to Atlas pipeline stages.

This is the critical integration layer. Each pipeline stage gets a handler
that calls the actual agent(s) responsible for that domain. The orchestrator
calls run_stage(name) → handler(context) → agent.execute(task) → results
stored in SharedContext.

Stage → Agent Mapping:
  init           → founder_os (morning agenda), metrics_agent (baseline)
  intake         → business_builder (analyze spec), dynexecutiv (priorities)
  formation      → paperwork_agent (formation docs), paralegal_bot (compliance)
  infrastructure → wordpress_agent (site setup), security_agent (audit)
  legal          → paperwork_agent (legal package), paralegal_bot (ip audit)
  payments       → stripe_agent (setup products/pricing)
  funding        → funding_intelligence (readiness report)
  coaching       → execai_coach (strategy session), founder_os (daily plan)
  growth         → growth_agent (strategy), content_engine (calendar), mautic_agent (email)
  done           → documentary_tracker (narrative), metrics_agent (final snapshot)
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, Callable, Optional

from core.context import SharedContext
from core import audit_log


def _safe_execute(agent, task: Dict, context: SharedContext, stage: str) -> Dict:
    """
    Execute an agent safely, catching errors and logging to context.
    Supports both BaseAgent subclasses (.execute(task)) and standalone agents
    (direct method calls via task['_method']).
    """
    agent_name = getattr(agent, "name", agent.__class__.__name__)
    audit_log.record(
        agent=agent_name,
        action=f"stage_{stage}_execute",
        status="success",
        details={"message": f"Executing {agent_name} for stage '{stage}'"},
    )
    try:
        # If a specific method is requested, call it directly
        method_name = task.pop("_method", None)
        if method_name and hasattr(agent, method_name):
            method = getattr(agent, method_name)
            # Call with task kwargs or no args depending on signature
            import inspect
            sig = inspect.signature(method)
            params = list(sig.parameters.keys())
            if len(params) == 0 or (len(params) == 1 and params[0] == "self"):
                result = method()
            else:
                result = method(**task)
        elif hasattr(agent, "execute"):
            result = agent.execute(task)
        else:
            result = {"status": "skipped", "reason": f"{agent_name} has no execute() method"}

        # Normalize result
        if result is None:
            result = {"status": "completed", "output": None}
        elif isinstance(result, str):
            result = {"status": "completed", "output": result}

        # Store result in context
        context.set(f"agent_outputs.{stage}.{agent_name}", {
            "status": "completed",
            "timestamp": datetime.now().isoformat(),
            "result": result,
        })
        audit_log.record(
            agent=agent_name,
            action=f"stage_{stage}_complete",
            status="success",
            details={"message": f"{agent_name} completed stage '{stage}' successfully"},
        )
        return result
    except Exception as e:
        error_data = {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "agent": agent_name,
            "stage": stage,
        }
        context.set(f"agent_outputs.{stage}.{agent_name}", error_data)
        context._data.setdefault("errors", []).append(error_data)
        audit_log.record(
            agent=agent_name,
            action=f"stage_{stage}_error",
            status="failure",
            error=str(e),
        )
        return error_data


def _get_business_config() -> Dict:
    """Load the business config from disk."""
    config_path = os.path.expanduser("~/.launchops/business.json")
    if os.path.exists(config_path):
        with open(config_path) as f:
            return json.load(f)
    return {
        "name": "Dynexis Systems",
        "type": "AI SaaS",
        "entity_type": "S-Corporation",
        "state": "California",
        "industry": "Technology",
        "revenue_model": "subscription",
    }


def register_all_handlers(orchestrator, agents: Dict[str, Any]):
    """
    Register stage handlers that call real agents.
    This is the single integration point between Atlas and the agent swarm.

    Args:
        orchestrator: AtlasOrchestrator instance
        agents: Dict of agent_name → agent_instance (from build_system)
    """

    # ── STAGE: init ──────────────────────────────────────────────────────
    def handle_init(context: SharedContext):
        """Initialize the pipeline: load config, set baseline metrics, morning agenda."""
        business = _get_business_config()
        context.set("business", business)
        context.set("pipeline_started_at", datetime.now().isoformat())

        results = {}

        # Founder OS: generate morning agenda
        if "founder_os" in agents:
            results["founder_os"] = _safe_execute(
                agents["founder_os"],
                {"_method": "morning_agenda"},
                context, "init",
            )

        # Metrics: establish baseline
        if "metrics_agent" in agents:
            results["metrics_agent"] = _safe_execute(
                agents["metrics_agent"],
                {"_method": "weekly_snapshot"},
                context, "init",
            )

        # Documentary: log pipeline start
        if "documentary_tracker" in agents:
            _safe_execute(
                agents["documentary_tracker"],
                {
                    "type": "log_milestone",
                    "milestone_type": "infrastructure",
                    "title": "Pipeline Initiated",
                    "description": f"LaunchOps pipeline started for {business.get('name', 'Unknown')}",
                },
                context, "init",
            )

        return results

    orchestrator.register_stage_handler("init", handle_init)

    # ── STAGE: intake ────────────────────────────────────────────────────
    def handle_intake(context: SharedContext):
        """Analyze the business spec and set revenue-first priorities."""
        business = context.get("business") or _get_business_config()
        results = {}

        # Business Builder: analyze the spec
        if "business_builder" in agents:
            results["business_builder"] = _safe_execute(
                agents["business_builder"],
                {
                    "type": "analyze",
                    "business_name": business.get("name"),
                    "industry": business.get("industry"),
                    "revenue_model": business.get("revenue_model"),
                },
                context, "intake",
            )

        # DynExecutiv: set priorities
        if "dynexecutiv" in agents:
            results["dynexecutiv"] = _safe_execute(
                agents["dynexecutiv"],
                {"_method": "generate_daily_agenda"},
                context, "intake",
            )

        return results

    orchestrator.register_stage_handler("intake", handle_intake)

    # ── STAGE: formation ─────────────────────────────────────────────────
    def handle_formation(context: SharedContext):
        """Generate formation documents and compliance checks."""
        business = context.get("business") or _get_business_config()
        results = {}

        # Paperwork Agent: generate formation package
        if "paperwork_agent" in agents:
            results["paperwork_agent"] = _safe_execute(
                agents["paperwork_agent"],
                {
                    "type": "formation_package",
                    "business_name": business.get("name"),
                    "entity_type": business.get("entity_type", "S-Corporation"),
                    "state": business.get("state", "California"),
                },
                context, "formation",
            )

        # Paralegal Bot: compliance check
        if "paralegal_bot" in agents:
            results["paralegal_bot"] = _safe_execute(
                agents["paralegal_bot"],
                {
                    "type": "compliance_check",
                    "entity_type": business.get("entity_type"),
                    "state": business.get("state"),
                },
                context, "formation",
            )

        # Documentary: log milestone
        if "documentary_tracker" in agents:
            _safe_execute(
                agents["documentary_tracker"],
                {
                    "type": "log_milestone",
                    "milestone_type": "formation",
                    "title": "Business Formation Initiated",
                    "description": f"Formation documents generated for {business.get('name')}",
                },
                context, "formation",
            )

        return results

    orchestrator.register_stage_handler("formation", handle_formation)

    # ── STAGE: infrastructure ────────────────────────────────────────────
    def handle_infrastructure(context: SharedContext):
        """Set up WordPress site and run security audit."""
        business = context.get("business") or _get_business_config()
        results = {}

        # WordPress Agent: setup site
        if "wordpress_agent" in agents:
            results["wordpress_agent"] = _safe_execute(
                agents["wordpress_agent"],
                {
                    "type": "full_setup",
                    "business_name": business.get("name"),
                    "domain": business.get("domain", "dynexissystems.com"),
                },
                context, "infrastructure",
            )

        # Security Agent: audit
        if "security_agent" in agents:
            results["security_agent"] = _safe_execute(
                agents["security_agent"],
                {"type": "audit"},
                context, "infrastructure",
            )

        # Analytics Agent: setup tracking
        if "analytics_agent" in agents:
            results["analytics_agent"] = _safe_execute(
                agents["analytics_agent"],
                {"type": "setup", "platform": "matomo"},
                context, "infrastructure",
            )

        return results

    orchestrator.register_stage_handler("infrastructure", handle_infrastructure)

    # ── STAGE: legal ─────────────────────────────────────────────────────
    def handle_legal(context: SharedContext):
        """Generate legal documents and IP audit."""
        business = context.get("business") or _get_business_config()
        results = {}

        # Paperwork Agent: legal package
        if "paperwork_agent" in agents:
            results["paperwork_agent"] = _safe_execute(
                agents["paperwork_agent"],
                {
                    "type": "legal_package",
                    "business_name": business.get("name"),
                    "state": business.get("state", "California"),
                },
                context, "legal",
            )

        # Paralegal Bot: IP audit
        if "paralegal_bot" in agents:
            results["paralegal_bot"] = _safe_execute(
                agents["paralegal_bot"],
                {
                    "type": "ip_audit",
                    "business_name": business.get("name"),
                },
                context, "legal",
            )

        return results

    orchestrator.register_stage_handler("legal", handle_legal)

    # ── STAGE: payments ──────────────────────────────────────────────────
    def handle_payments(context: SharedContext):
        """Set up Stripe products and pricing."""
        business = context.get("business") or _get_business_config()
        results = {}

        # Stripe Agent: setup
        if "stripe_agent" in agents:
            results["stripe_agent"] = _safe_execute(
                agents["stripe_agent"],
                {
                    "type": "setup_products",
                    "business_name": business.get("name"),
                    "revenue_model": business.get("revenue_model", "subscription"),
                },
                context, "payments",
            )

        return results

    orchestrator.register_stage_handler("payments", handle_payments)

    # ── STAGE: funding ───────────────────────────────────────────────────
    def handle_funding(context: SharedContext):
        """Run funding readiness report."""
        business = context.get("business") or _get_business_config()
        results = {}

        if "funding_intelligence" in agents:
            results["funding_intelligence"] = _safe_execute(
                agents["funding_intelligence"],
                {
                    "type": "readiness_report",
                    "entity_type": business.get("entity_type"),
                    "revenue_model": business.get("revenue_model"),
                },
                context, "funding",
            )

        return results

    orchestrator.register_stage_handler("funding", handle_funding)

    # ── STAGE: coaching ──────────────────────────────────────────────────
    def handle_coaching(context: SharedContext):
        """ExecAI coaching session + Founder OS daily plan."""
        results = {}

        if "execai_coach" in agents:
            results["execai_coach"] = _safe_execute(
                agents["execai_coach"],
                {"type": "strategy_session", "topic": "launch_readiness"},
                context, "coaching",
            )

        if "founder_os" in agents:
            results["founder_os"] = _safe_execute(
                agents["founder_os"],
                {"_method": "weekly_sprint_plan"},
                context, "coaching",
            )

        return results

    orchestrator.register_stage_handler("coaching", handle_coaching)

    # ── STAGE: growth ────────────────────────────────────────────────────
    def handle_growth(context: SharedContext):
        """Growth strategy, content calendar, and email campaigns."""
        business = context.get("business") or _get_business_config()
        results = {}

        # Growth Agent: strategy
        if "growth_agent" in agents:
            results["growth_agent"] = _safe_execute(
                agents["growth_agent"],
                {
                    "type": "growth_strategy",
                    "business_name": business.get("name"),
                    "industry": business.get("industry"),
                },
                context, "growth",
            )

        # Content Engine: generate calendar
        if "content_engine" in agents:
            results["content_engine"] = _safe_execute(
                agents["content_engine"],
                {"_method": "generate_30_day_calendar"},
                context, "growth",
            )

        # Mautic Agent: email setup
        if "mautic_agent" in agents:
            results["mautic_agent"] = _safe_execute(
                agents["mautic_agent"],
                {
                    "type": "setup_campaigns",
                    "business_name": business.get("name"),
                },
                context, "growth",
            )

        # Email Agent: welcome sequence
        if "email_agent" in agents:
            results["email_agent"] = _safe_execute(
                agents["email_agent"],
                {"type": "welcome_sequence"},
                context, "growth",
            )

        return results

    orchestrator.register_stage_handler("growth", handle_growth)

    # ── STAGE: done ──────────────────────────────────────────────────────
    def handle_done(context: SharedContext):
        """Final stage: generate documentary narrative, take metrics snapshot."""
        results = {}

        # Documentary: generate full narrative
        if "documentary_tracker" in agents:
            results["documentary_tracker"] = _safe_execute(
                agents["documentary_tracker"],
                {"type": "generate_narrative"},
                context, "done",
            )

        # Metrics: final snapshot
        if "metrics_agent" in agents:
            results["metrics_agent"] = _safe_execute(
                agents["metrics_agent"],
                {"_method": "weekly_snapshot"},
                context, "done",
            )

        # Founder OS: evening review
        if "founder_os" in agents:
            results["founder_os"] = _safe_execute(
                agents["founder_os"],
                {"_method": "evening_review"},
                context, "done",
            )

        context.set("pipeline_completed_at", datetime.now().isoformat())

        # Log completion milestone
        if "documentary_tracker" in agents:
            _safe_execute(
                agents["documentary_tracker"],
                {
                    "type": "log_milestone",
                    "milestone_type": "breakthrough",
                    "title": "Pipeline Complete",
                    "description": "Full LaunchOps pipeline executed successfully.",
                },
                context, "done",
            )

        return results

    orchestrator.register_stage_handler("done", handle_done)

    # Log the registration
    audit_log.record(
        agent="stage_handlers",
        action="register_all",
        status="success",
        details={"handler_count": len(orchestrator._stage_handlers)},
    )

    return orchestrator
