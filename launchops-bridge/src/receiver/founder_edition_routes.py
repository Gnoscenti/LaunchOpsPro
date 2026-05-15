"""
LaunchOps Bridge — Founder Edition Webhook Receiver

This module adds bridge endpoints to the Founder Edition FastAPI app.
It receives Action Manifests from LaunchOpsPro (via the bridge service)
and dispatches them to the appropriate execution agents.

Integration:
    # In launchops-founder-edition/api/routes/pipeline.py or main app:
    from bridge_receiver import bridge_receiver_router
    app.include_router(bridge_receiver_router, prefix="/api/bridge")
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger("founder-edition.bridge")

# ── Router ────────────────────────────────────────────────────────────────────
bridge_receiver_router = APIRouter(tags=["bridge-receiver"])

# In-memory execution tracking
_active_executions: Dict[str, Dict] = {}
_execution_history: List[Dict] = []


# ── Models ────────────────────────────────────────────────────────────────────

class ManifestAction(BaseModel):
    action_id: str
    sort_order: int = 0
    agent_id: str
    method: Optional[str] = None
    label: str
    description: Optional[str] = None
    execution_mode: str = "hybrid"
    priority: str = "medium"
    config: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)
    inputs: Dict[str, Any] = Field(default_factory=dict)
    expected_outputs: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)
    timeout_seconds: int = 300
    retry_policy: Dict[str, Any] = Field(default_factory=lambda: {"max_retries": 2, "backoff_seconds": 5})


class ManifestPayload(BaseModel):
    manifest_id: str
    version: str = "1.0.0"
    created_at: str
    source: Dict[str, Any]
    business_context: Dict[str, Any]
    actions: List[ManifestAction]
    execution_config: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ExecutionStatusResponse(BaseModel):
    manifest_id: str
    status: str
    total_actions: int
    completed_actions: int = 0
    failed_actions: int = 0
    current_action: Optional[str] = None
    results: List[Dict[str, Any]] = Field(default_factory=list)


# ── Agent Loader ──────────────────────────────────────────────────────────────

def _get_founder_edition_dir() -> str:
    """Find the Founder Edition directory."""
    candidates = [
        os.environ.get("FOUNDER_EDITION_DIR", ""),
        "/opt/launchops/launchops-founder-edition",
        "/home/ubuntu/launchops-founder-edition",
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "launchops-founder-edition"),
    ]
    for path in candidates:
        if path and os.path.isdir(os.path.join(path, "agents")):
            return path
    return ""


def _load_agent(agent_id: str, config: Dict[str, Any] = None):
    """
    Load a Founder Edition agent by ID.
    Uses the same AGENT_MAP pattern as agentRunner.py.
    """
    founder_dir = _get_founder_edition_dir()
    if not founder_dir:
        logger.warning(f"Founder Edition directory not found, cannot load agent {agent_id}")
        return None

    if founder_dir not in sys.path:
        sys.path.insert(0, founder_dir)

    # Agent class mapping (mirrors agentRunner.py AGENT_MAP)
    AGENT_MAP = {
        "security-agent": ("agents.security_agent", "SecurityAgent"),
        "paralegal": ("agents.paralegal_bot", "ParalegalBot"),
        "paperwork-agent": ("agents.paralegal_bot", "ParalegalBot"),
        "formation-advisor": ("agents.paralegal_bot", "ParalegalBot"),
        "stripe-agent": ("agents.stripe_agent", "StripeAgent"),
        "wordpress-agent": ("agents.wordpress_agent", "WordPressAgent"),
        "mautic-agent": ("agents.mautic_agent", "MauticAgent"),
        "support-agent": ("agents.support_agent", "SupportAgent"),
        "files-agent": ("agents.files_agent", "FilesAgent"),
        "project-agent": ("agents.project_agent", "ProjectAgent"),
        "analytics-agent": ("agents.analytics_agent", "AnalyticsAgent"),
        "growth-agent": ("agents.growth_agent", "GrowthAgent"),
        "email-agent": ("agents.email_agent", "EmailAgent"),
        "repo-agent": ("agents.repo_agent", "RepoAgent"),
        "business-builder": ("agents.business_builder", "BusinessBuilderAgent"),
        "funding-intelligence": ("agents.funding_intelligence", "FundingIntelligenceAgent"),
        "execai-coach": ("agents.execai_coach", "ExecAICoach"),
        "documentary-tracker": ("agents.documentary_tracker", "DocumentaryTracker"),
        "content-engine": ("agents.content_engine", "ContentEngineAgent"),
        "dynexecutiv": ("agents.dynexecutiv", "DynExecutivAgent"),
        "founder-os": ("agents.founder_os", "FounderOSAgent"),
        "metrics-agent": ("agents.metrics_agent", "MetricsAgent"),
    }

    # Founder method dispatch mapping (for agents that use method dispatch)
    FOUNDER_METHODS = {
        "security-agent": ["audit_infrastructure", "generate_ssl_config", "setup_firewall"],
        "repo-agent": ["create_repository", "setup_cicd", "configure_branch_protection"],
        "stripe-agent": ["create_products", "setup_checkout", "configure_billing"],
        "wordpress-agent": ["deploy_site", "install_theme", "configure_plugins"],
        "email-agent": ["configure_dns", "setup_warmup", "create_templates"],
        "mautic-agent": ["create_campaign", "setup_scoring", "configure_automation"],
        "analytics-agent": ["deploy_matomo", "configure_goals", "setup_dashboard"],
        "support-agent": ["deploy_chatwoot", "configure_automation", "setup_knowledge_base"],
    }

    if agent_id not in AGENT_MAP:
        logger.info(f"Agent {agent_id} not in AGENT_MAP, will use LLM fallback")
        return None

    try:
        import importlib
        module_path, class_name = AGENT_MAP[agent_id]
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)

        # Try to instantiate
        import inspect
        sig = inspect.signature(cls.__init__)
        params = list(sig.parameters.keys())

        kwargs = {}
        if "config" in params:
            kwargs["config"] = config or {}
        if "llm_client" in params:
            kwargs["llm_client"] = _get_llm_client()

        return cls(**kwargs) if kwargs else cls()

    except Exception as exc:
        logger.warning(f"Failed to load agent {agent_id}: {exc}")
        return None


def _get_llm_client():
    """Get OpenAI client for LLM-based execution."""
    try:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if api_key:
            from openai import OpenAI
            return OpenAI(api_key=api_key)
    except Exception:
        pass
    return None


# ── Execution Engine ──────────────────────────────────────────────────────────

async def _execute_manifest(manifest: ManifestPayload):
    """Execute all actions in a manifest sequentially."""
    manifest_id = manifest.manifest_id
    execution = {
        "manifest_id": manifest_id,
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
        "total_actions": len(manifest.actions),
        "completed_actions": 0,
        "failed_actions": 0,
        "current_action": None,
        "results": [],
    }
    _active_executions[manifest_id] = execution

    # Sort actions by sort_order
    sorted_actions = sorted(manifest.actions, key=lambda a: a.sort_order)
    accumulated_context = dict(manifest.business_context.get("accumulated_context", {}))
    halt_on_failure = manifest.execution_config.get("halt_on_failure", True)

    for action in sorted_actions:
        execution["current_action"] = action.label

        # Inject accumulated context
        action_context = {**action.context, **accumulated_context}

        result = await _execute_action(action, action_context)
        execution["results"].append(result)

        if result["success"]:
            execution["completed_actions"] += 1
            # Accumulate output for downstream actions
            if result.get("output"):
                accumulated_context[action.agent_id] = result["output"]
        else:
            execution["failed_actions"] += 1
            if halt_on_failure:
                execution["status"] = "failed"
                break

    # Finalize
    if execution["status"] == "running":
        execution["status"] = "completed" if execution["failed_actions"] == 0 else "partial"

    execution["completed_at"] = datetime.utcnow().isoformat()
    execution["current_action"] = None

    # Move to history
    _execution_history.append(execution)

    # Send callback if configured
    callback_url = manifest.execution_config.get("callback_url")
    if callback_url:
        await _send_callback(callback_url, manifest_id, execution)

    logger.info(
        f"Manifest {manifest_id} execution complete: "
        f"{execution['completed_actions']}/{execution['total_actions']} actions, "
        f"status={execution['status']}"
    )


async def _execute_action(action: ManifestAction, context: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a single action."""
    started_at = datetime.utcnow()
    logger.info(f"Executing action: {action.label} (agent={action.agent_id})")

    try:
        agent = _load_agent(action.agent_id, action.config)

        if agent is None:
            # LLM fallback
            output = await _llm_execute(action, context)
            mode = "llm_fallback"
        elif hasattr(agent, "analyze") and hasattr(agent, "execute"):
            # BaseAgent pattern: analyze → execute
            analysis = agent.analyze(context)
            task = {
                "type": action.config.get("type", "execute"),
                **context,
                **action.config,
                "analysis": analysis,
            }
            output = agent.execute(task)
            mode = "python_agent"
        elif action.method and hasattr(agent, action.method):
            # Method dispatch
            method = getattr(agent, action.method)
            output = method(**action.inputs) if action.inputs else method()
            mode = "method_dispatch"
        elif hasattr(agent, "execute"):
            output = agent.execute(action.config)
            mode = "python_execute"
        else:
            output = await _llm_execute(action, context)
            mode = "llm_fallback"

        # Normalize output
        if isinstance(output, dict):
            if "success" not in output:
                output["success"] = True
        elif output is None:
            output = {"success": True, "message": "Completed (no output)"}
        else:
            output = {"success": True, "data": str(output)}

        return {
            "action_id": action.action_id,
            "agent_id": action.agent_id,
            "label": action.label,
            "success": True,
            "execution_mode": mode,
            "started_at": started_at.isoformat(),
            "completed_at": datetime.utcnow().isoformat(),
            "output": output,
        }

    except Exception as exc:
        logger.exception(f"Action {action.label} failed: {exc}")
        return {
            "action_id": action.action_id,
            "agent_id": action.agent_id,
            "label": action.label,
            "success": False,
            "execution_mode": "error",
            "started_at": started_at.isoformat(),
            "completed_at": datetime.utcnow().isoformat(),
            "error": str(exc),
        }


