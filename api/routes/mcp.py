"""
MCP Gateway HTTP facade — inbound /mcp/discover endpoint
=========================================================

Exposes LaunchOps's registered MCPGateway capabilities over HTTP so that
external agents (a partner's Bank Agent, Vendor Agent, etc.) can discover
what this system offers and invoke capabilities through a standard
JSON-over-HTTP contract.

Endpoints:
    GET  /mcp/discover             list registered capabilities (read-only)
    POST /mcp/discover             same as GET but accepts a scope filter
    POST /mcp/invoke               invoke a registered capability by name
    GET  /mcp/health               liveness + registered-tool count

Security model:
    Every invocation flows through ProofGuardMiddleware.attest_action()
    before the capability is executed, so external callers can't bypass
    the governance layer even when they hit /mcp/invoke directly.
    Set EXTERNAL_MCP_TOKEN in the environment to require a Bearer token
    on all /mcp/* endpoints; if unset, endpoints are open (local dev).
"""

from __future__ import annotations

import asyncio
import inspect
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from api.state import get_atlas
from core.proofguard import (
    ProofGuardMiddleware,
    SecurityError,
    STATUS_APPROVED,
    STATUS_BLOCKED,
    STATUS_REJECTED,
    STATUS_REQUIRES_HITL,
)

router = APIRouter(prefix="/mcp", tags=["mcp"])


# ── Auth ────────────────────────────────────────────────────────────────────


def _require_token(authorization: Optional[str]) -> None:
    expected = os.getenv("EXTERNAL_MCP_TOKEN", "")
    if not expected:
        return  # Open mode for local dev
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")
    if authorization.removeprefix("Bearer ").strip() != expected:
        raise HTTPException(403, "Invalid MCP token")


# ── Discovery ───────────────────────────────────────────────────────────────


class DiscoverRequest(BaseModel):
    scope: Optional[str] = None
    include_schemas: bool = True


def _get_gateway():
    atlas = get_atlas()
    # MCPGateway is stored on the build_system dict, not on atlas directly.
    # Recover it from atlas.context if launchops.py attached it, otherwise
    # create a fresh one (it will have no registrations).
    from core.mcp_gateway import MCPGateway

    gateway = getattr(atlas, "mcp_gateway", None)
    if gateway is None:
        # Attempt recovery from the launchops build dict via a module-level
        # import; if that fails, build an empty one so /mcp/discover still
        # responds instead of 500ing.
        try:
            import launchops  # type: ignore

            system = getattr(launchops, "_SYSTEM", None)
            if system and system.get("mcp_gateway"):
                gateway = system["mcp_gateway"]
        except Exception:
            pass
    if gateway is None:
        gateway = MCPGateway()
    return gateway


@router.get("/discover")
async def discover_get(
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """List every MCP capability registered on the shared gateway."""
    _require_token(authorization)
    gateway = _get_gateway()
    capabilities = gateway.list_capabilities()
    return {
        "server": "launchops-mcp",
        "version": "3.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "capability_count": len(capabilities),
        "capabilities": capabilities,
    }


@router.post("/discover")
async def discover_post(
    request: DiscoverRequest,
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Same as GET /mcp/discover but accepts a scope filter. If `scope` is
    supplied, only capabilities whose name starts with that prefix are
    returned (e.g. scope="stripe." → create_saas_subscription).
    """
    _require_token(authorization)
    gateway = _get_gateway()
    capabilities: List[Dict[str, Any]] = gateway.list_capabilities()

    if request.scope:
        capabilities = [c for c in capabilities if c["name"].startswith(request.scope)]

    if not request.include_schemas:
        capabilities = [
            {"name": c["name"], "description": c.get("description", "")}
            for c in capabilities
        ]

    return {
        "server": "launchops-mcp",
        "version": "3.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "scope": request.scope,
        "capability_count": len(capabilities),
        "capabilities": capabilities,
    }


# ── Invocation ──────────────────────────────────────────────────────────────


class InvokeRequest(BaseModel):
    name: str
    arguments: Dict[str, Any] = {}
    stage: Optional[str] = "mcp_external"
    agent: Optional[str] = "external_caller"
    risk_tier: Optional[str] = "medium"
    skip_governance: bool = False  # Dev only — ignored when token is set


@router.post("/invoke")
async def invoke(
    request: InvokeRequest,
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Invoke a registered MCP capability. Every call goes through ProofGuard
    attestation first unless `skip_governance` is set AND EXTERNAL_MCP_TOKEN
    is unset (local dev shortcut).
    """
    _require_token(authorization)
    gateway = _get_gateway()

    if request.name not in gateway.registered_tools:
        raise HTTPException(
            404,
            f"Capability '{request.name}' not registered. "
            f"Check /mcp/discover for available tools.",
        )

    # Governance — an external agent can't bypass this
    governance_required = bool(os.getenv("EXTERNAL_MCP_TOKEN")) or not request.skip_governance
    attestation_id: Optional[str] = None
    cqs_score: Optional[int] = None

    if governance_required:
        proofguard = ProofGuardMiddleware()
        attestation = await proofguard.attest_action(
            agent_name=request.agent or "external_caller",
            stage=request.stage or "mcp_external",
            proposed_action={
                "capability": request.name,
                "arguments": request.arguments,
            },
            risk_tier=request.risk_tier or "medium",
        )
        attestation_id = attestation.get("attestation_id")
        cqs_score = attestation.get("cqs_score")
        verdict = attestation.get("status")

        if verdict in (STATUS_BLOCKED, STATUS_REJECTED):
            raise HTTPException(
                403,
                {
                    "error": "ProofGuard blocked this invocation",
                    "verdict": verdict,
                    "attestation_id": attestation_id,
                    "reason": attestation.get("reason"),
                },
            )

        if verdict == STATUS_REQUIRES_HITL or proofguard.hitl_enabled:
            # External invocations cannot wait for HITL over HTTP — instead,
            # return a 202 telling the caller to poll the status endpoint.
            raise HTTPException(
                202,
                {
                    "status": "REQUIRES_HITL",
                    "attestation_id": attestation_id,
                    "poll_url": f"/api/attest/status/{attestation_id}",
                    "cqs_score": cqs_score,
                },
            )

    # Execute the capability
    try:
        result = await gateway.invoke_local(request.name, **request.arguments)
    except KeyError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Capability execution failed: {e}")

    return {
        "capability": request.name,
        "status": "completed",
        "attestation_id": attestation_id,
        "cqs_score": cqs_score,
        "result": result,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Health ──────────────────────────────────────────────────────────────────


@router.get("/health")
async def health() -> Dict[str, Any]:
    gateway = _get_gateway()
    return {
        "status": "ok",
        "registered_tools": len(gateway.registered_tools),
        "auth_required": bool(os.getenv("EXTERNAL_MCP_TOKEN")),
        "timestamp": datetime.utcnow().isoformat(),
    }
