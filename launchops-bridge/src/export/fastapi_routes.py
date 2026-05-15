"""
LaunchOps Bridge — FastAPI Export Routes for LaunchOpsPro Backend

These routes can be mounted directly into the LaunchOpsPro FastAPI backend
(backend/app/main.py) to add manifest export capabilities.

Usage:
    from bridge_export import bridge_router
    app.include_router(bridge_router, prefix="/api/bridge")
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import httpx

# ── Router ────────────────────────────────────────────────────────────────────
bridge_router = APIRouter(tags=["bridge"])

BRIDGE_SERVICE_URL = os.environ.get("BRIDGE_SERVICE_URL", "http://localhost:8002")


# ── Request Models ────────────────────────────────────────────────────────────

class ManifestExportRequest(BaseModel):
    """Request to export a manifest from pipeline results."""
    execution_id: str
    business_name: str
    business_type: str = "saas"
    goal: str
    industry: Optional[str] = None
    steps: List[Dict[str, Any]]
    context_chain: Optional[Dict[str, Any]] = None
    send_to_bridge: bool = False


class ManifestFromContextRequest(BaseModel):
    """Request to generate a manifest from the current execution context."""
    execution_id: str
    send_to_bridge: bool = True


# ── Agent ID Mapping ──────────────────────────────────────────────────────────

AGENT_MAP = {
    "security-agent": "security-agent",
    "paralegal": "paralegal",
    "paperwork-agent": "paperwork-agent",
    "formation-advisor": "formation-advisor",
    "stripe-agent": "stripe-agent",
    "wordpress-agent": "wordpress-agent",
    "mautic-agent": "mautic-agent",
    "support-agent": "support-agent",
    "files-agent": "files-agent",
    "project-agent": "project-agent",
    "analytics-agent": "analytics-agent",
    "growth-agent": "growth-agent",
    "email-agent": "email-agent",
    "repo-agent": "repo-agent",
    "business-builder": "business-builder",
    "funding-intelligence": "funding-intelligence",
    "execai-coach": "execai-coach",
    "documentary-tracker": "documentary-tracker",
    "content-engine": "content-engine",
    "dynexecutiv": "dynexecutiv",
    "founder-os": "founder-os",
    "metrics-agent": "metrics-agent",
    "compliance-agent": "compliance-agent",
    "brand-identity-agent": "brand-identity-agent",
    "product-mvp-agent": "product-mvp-agent",
    "hiring-agent": "hiring-agent",
    "financial-modeling-agent": "financial-modeling-agent",
    "operations-sop-agent": "operations-sop-agent",
    "ip-patent-agent": "ip-patent-agent",
    "customer-success-agent": "customer-success-agent",
}


# ── Routes ────────────────────────────────────────────────────────────────────

@bridge_router.post("/export")
async def export_manifest(req: ManifestExportRequest):
    """
    Export pipeline results as an Action Manifest.

    This endpoint packages the outputs from LaunchOpsPro pipeline stages
    into a standardized Action Manifest that Founder Edition can consume.
    """
    try:
        manifest = _build_manifest(
            execution_id=req.execution_id,
            business_name=req.business_name,
            business_type=req.business_type,
            goal=req.goal,
            industry=req.industry,
            steps=req.steps,
            context_chain=req.context_chain,
        )

        if req.send_to_bridge:
            # Forward to bridge service
            bridge_response = await _send_to_bridge(manifest)
            return {
                "status": "exported_and_sent",
                "manifest_id": manifest["manifest_id"],
                "actions_count": len(manifest["actions"]),
                "bridge_response": bridge_response,
            }

        return {
            "status": "exported",
            "manifest": manifest,
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@bridge_router.get("/export/{execution_id}")
async def get_manifest_for_execution(execution_id: str):
    """
    Generate a manifest for a specific execution by ID.
    Fetches execution data from the LaunchOpsPro database.
    """
    # This would normally query the database
    # For now, return a template manifest structure
    return {
        "status": "ready",
        "message": f"Manifest endpoint ready for execution {execution_id}",
        "instructions": "POST to /api/bridge/export with execution data to generate manifest",
    }


@bridge_router.get("/status")
async def bridge_status():
    """Check the bridge service status."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BRIDGE_SERVICE_URL}/health", timeout=5)
            bridge_health = resp.json()
    except Exception:
        bridge_health = {"status": "unreachable"}

    return {
        "export_endpoint": "active",
        "bridge_service": bridge_health,
        "bridge_url": BRIDGE_SERVICE_URL,
    }