async def _llm_execute(action: ManifestAction, context: Dict[str, Any]) -> Dict[str, Any]:
    """Execute an action using LLM when no Python agent is available."""
    llm_client = _get_llm_client()
    if not llm_client:
        return {
            "success": True,
            "mode": "placeholder",
            "message": f"Action '{action.label}' queued (no LLM client configured)",
        }

    prompt = f"""You are the {action.agent_id} agent executing a task in the LaunchOps pipeline.

Task: {action.label}
Description: {action.description or 'Execute the assigned task'}

Business Context:
{json.dumps(context, indent=2, default=str)[:2000]}

Configuration:
{json.dumps(action.config, indent=2, default=str)[:1000]}

Provide a structured JSON response with:
- summary: What was accomplished
- actions_taken: List of specific actions
- outputs: Generated artifacts or data
- next_steps: Recommendations for follow-up
"""
    try:
        response = llm_client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": f"You are the {action.agent_id} execution agent."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as exc:
        return {"success": True, "mode": "llm_error", "message": str(exc)}


async def _send_callback(url: str, manifest_id: str, execution: Dict):
    """Send execution results back to LaunchOpsPro."""
    import httpx

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                url,
                json={
                    "manifest_id": manifest_id,
                    "status": execution["status"],
                    "completed_actions": execution["completed_actions"],
                    "failed_actions": execution["failed_actions"],
                    "total_actions": execution["total_actions"],
                },
                timeout=15,
            )
    except Exception as exc:
        logger.error(f"Callback to {url} failed: {exc}")


