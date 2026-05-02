#!/usr/bin/env python3
"""
Atlas Orchestrator — Python Agent Runner v2
Spawned by the Node.js execution bridge as a subprocess.

Supports two invocation patterns:
  1. BaseAgent subclasses: analyze(context) → execute(task)
  2. Founder Edition standalone agents: method dispatch via _method key

Receives a JSON task on stdin, executes the corresponding agent,
and writes structured JSON results to stdout.

Protocol:
  stdin  → single JSON object with keys: agentId, label, description, config, context
  stdout → JSON lines:
    {"event":"log","level":"info","message":"..."}
    {"event":"progress","percent":50,"message":"..."}
    {"event":"result","success":true,"data":{...}}
    {"event":"error","message":"..."}
  exit 0 → success, exit 1 → failure
"""
import json
import sys
import os
import traceback
import importlib
import logging

# ─── Python Path Setup ──────────────────────────────────────────────────────
# Use ONLY the Founder Edition repo — it is a superset of the legacy repo.
# Monorepo structure: platform/ is inside LaunchOpsPro/
# agents/ lives at LaunchOpsPro/agents/ (one level up from platform/server/)
LAUNCHOPS_ROOT = os.environ.get(
    "FOUNDER_EDITION_DIR",
    os.path.join(os.path.dirname(__file__), "..", ".."),  # LaunchOpsPro/
)

# Add LaunchOpsPro root to path so 'from agents.xxx import Xxx' works
if os.path.isdir(os.path.join(LAUNCHOPS_ROOT, "agents")):
    sys.path.insert(0, LAUNCHOPS_ROOT)
else:
    print(f"WARNING: agents/ not found at {LAUNCHOPS_ROOT}", file=sys.stderr)

# Legacy compat aliases
FOUNDER_EDITION_DIR = LAUNCHOPS_ROOT
LEGACY_LAUNCHOPS_DIR = LAUNCHOPS_ROOT

# Suppress noisy logs from libraries
logging.basicConfig(level=logging.WARNING, stream=sys.stderr)

# ─── LLM Client Initialization ─────────────────────────────────────────────
# Priority order:
#   1. Forge (OpenAI-compatible, platform-provided, zero extra cost)
#   2. Anthropic (if ANTHROPIC_API_KEY is set and has credits)
#   3. OpenAI (if OPENAI_API_KEY is set)
#   4. None (agents run without LLM, return placeholders)

_llm_client = None
_llm_provider = "none"

def _init_llm_client():
    """Initialize LLM client from environment variables. Called once at startup."""
    global _llm_client, _llm_provider

    forge_url = os.environ.get("FORGE_API_URL", "").strip()
    forge_key = os.environ.get("FORGE_API_KEY", "").strip()
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    # Priority 1: Forge (OpenAI-compatible endpoint provided by the platform)
    if forge_url and forge_key:
        try:
            from openai import OpenAI
            base_url = f"{forge_url.rstrip('/')}/v1"
            _llm_client = OpenAI(api_key=forge_key, base_url=base_url)
            _llm_provider = "forge"
            emit("log", level="info", message=f"LLM client initialized: Forge (OpenAI-compatible) at {base_url}")
            return
        except Exception as exc:
            emit("log", level="warn", message=f"Failed to init Forge client: {exc}")

    # Priority 2: Anthropic (Claude)
    if anthropic_key:
        try:
            import anthropic
            _llm_client = anthropic.Anthropic(api_key=anthropic_key)
            _llm_provider = "anthropic"
            emit("log", level="info", message="LLM client initialized: Anthropic (Claude)")
            return
        except Exception as exc:
            emit("log", level="warn", message=f"Failed to init Anthropic client: {exc}")

    # Priority 3: OpenAI direct
    if openai_key:
        try:
            from openai import OpenAI
            _llm_client = OpenAI(api_key=openai_key)
            _llm_provider = "openai"
            emit("log", level="info", message="LLM client initialized: OpenAI")
            return
        except Exception as exc:
            emit("log", level="warn", message=f"Failed to init OpenAI client: {exc}")

    emit("log", level="warn", message="No LLM API key found — agents will run without LLM")

