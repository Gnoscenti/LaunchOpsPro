"""
LaunchOps Bridge — API Server

Standalone FastAPI service that provides:
1. Export endpoint: Generates Action Manifests from LaunchOpsPro execution data
2. Import/Webhook endpoint: Receives manifests and dispatches to Founder Edition agents
3. Status/Health endpoints for monitoring

Designed to run alongside LaunchOpsPro on the same VPS or as a separate microservice.
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

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.manifest.models import (
    ActionManifest,
    Action,
    ActionResult,
    ManifestExecutionResult,
    ManifestSource,
    BusinessContext,
    ExecutionConfig,
    ManifestMetadata,
    BusinessType,
)
from src.export.exporter import export_manifest_from_execution, export_manifest_from_template
from src.receiver.dispatcher import AgentDispatcher

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("launchops.bridge")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="LaunchOps Bridge",
    description="Bridge service connecting LaunchOpsPro (brain) to Founder Edition (hands)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory stores ─────────────────────────────────────────────────────────
_manifests: Dict[str, ActionManifest] = {}
_execution_results: Dict[str, ManifestExecutionResult] = {}
_execution_tasks: Dict[str, asyncio.Task] = {}


# ── Request/Response Models ──────────────────────────────────────────────────

class ExportRequest(BaseModel):
    """Request to generate a manifest from LaunchOpsPro execution data."""
    execution_id: str
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None
    business_name: str
    business_type: str = "saas"
    goal: str
    industry: Optional[str] = None
    constraints: Dict[str, Any] = {}
    steps: List[Dict[str, Any]]
    context_chain: Optional[Dict[str, Any]] = None
    callback_url: Optional[str] = None


class ImportRequest(BaseModel):
    """Request to import and execute a manifest."""
    manifest: ActionManifest
    execute_immediately: bool = True
    dry_run: bool = False


class TemplateExportRequest(BaseModel):
    """Request to generate a manifest from a workflow template."""
    template_definition: Dict[str, Any]
    business_name: str
    business_type: str = "saas"
    goal: str
    workflow_name: Optional[str] = None
    constraints: Dict[str, Any] = {}
    callback_url: Optional[str] = None


class ManifestStatusResponse(BaseModel):
    manifest_id: str
    status: str
    total_actions: int
    completed_actions: int = 0
    failed_actions: int = 0
    errors: List[str] = []


# ── Health & Status ──────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "launchops-bridge",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "manifests_stored": len(_manifests),
        "active_executions": len(_execution_tasks),
    }


@app.get("/api/bridge/status")
async def bridge_status():
    """Detailed bridge status."""
    return {
        "status": "running",
        "manifests": {
            "total": len(_manifests),
            "ids": list(_manifests.keys())[-10:],  # Last 10
        },
        "executions": {
            "total": len(_execution_results),
            "active": sum(1 for r in _execution_results.values() if r.status == "running"),
            "completed": sum(1 for r in _execution_results.values() if r.status == "completed"),
            "failed": sum(1 for r in _execution_results.values() if r.status in ("failed", "partial")),
        },
        "founder_edition_connected": _check_founder_edition_connection(),
    }


def _check_founder_edition_connection() -> bool:
    """Check if Founder Edition agents are loadable."""
    try:
        founder_dir = os.environ.get("FOUNDER_EDITION_DIR", "")
        if founder_dir and os.path.isdir(os.path.join(founder_dir, "agents")):
            return True
        # Try relative path
        possible_paths = [
            "/opt/launchops/launchops-founder-edition",
            "/home/ubuntu/launchops-founder-edition",
            os.path.join(os.path.dirname(__file__), "..", "..", "launchops-founder-edition"),
        ]
        for path in possible_paths:
            if os.path.isdir(os.path.join(path, "agents")):
                return True
        return False
    except Exception:
        return False


# ── Export Endpoints ─────────────────────────────────────────────────────────

@app.post("/api/bridge/export", response_model=ActionManifest)
async def export_manifest(req: ExportRequest):
    """
    Generate an Action Manifest from LaunchOpsPro execution data.

    This endpoint is called by LaunchOpsPro after a pipeline run completes
    (or at any stage) to package the outputs into a standardized manifest.
    """
    try:
        execution_data = {
            "id": req.execution_id,
            "workflowId": req.workflow_id,
            "workflowName": req.workflow_name,
            "businessName": req.business_name,
            "businessType": req.business_type,
            "goal": req.goal,
            "industry": req.industry,
            "constraints": req.constraints,
        }

        manifest = export_manifest_from_execution(
            execution_data=execution_data,
            steps=req.steps,
            context_chain=req.context_chain,
            callback_url=req.callback_url,
        )

        # Store the manifest
        _manifests[manifest.manifest_id] = manifest

        logger.info(f"Exported manifest {manifest.manifest_id} with {len(manifest.actions)} actions")
        return manifest

    except Exception as exc:
        logger.exception(f"Export failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/bridge/export/template", response_model=ActionManifest)
async def export_from_template(req: TemplateExportRequest):
    """
    Generate an Action Manifest from a workflow template definition.
    Useful for pre-planning execution before a pipeline run.
    """
    try:
        business_context = {
            "business_name": req.business_name,
            "business_type": req.business_type,
            "goal": req.goal,
            "workflow_name": req.workflow_name,
            "constraints": req.constraints,
        }

        manifest = export_manifest_from_template(
            template_definition=req.template_definition,
            business_context=business_context,
            callback_url=req.callback_url,
        )

        _manifests[manifest.manifest_id] = manifest

        logger.info(f"Exported template manifest {manifest.manifest_id} with {len(manifest.actions)} actions")
        return manifest

    except Exception as exc:
        logger.exception(f"Template export failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Import/Webhook Endpoints ─────────────────────────────────────────────────

@app.post("/api/bridge/import")
async def import_manifest(req: ImportRequest, background_tasks: BackgroundTasks):
    """
    Import an Action Manifest and optionally execute it immediately.

    This is the primary webhook endpoint that Founder Edition listens on.
    LaunchOpsPro POSTs manifests here after pipeline completion.
    """
    manifest = req.manifest

    # Store the manifest
    _manifests[manifest.manifest_id] = manifest

    # Override dry_run if specified in request
    if req.dry_run:
        manifest.execution_config.dry_run = True

    if req.execute_immediately and not req.dry_run:
        # Execute in background
        background_tasks.add_task(_execute_manifest_background, manifest)
        return {
            "status": "accepted",
            "manifest_id": manifest.manifest_id,
            "message": f"Manifest accepted with {len(manifest.actions)} actions. Execution started.",
            "status_url": f"/api/bridge/manifest/{manifest.manifest_id}/status",
        }
    elif req.dry_run:
        # Validate only
        errors = manifest.validate_dependencies()
        return {
            "status": "validated",
            "manifest_id": manifest.manifest_id,
            "actions_count": len(manifest.actions),
            "validation_errors": errors,
            "agents_required": list(set(a.agent_id for a in manifest.actions)),
        }
    else:
        return {
            "status": "stored",
            "manifest_id": manifest.manifest_id,
            "message": "Manifest stored. Call /api/bridge/manifest/{id}/execute to run.",
        }


@app.post("/api/bridge/webhook")
async def webhook_receiver(request: Request, background_tasks: BackgroundTasks):
    """
    Raw webhook endpoint for receiving manifests from LaunchOpsPro.
    Accepts the manifest directly as the request body.
    """
    try:
        body = await request.json()
        manifest = ActionManifest(**body)

        _manifests[manifest.manifest_id] = manifest

        # Auto-execute
        background_tasks.add_task(_execute_manifest_background, manifest)

        return {
            "status": "accepted",
            "manifest_id": manifest.manifest_id,
            "actions_count": len(manifest.actions),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid manifest: {str(exc)}")


# ── Manifest Management ──────────────────────────────────────────────────────

@app.get("/api/bridge/manifests")
async def list_manifests(limit: int = 20):
    """List stored manifests."""
    manifests = list(_manifests.values())[-limit:]
    return {
        "manifests": [
            {
                "manifest_id": m.manifest_id,
                "workflow_name": m.source.workflow_name,
                "business_name": m.business_context.business_name,
                "actions_count": len(m.actions),
                "created_at": m.created_at.isoformat(),
            }
            for m in manifests
        ],
        "total": len(_manifests),
    }


@app.get("/api/bridge/manifest/{manifest_id}")
async def get_manifest(manifest_id: str):
    """Get a specific manifest by ID."""
    manifest = _manifests.get(manifest_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")
    return manifest


@app.get("/api/bridge/manifest/{manifest_id}/status")
async def get_manifest_status(manifest_id: str):
    """Get execution status for a manifest."""
    result = _execution_results.get(manifest_id)
    if not result:
        if manifest_id in _manifests:
            return {"manifest_id": manifest_id, "status": "pending", "message": "Not yet executed"}
        raise HTTPException(status_code=404, detail="Manifest not found")

    return ManifestStatusResponse(
        manifest_id=result.manifest_id,
        status=result.status,
        total_actions=result.total_actions,
        completed_actions=result.completed_actions,
        failed_actions=result.failed_actions,
        errors=result.errors,
    )


@app.post("/api/bridge/manifest/{manifest_id}/execute")
async def execute_stored_manifest(manifest_id: str, background_tasks: BackgroundTasks):
    """Execute a previously stored manifest."""
    manifest = _manifests.get(manifest_id)
    if not manifest:
        raise HTTPException(status_code=404, detail="Manifest not found")

    if manifest_id in _execution_results and _execution_results[manifest_id].status == "running":
        raise HTTPException(status_code=400, detail="Manifest is already being executed")

    background_tasks.add_task(_execute_manifest_background, manifest)

    return {
        "status": "started",
        "manifest_id": manifest_id,
        "message": f"Execution started for {len(manifest.actions)} actions",
    }


@app.post("/api/bridge/manifest/{manifest_id}/cancel")
async def cancel_execution(manifest_id: str):
    """Cancel a running manifest execution."""
    if manifest_id not in _execution_results:
        raise HTTPException(status_code=404, detail="No execution found for this manifest")

    # Signal cancellation
    if manifest_id in _execution_tasks:
        _execution_tasks[manifest_id].cancel()

    return {"status": "cancellation_requested", "manifest_id": manifest_id}


@app.get("/api/bridge/manifest/{manifest_id}/results")
async def get_execution_results(manifest_id: str):
    """Get detailed execution results for a manifest."""
    result = _execution_results.get(manifest_id)
    if not result:
        raise HTTPException(status_code=404, detail="No execution results found")
    return result


# ── Callback Endpoint (for Founder Edition to report back) ───────────────────

@app.post("/api/bridge/callback/{manifest_id}")
async def receive_callback(manifest_id: str, request: Request):
    """
    Receive execution results from Founder Edition.
    This endpoint is set as the callback_url in manifests.
    """
    body = await request.json()

    if manifest_id in _execution_results:
        # Update existing result
        result = _execution_results[manifest_id]
        if "action_result" in body:
            action_result = ActionResult(**body["action_result"])
            result.results.append(action_result)
            if action_result.success:
                result.completed_actions += 1
            else:
                result.failed_actions += 1
    else:
        # Create new result from callback
        _execution_results[manifest_id] = ManifestExecutionResult(
            manifest_id=manifest_id,
            status=body.get("status", "unknown"),
            started_at=datetime.utcnow(),
            total_actions=body.get("total_actions", 0),
        )

    return {"status": "received", "manifest_id": manifest_id}


# ── Background Execution ─────────────────────────────────────────────────────

async def _execute_manifest_background(manifest: ActionManifest):
    """Execute a manifest in the background using the AgentDispatcher."""
    logger.info(f"Starting background execution for manifest {manifest.manifest_id}")

    # Initialize the dispatcher
    dispatcher = AgentDispatcher(
        agent_loader=_load_founder_edition_agent,
        llm_client=_get_llm_client(),
        on_progress=lambda p: logger.info(f"Progress: {p}"),
        on_result=lambda r: logger.info(f"Result: {r.get('action_id')} — success={r.get('success')}"),
    )

    # Execute
    result = dispatcher.execute_manifest(manifest)
    _execution_results[manifest.manifest_id] = result

    logger.info(
        f"Manifest {manifest.manifest_id} execution complete: "
        f"{result.completed_actions}/{result.total_actions} actions, "
        f"status={result.status}"
    )

    # Send callback if configured
    if manifest.execution_config.callback_url:
        await _send_callback(manifest.execution_config.callback_url, result)


async def _send_callback(url: str, result: ManifestExecutionResult):
    """Send execution results back to LaunchOpsPro."""
    import httpx

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=result.dict(default=str),
                timeout=30,
            )
            logger.info(f"Callback sent to {url}: status={response.status_code}")
    except Exception as exc:
        logger.error(f"Callback failed: {exc}")


def _load_founder_edition_agent(agent_id: str, config: dict = None):
    """Load a Founder Edition agent by ID."""
    try:
        # Find the Founder Edition agents directory
        founder_dir = os.environ.get("FOUNDER_EDITION_DIR", "")
        if not founder_dir:
            possible_paths = [
                "/opt/launchops/launchops-founder-edition",
                "/home/ubuntu/launchops-founder-edition",
            ]
            for path in possible_paths:
                if os.path.isdir(os.path.join(path, "agents")):
                    founder_dir = path
                    break

        if not founder_dir:
            return None

        if founder_dir not in sys.path:
            sys.path.insert(0, founder_dir)

        # Import from the agentRunner's AGENT_MAP logic
        from agents import base  # noqa: F401

        # Agent mapping (mirrors agentRunner.py)
        agent_map = {
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

        if agent_id not in agent_map:
            return None

        module_path, class_name = agent_map[agent_id]

        import importlib
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)

        # Try to instantiate with llm_client and config
        import inspect
        sig = inspect.signature(cls.__init__)
        params = list(sig.parameters.keys())

        llm_client = _get_llm_client()

        if "llm_client" in params and "config" in params:
            return cls(llm_client=llm_client, config=config or {})
        elif "llm_client" in params:
            return cls(llm_client=llm_client)
        elif "config" in params:
            return cls(config=config or {})
        else:
            return cls()

    except Exception as exc:
        logger.warning(f"Could not load agent {agent_id}: {exc}")
        return None


def _get_llm_client():
    """Get an LLM client from environment variables."""
    try:
        openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if openai_key:
            from openai import OpenAI
            return OpenAI(api_key=openai_key)
    except Exception:
        pass
    return None


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("BRIDGE_PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