@bridge_router.post("/send/{execution_id}")
async def send_to_founder_edition(execution_id: str, req: ManifestExportRequest):
    """
    Export AND send a manifest to Founder Edition in one call.
    Convenience endpoint that combines export + webhook delivery.
    """
    manifest = _build_manifest(
        execution_id=req.execution_id,
        business_name=req.business_name,
        business_type=req.business_type,
        goal=req.goal,
        industry=req.industry,
        steps=req.steps,
        context_chain=req.context_chain,
    )

    bridge_response = await _send_to_bridge(manifest)

    return {
        "status": "sent",
        "manifest_id": manifest["manifest_id"],
        "actions_count": len(manifest["actions"]),
        "bridge_response": bridge_response,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_manifest(
    execution_id: str,
    business_name: str,
    business_type: str,
    goal: str,
    industry: Optional[str],
    steps: List[Dict[str, Any]],
    context_chain: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    """Build an Action Manifest from provided data."""
    manifest_id = str(uuid.uuid4())
    callback_url = f"{os.environ.get('APP_URL', 'http://localhost:3000')}/api/bridge/callback"

    actions = []
    for i, step in enumerate(steps):
        agent_id = AGENT_MAP.get(step.get("agentId", ""), step.get("agentId", "unknown"))
        config = step.get("config", {})

        action = {
            "action_id": f"action_{uuid.uuid4().hex[:12]}",
            "sort_order": step.get("sortOrder", i),
            "agent_id": agent_id,
            "method": config.pop("_method", None),
            "label": step.get("label", f"Step {i + 1}"),
            "description": step.get("description", ""),
            "execution_mode": "hybrid",
            "priority": _determine_priority(agent_id, i, len(steps)),
            "config": config,
            "context": {},
            "inputs": step.get("inputs", {}),
            "expected_outputs": step.get("expectedOutputs", []),
            "dependencies": [actions[-1]["action_id"]] if actions else [],
            "timeout_seconds": 300,
            "retry_policy": {"max_retries": 2, "backoff_seconds": 5},
        }
        actions.append(action)

    return {
        "manifest_id": manifest_id,
        "version": "1.0.0",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "source": {
            "system": "launchops-pro",
            "execution_id": execution_id,
            "workflow_name": "LaunchOps Pipeline",
        },
        "business_context": {
            "business_name": business_name,
            "business_type": business_type,
            "industry": industry,
            "goal": goal,
            "constraints": {},
            "accumulated_context": context_chain or {},
        },
        "actions": actions,
        "execution_config": {
            "mode": "sequential",
            "halt_on_failure": True,
            "callback_url": callback_url,
            "timeout_seconds": 3600,
            "dry_run": False,
        },
        "metadata": {
            "user_id": "",
            "proof_hashes": [],
            "tags": [],
        },
    }


def _determine_priority(agent_id: str, index: int, total: int) -> str:
    """Determine action priority."""
    critical = {"security-agent", "formation-advisor", "paperwork-agent"}
    high = {"stripe-agent", "repo-agent", "funding-intelligence"}
    if agent_id in critical:
        return "critical"
    if agent_id in high:
        return "high"
    if index < total * 0.3:
        return "high"
    return "medium"


async def _send_to_bridge(manifest: Dict[str, Any]) -> Dict[str, Any]:
    """Send a manifest to the bridge service webhook."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{BRIDGE_SERVICE_URL}/api/bridge/webhook",
                json=manifest,
                timeout=30,
            )
            return resp.json()
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