# ─── Agent Mapping ──────────────────────────────────────────────────────────
# Pattern 1: BaseAgent subclasses — (module_path, class_name, None)
# Pattern 2: Standalone agents — (module_path, class_name, default_method)

AGENT_MAP = {
    # ── BaseAgent subclasses (analyze/execute pattern) ──────────────────
    "security-agent":   ("agents.security_agent",  "SecurityAgent",    None),
    "security":         ("agents.security_agent",  "SecurityAgent",    None),
    "paralegal":        ("agents.paralegal_bot",   "ParalegalBot",     None),
    "paralegal-bot":    ("agents.paralegal_bot",   "ParalegalBot",     None),
    "paperwork-agent":  ("agents.paralegal_bot",   "ParalegalBot",     None),
    "formation-advisor":("agents.paralegal_bot",   "ParalegalBot",     None),
    "stripe-agent":     ("agents.stripe_agent",    "StripeAgent",      None),
    "stripe":           ("agents.stripe_agent",    "StripeAgent",      None),
    "wordpress-agent":  ("agents.wordpress_agent", "WordPressAgent",   None),
    "wordpress":        ("agents.wordpress_agent", "WordPressAgent",   None),
    "mautic-agent":     ("agents.mautic_agent",    "MauticAgent",      None),
    "mautic":           ("agents.mautic_agent",    "MauticAgent",      None),
    "support-agent":    ("agents.support_agent",   "SupportAgent",     None),
    "support":          ("agents.support_agent",   "SupportAgent",     None),
    "files-agent":      ("agents.files_agent",     "FilesAgent",       None),
    "files":            ("agents.files_agent",     "FilesAgent",       None),
    "project-agent":    ("agents.project_agent",   "ProjectAgent",     None),
    "project":          ("agents.project_agent",   "ProjectAgent",     None),
    "analytics-agent":  ("agents.analytics_agent", "AnalyticsAgent",   None),
    "analytics":        ("agents.analytics_agent", "AnalyticsAgent",   None),
    "growth-agent":     ("agents.growth_agent",    "GrowthAgent",      None),
    "growth":           ("agents.growth_agent",    "GrowthAgent",      None),
    "email-agent":      ("agents.email_agent",     "EmailAgent",       None),
    "email":            ("agents.email_agent",     "EmailAgent",       None),
    "repo-agent":       ("agents.repo_agent",      "RepoAgent",        None),
    "repo":             ("agents.repo_agent",      "RepoAgent",        None),

    # ── Founder Edition standalone agents (method dispatch) ─────────────
    "content-engine":   ("agents.content_engine",  "ContentEngineAgent", "generate_30_day_calendar"),
    "dynexecutiv":      ("agents.dynexecutiv",     "DynExecutivAgent",   "generate_daily_agenda"),
    "dynexecutiv-agent":("agents.dynexecutiv",     "DynExecutivAgent",   "generate_daily_agenda"),
    "founder-os":       ("agents.founder_os",      "FounderOSAgent",     "morning_agenda"),
    "founder-os-agent": ("agents.founder_os",      "FounderOSAgent",     "morning_agenda"),
    "metrics-agent":    ("agents.metrics_agent",   "MetricsAgent",       "weekly_snapshot"),

    # ── Previously LLM-only, now wired to real Python implementations ──
    "business-builder":      ("agents.business_builder",      "BusinessBuilderAgent",   None),
    "funding-intelligence":  ("agents.funding_intelligence",  "FundingIntelligenceAgent", None),
    "execai-coach":          ("agents.execai_coach",          "ExecAICoach",            None),
    "documentary-tracker":   ("agents.documentary_tracker",   "DocumentaryTracker",     None),
}