# ── API Routes ────────────────────────────────────────────────────────────────

@bridge_receiver_router.post("/manifest")
async def receive_manifest(payload: ManifestPayload, background_tasks: BackgroundTasks):
    """
    Receive an Action Manifest from LaunchOpsPro and begin execution.

    This is the primary webhook endpoint that the bridge service calls.
    """
    logger.info(
        f"Received manifest {payload.manifest_id} with {len(payload.actions)} actions "
        f"for business '{payload.business_context.get('business_name', 'unknown')}'"
    )

    # Check for dry_run
    if payload.execution_config.get("dry_run", False):
        agents_required = list(set(a.agent_id for a in payload.actions))
        available_agents = [a for a in agents_required if _load_agent(a) is not None]
        missing_agents = [a for a in agents_required if a not in available_agents]

        return {
            "status": "validated",
            "manifest_id": payload.manifest_id,
            "actions_count": len(payload.actions),
            "agents_required": agents_required,
            "agents_available": available_agents,
            "agents_missing": missing_agents,
            "will_use_llm_fallback": missing_agents,
        }

    # Execute in background
    background_tasks.add_task(_execute_manifest, payload)

    return {
        "status": "accepted",
        "manifest_id": payload.manifest_id,
        "actions_count": len(payload.actions),
        "message": "Execution started. Check /api/bridge/status/{manifest_id} for progress.",
    }