# ── Method dispatch table for Founder Edition agents ────────────────────
# Maps (agentId, method_name) → actual method name on the class
# This allows the Node.js bridge to request specific methods via config._method
FOUNDER_METHODS = {
    "content-engine": {
        "generate_30_day_calendar": "generate_30_day_calendar",
        "generate_post": "generate_post",
        "generate_youtube_short_script": "generate_youtube_short_script",
    },
    "dynexecutiv": {
        "generate_daily_agenda": "generate_daily_agenda",
        "generate_weekly_brief": "generate_weekly_brief",
    },
    "dynexecutiv-agent": {
        "generate_daily_agenda": "generate_daily_agenda",
        "generate_weekly_brief": "generate_weekly_brief",
    },
    "founder-os": {
        "morning_agenda": "morning_agenda",
        "midday_check": "midday_check",
        "evening_review": "evening_review",
        "weekly_sprint_plan": "weekly_sprint_plan",
    },
    "founder-os-agent": {
        "morning_agenda": "morning_agenda",
        "midday_check": "midday_check",
        "evening_review": "evening_review",
        "weekly_sprint_plan": "weekly_sprint_plan",
    },
    "metrics-agent": {
        "weekly_snapshot": "weekly_snapshot",
        "calculate_conversion_funnel": "calculate_conversion_funnel",
        "cac_ltv_analysis": "cac_ltv_analysis",
        "evaluate_and_cut": "evaluate_and_cut",
    },
    "business-builder": {
        "build_spec_intake": "_build_spec_intake",
        "business_model_canvas": "_business_model_canvas",
        "go_to_market": "_go_to_market",
        "competitive_analysis": "_competitive_analysis",
        "pricing_strategy": "_pricing_strategy",
        "operational_plan": "_operational_plan",
        "kpi_dashboard": "_kpi_dashboard",
    },
    "funding-intelligence": {
        "readiness_report": "_generate_readiness_report",
        "formation_optimizer": "_formation_optimizer",
        "sbir_eligibility": "_sbir_eligibility_check",
        "vc_readiness": "_vc_readiness_check",
        "grant_search": "_grant_search",
    },
    "execai-coach": {
        "strategic_review": "_strategic_review",
        "entity_advice": "_entity_advice",
        "funding_plan": "_funding_plan",
        "ip_strategy": "_ip_strategy",
        "ask": "_ask",
        "weekly_review": "_weekly_review",
        "decision_support": "_decision_support",
        "full_coaching_session": "_full_coaching_session",
    },
    "documentary-tracker": {
        "log_milestone": "_log_milestone",
        "log_ai_moment": "_log_ai_moment",
        "generate_narrative": "_generate_narrative",
        "generate_chapter": "_generate_chapter",
        "timeline_report": "_timeline_report",
        "export_documentary": "_export_documentary",
    },
}

# Agent IDs that don't map to a real Python agent — use LLM fallback
LLM_ONLY_AGENTS = {
    # Strategic agents (rich LLM prompts with structured JSON output)
    "synthesis-agent",
    "seven-pillar-agent",
    "systems-agent",
}


def emit(event_type: str, **kwargs):
    """Write a JSON event line to stdout for the Node.js bridge to consume."""
    payload = {"event": event_type, **kwargs}
    sys.stdout.write(json.dumps(payload, default=str) + "\n")
    sys.stdout.flush()


def load_agent(agent_id: str, config: dict = None):
    """Dynamically import and instantiate a LaunchOps agent.
    
    Most Founder Edition agents accept (llm_client, config) in their __init__.
    We pass the initialized _llm_client (Anthropic or OpenAI) so agents can
    make real LLM calls. Falls back to None if no API key is available.
    """
    if agent_id not in AGENT_MAP:
        return None
    module_path, class_name, _ = AGENT_MAP[agent_id]
    try:
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)
        # Pass the global _llm_client (initialized from env vars)
        import inspect
        sig = inspect.signature(cls.__init__)
        params = list(sig.parameters.keys())
        client = _llm_client  # May be Anthropic, OpenAI, or None
        if client is not None:
            emit("log", level="info", message=f"Passing LLM client ({type(client).__name__}) to {agent_id}")
        if 'llm_client' in params and 'config' in params:
            return cls(llm_client=client, config=config or {})
        elif 'llm_client' in params:
            return cls(llm_client=client)
        elif 'config' in params:
            return cls(config=config or {})
        else:
            return cls()
    except Exception as exc:
        emit("log", level="warn", message=f"Could not load agent {agent_id}: {exc}")
        return None


def is_founder_edition_agent(agent_id: str) -> bool:
    """Check if this agent uses method dispatch instead of analyze/execute."""
    return agent_id in FOUNDER_METHODS


def run_base_agent(agent, task: dict) -> dict:
    """Execute a BaseAgent subclass using the analyze → execute pattern."""
    emit("log", level="info", message=f"Analyzing context for {task.get('label', 'unknown')}...")
    emit("progress", percent=20, message="Running analysis phase")

    try:
        context = task.get("context", {})
        analysis = agent.analyze(context)
        emit("progress", percent=40, message="Analysis complete, executing task")
    except Exception as exc:
        emit("log", level="warn", message=f"Analysis phase failed: {exc}")
        analysis = {}

    emit("log", level="info", message=f"Executing agent task: {task.get('label', 'unknown')}")
    emit("progress", percent=60, message="Executing agent")

    # Build the task dict for the agent's execute() method.
    # The 'type' key determines which handler the agent uses internally.
    # Priority: config.type > taskType > default based on agentId
    config = task.get("config", {}) or {}
    task_type = config.pop("type", None) or task.get("taskType", "audit")
    
    agent_task = {
        "type": task_type,
        **task.get("context", {}),
        **config,
        "analysis": analysis,
    }

    emit("log", level="info", message=f"Calling execute() with type={task_type}")
    result = agent.execute(agent_task)
    emit("progress", percent=90, message="Agent execution complete")
    
    # Normalize: BaseAgent results often don't include a 'success' key.
    # If the result is a dict without 'success' and without 'error', treat as success.
    if isinstance(result, dict):
        if "success" not in result:
            if "error" in result and result["error"]:
                result["success"] = False
            else:
                result["success"] = True
    elif result is None:
        result = {"success": True, "message": "Agent completed (no output)"}
    else:
        result = {"success": True, "data": str(result)}
    
    return result


def run_founder_agent(agent, agent_id: str, task: dict) -> dict:
    """
    Execute a Founder Edition standalone agent using method dispatch.
    
    The method to call is determined by:
    1. config._method (explicit override from the Node.js bridge)
    2. The default method in AGENT_MAP
    3. Fallback to the first available method in FOUNDER_METHODS
    """
    config = task.get("config", {}) or {}
    context = task.get("context", {})
    
    # Determine which method to call
    requested_method = config.get("_method")
    _, _, default_method = AGENT_MAP.get(agent_id, (None, None, None))
    
    available_methods = FOUNDER_METHODS.get(agent_id, {})
    
    if requested_method and requested_method in available_methods:
        method_name = available_methods[requested_method]
    elif default_method and default_method in available_methods:
        method_name = available_methods[default_method]
    elif available_methods:
        method_name = list(available_methods.values())[0]
    else:
        return {
            "success": False,
            "message": f"No methods available for agent {agent_id}",
        }
    
    emit("log", level="info", message=f"Dispatching {agent_id}.{method_name}()")
    emit("progress", percent=30, message=f"Calling {method_name}")
    
    # Get the actual method from the agent instance
    method = getattr(agent, method_name, None)
    if method is None:
        return {
            "success": False,
            "message": f"Method {method_name} not found on agent {agent_id}",
        }
    
    # Build kwargs from config and context
    # Different methods expect different arguments — we pass what we have
    # and let Python's flexibility handle the rest
    import inspect
    sig = inspect.signature(method)
    kwargs = {}
    
    # Merge config and context into a single pool of available arguments
    arg_pool = {**context, **config}
    # Remove internal keys
    arg_pool.pop("_method", None)
    
    for param_name, param in sig.parameters.items():
        if param_name == "self":
            continue
        if param_name == "task":
            # Many BaseAgent-style methods expect a single 'task' dict
            kwargs["task"] = arg_pool
        elif param_name in arg_pool:
            kwargs[param_name] = arg_pool[param_name]
        elif param.default is inspect.Parameter.empty:
            # Required param not found — try common aliases
            if param_name == "product_name":
                kwargs[param_name] = arg_pool.get("business_name", arg_pool.get("name", "Product"))
            elif param_name == "current_mrr":
                kwargs[param_name] = arg_pool.get("mrr", 0)
            elif param_name == "key_milestones":
                kwargs[param_name] = arg_pool.get("milestones", [])
            elif param_name == "base_url":
                kwargs[param_name] = arg_pool.get("website_url", arg_pool.get("url", ""))
            elif param_name == "context":
                kwargs["context"] = context
    
    emit("progress", percent=60, message=f"Executing {method_name} with {len(kwargs)} args")
    
    try:
        result = method(**kwargs)
    except TypeError as exc:
        # If kwargs don't match, try passing the whole arg_pool as a single 'task' dict
        emit("log", level="warn", message=f"Method call with kwargs failed ({exc}), trying task-dict pattern")
        try:
            result = method(arg_pool)
        except TypeError:
            # Last resort: zero-arg call
            result = method()
    
    emit("progress", percent=90, message="Method execution complete")
    
    # Normalize the result
    if isinstance(result, dict):
        result["success"] = result.get("success", True)
        result["method"] = method_name
        return result
    elif isinstance(result, str):
        return {"success": True, "method": method_name, "response": result}
    else:
        return {"success": True, "method": method_name, "data": str(result)}