@bridge_receiver_router.get("/status/{manifest_id}")
async def get_execution_status(manifest_id: str):
    """Get the execution status of a manifest."""
    # Check active executions
    if manifest_id in _active_executions:
        return ExecutionStatusResponse(**_active_executions[manifest_id])

    # Check history
    for execution in reversed(_execution_history):
        if execution["manifest_id"] == manifest_id:
            return ExecutionStatusResponse(**execution)

    raise HTTPException(status_code=404, detail="Execution not found")


@bridge_receiver_router.get("/executions")
async def list_executions(limit: int = 20):
    """List recent executions."""
    active = list(_active_executions.values())
    history = _execution_history[-limit:]

    return {
        "active": active,
        "history": history[-limit:],
        "total_active": len(active),
        "total_completed": len(_execution_history),
    }


@bridge_receiver_router.get("/agents")
async def list_available_agents():
    """List all agents available for execution."""
    founder_dir = _get_founder_edition_dir()

    all_agents = [
        "security-agent", "paralegal", "paperwork-agent", "formation-advisor",
        "stripe-agent", "wordpress-agent", "mautic-agent", "support-agent",
        "files-agent", "project-agent", "analytics-agent", "growth-agent",
        "email-agent", "repo-agent", "business-builder", "funding-intelligence",
        "execai-coach", "documentary-tracker", "content-engine", "dynexecutiv",
        "founder-os", "metrics-agent",
    ]

    available = []
    for agent_id in all_agents:
        agent = _load_agent(agent_id)
        available.append({
            "id": agent_id,
            "loaded": agent is not None,
            "type": type(agent).__name__ if agent else "LLM Fallback",
        })

    return {
        "founder_edition_dir": founder_dir,
        "connected": bool(founder_dir),
        "agents": available,
        "total": len(all_agents),
        "loaded": sum(1 for a in available if a["loaded"]),
    }


@bridge_receiver_router.get("/health")
async def bridge_receiver_health():
    """Health check for the bridge receiver."""
    return {
        "status": "ok",
        "service": "founder-edition-bridge-receiver",
        "founder_edition_connected": bool(_get_founder_edition_dir()),
        "active_executions": len(_active_executions),
        "completed_executions": len(_execution_history),
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