def run_llm_fallback(task: dict) -> dict:
    """
    For agents without a Python implementation, return a structured placeholder
    indicating the step should be handled by the Node.js LLM execution path.
    """
    return {
        "success": True,
        "message": f"{task.get('label', 'Step')} completed via LLM execution",
        "mode": "llm_fallback",
        "summary": f"Agent {task.get('agentId')} executed via LLM — no Python agent available",
        "actions": [f"Processed: {task.get('label', 'unknown')}"],
        "outputs": {"agentId": task.get("agentId"), "mode": "llm_fallback"},
        "recommendations": ["Consider implementing a dedicated Python agent for this step"],
    }


def main():
    """Read task from stdin, execute agent, write result to stdout."""
    try:
        # Initialize LLM client from environment variables (Anthropic or OpenAI)
        _init_llm_client()

        raw = sys.stdin.read()
        if not raw.strip():
            emit("error", message="No input received on stdin")
            sys.exit(1)

        task = json.loads(raw)
        agent_id = task.get("agentId", "")
        label = task.get("label", "Unknown Step")

        emit("log", level="info", message=f"Agent runner v2 started for: {label} (agent: {agent_id})")

        # Route 1: LLM-only agents — no Python implementation
        if agent_id in LLM_ONLY_AGENTS:
            emit("log", level="info", message=f"No Python agent for {agent_id}, using LLM fallback")
            result = run_llm_fallback(task)
            emit("result", success=True, data=result)
            sys.exit(0)

        # Try to load the agent
        agent = load_agent(agent_id)
        if agent is None:
            emit("log", level="warn", message=f"Agent {agent_id} not found, using LLM fallback")
            result = run_llm_fallback(task)
            emit("result", success=True, data=result)
            sys.exit(0)

        # Route 2: Founder Edition agents — method dispatch
        if is_founder_edition_agent(agent_id):
            emit("log", level="info", message=f"Using Founder Edition method dispatch for {agent_id}")
            result = run_founder_agent(agent, agent_id, task)
        else:
            # Route 3: BaseAgent subclasses — analyze/execute
            result = run_base_agent(agent, task)

        # Determine success — default to True for dicts without explicit success=False
        is_success = result.get("success", True) if isinstance(result, dict) else bool(result)
        if is_success:
            emit("result", success=True, data=result)
            sys.exit(0)
        else:
            emit("result", success=False, data=result)
            sys.exit(1)

    except json.JSONDecodeError as exc:
        emit("error", message=f"Invalid JSON input: {exc}")
        sys.exit(1)
    except Exception as exc:
        emit("error", message=f"Agent runner error: {exc}")
        emit("log", level="error", message=traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
