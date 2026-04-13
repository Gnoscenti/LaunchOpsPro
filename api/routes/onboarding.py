"""
Onboarding routes — 1-Click Vertical Deployment
=================================================

Endpoints:
    GET  /api/v1/verticals           list available verticals + their schemas
    POST /api/v1/onboard             receive onboarding config, build a deployment
                                     plan, kick off the governed pipeline, and
                                     return a deployment_id for SSE streaming

The onboarding flow:
    1. Dashboard shows card-select UI (SaaS, E-commerce, Agency, Marketplace)
    2. User answers dynamic questions (entity type, pricing tiers, trial days)
    3. Frontend POSTs to /api/v1/onboard with the config
    4. Backend resolves a VerticalDeploymentPlan via core/vertical_schema.py
    5. Backend kicks off Phase2Executor.run_pipeline with governance gates
    6. Dashboard streams events via /api/v1/atlas/stream/{deployment_id}
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.state import get_atlas
from core.orchestrator import STAGES, Phase2Executor
from core.proofguard import ProofGuardMiddleware
from core.vertical_schema import (
    resolve_deployment_plan,
    VERTICAL_BUILDERS,
    VerticalType,
    SAAS_DEFAULT_TIERS,
    SAAS_AGENT_ROSTER,
)

router = APIRouter(prefix="/api/v1", tags=["onboarding"])


# ── Import the deployment registry from command_center ──────────────────────
# We reuse the same in-memory DEPLOYMENTS dict and Deployment class so
# /api/v1/atlas/stream/{id} works for both manual launches and onboarding.

from api.routes.command_center import Deployment, DEPLOYMENTS, _run_deployment


# ── Request models ──────────────────────────────────────────────────────────


class OnboardBillingTier(BaseModel):
    name: str
    price_monthly: float
    price_yearly: Optional[float] = None
    features: List[str] = Field(default_factory=list)


class OnboardRequest(BaseModel):
    """Body for POST /api/v1/onboard."""

    vertical: str = "saas"
    business_name: str

    # Legal
    entity_preference: str = "C-Corp"
    jurisdiction: str = "Delaware"
    ip_assignment_required: bool = True

    # Billing
    tiers: Optional[List[OnboardBillingTier]] = None
    free_trial_days: int = 14

    # Governance
    enforce_hitl: Optional[bool] = None


# ── Vertical metadata for the card-select UI ───────────────────────────────


VERTICAL_CARDS = [
    {
        "id": "saas",
        "name": "SaaS",
        "tagline": "Subscription software with recurring revenue",
        "icon": "cloud",
        "agents": len(SAAS_AGENT_ROSTER),
        "highlights": [
            "Stripe subscription tiers",
            "14-day free trial flow",
            "Matomo goal tracking",
            "90-day GTM strategy",
        ],
        "questions": [
            {
                "key": "entity_preference",
                "label": "Entity type",
                "type": "select",
                "options": ["C-Corp", "LLC", "S-Corp"],
                "default": "C-Corp",
                "help": "C-Corp recommended for VC fundraising",
            },
            {
                "key": "jurisdiction",
                "label": "Incorporation state",
                "type": "select",
                "options": ["Delaware", "California", "Wyoming", "Nevada"],
                "default": "Delaware",
            },
            {
                "key": "free_trial_days",
                "label": "Free trial length (days)",
                "type": "number",
                "default": 14,
                "min": 0,
                "max": 90,
            },
            {
                "key": "ip_assignment_required",
                "label": "Generate IP Assignment Agreement?",
                "type": "toggle",
                "default": True,
                "help": "Required if you wrote code before incorporating",
            },
        ],
        "default_tiers": [
            {"name": t.name, "price_monthly": t.price_monthly, "features": t.features}
            for t in SAAS_DEFAULT_TIERS
        ],
    },
    {
        "id": "ecommerce",
        "name": "E-Commerce",
        "tagline": "Physical or digital products with one-time sales",
        "icon": "shopping-cart",
        "agents": 10,
        "highlights": [
            "WooCommerce storefront",
            "Stripe checkout",
            "Inventory tracking",
            "Email marketing",
        ],
        "questions": [
            {
                "key": "entity_preference",
                "label": "Entity type",
                "type": "select",
                "options": ["LLC", "C-Corp", "Sole Proprietorship"],
                "default": "LLC",
            },
        ],
        "default_tiers": [],
    },
    {
        "id": "agency",
        "name": "Agency",
        "tagline": "Service business with project-based billing",
        "icon": "briefcase",
        "agents": 9,
        "highlights": [
            "Portfolio site",
            "CRM pipeline",
            "Proposal templates",
            "Referral program",
        ],
        "questions": [
            {
                "key": "entity_preference",
                "label": "Entity type",
                "type": "select",
                "options": ["LLC", "S-Corp"],
                "default": "LLC",
            },
        ],
        "default_tiers": [],
    },
    {
        "id": "marketplace",
        "name": "Marketplace",
        "tagline": "Two-sided platform connecting buyers and sellers",
        "icon": "store",
        "agents": 10,
        "highlights": [
            "Supply + demand pages",
            "Stripe Connect",
            "Community features",
            "SEO playbook",
        ],
        "questions": [
            {
                "key": "entity_preference",
                "label": "Entity type",
                "type": "select",
                "options": ["C-Corp", "LLC"],
                "default": "C-Corp",
            },
        ],
        "default_tiers": [],
    },
]


# ── Routes ──────────────────────────────────────────────────────────────────


@router.get("/verticals")
async def list_verticals() -> Dict[str, Any]:
    """
    Return the vertical card data for the onboarding UI. Each card includes
    its name, tagline, agent count, highlight features, dynamic questions,
    and default billing tiers. The frontend renders these as selectable cards
    and dynamically injects the `questions` form when a card is selected.
    """
    return {
        "verticals": VERTICAL_CARDS,
        "available": sorted(VERTICAL_BUILDERS.keys()),
        "total": len(VERTICAL_CARDS),
    }


@router.post("/onboard")
async def onboard(request: OnboardRequest) -> Dict[str, Any]:
    """
    Receive onboarding config, resolve a VerticalDeploymentPlan, kick off
    the governed pipeline, and return a deployment_id.

    The frontend should immediately connect to
    `GET /api/v1/atlas/stream/{deployment_id}` to receive live SSE events
    including governance_gate_passed, governance_gate_blocked, ui_component,
    and the full Phase 2 event stream.
    """
    # Validate vertical
    if request.vertical not in VERTICAL_BUILDERS:
        available = sorted(VERTICAL_BUILDERS.keys())
        raise HTTPException(
            400,
            f"Unknown vertical: {request.vertical}. Available: {available}. "
            f"E-commerce, Agency, Marketplace builders coming soon.",
        )

    # Resolve the deployment plan
    tiers_raw = None
    if request.tiers:
        tiers_raw = [t.model_dump() for t in request.tiers]

    plan = resolve_deployment_plan(
        vertical=request.vertical,
        business_name=request.business_name,
        entity_preference=request.entity_preference,
        jurisdiction=request.jurisdiction,
        ip_assignment_required=request.ip_assignment_required,
        tiers=tiers_raw,
        free_trial_days=request.free_trial_days,
    )

    # Store the business config so stage handlers can access it
    atlas = get_atlas()
    atlas.context.set("business", {
        "name": request.business_name,
        "type": request.vertical,
        "entity_type": request.entity_preference,
        "state": request.jurisdiction,
        "revenue_model": "subscription" if request.vertical == "saas" else "one-time",
        "domain": f"{request.business_name.lower().replace(' ', '')}.com",
    })

    # Create a deployment with the governance gates from the plan
    deployment_id = f"onboard_{uuid.uuid4().hex[:12]}"
    deployment = Deployment(
        deployment_id=deployment_id,
        payload={
            "vertical": request.vertical,
            "business_name": request.business_name,
            "enforce_hitl": request.enforce_hitl,
            "plan_summary": {
                "agents": plan.required_agents,
                "tiers": [t.name for t in plan.billing_config.tiers],
                "gates": list(plan.governance_gates.keys()),
                "entity": request.entity_preference,
                "jurisdiction": request.jurisdiction,
            },
        },
    )
    DEPLOYMENTS[deployment_id] = deployment

    # Build the executor with governance gates from the vertical plan
    proofguard = ProofGuardMiddleware(
        hitl_enabled=request.enforce_hitl,
    )
    executor = Phase2Executor(
        atlas,
        proofguard=proofguard,
        governance_gates=plan.governance_gates,
    )

    # Run the pipeline in the background
    async def _run_onboarding():
        deployment.status = "running"
        try:
            async for event_name, data in executor.run_pipeline():
                await deployment.queue.put((event_name, data))
                deployment.event_count += 1
            deployment.status = "completed"
        except Exception as e:
            deployment.status = "failed"
            deployment.last_error = str(e)
            await deployment.queue.put((
                "pipeline_error",
                {"error": str(e), "timestamp": datetime.utcnow().isoformat()},
            ))
        finally:
            deployment.completed_at = datetime.utcnow()
            await deployment.queue.put(("__stream_end__", None))

    deployment.task = asyncio.create_task(_run_onboarding())

    return {
        "status": "Deployment Initiated",
        "deployment_id": deployment_id,
        "stream_url": f"/api/v1/atlas/stream/{deployment_id}",
        "vertical": request.vertical,
        "business_name": request.business_name,
        "plan": {
            "agents": plan.required_agents,
            "governance_gates": list(plan.governance_gates.keys()),
            "billing_tiers": [
                {"name": t.name, "price_monthly": t.price_monthly}
                for t in plan.billing_config.tiers
            ],
            "legal": {
                "entity": request.entity_preference,
                "jurisdiction": request.jurisdiction,
                "ip_assignment": request.ip_assignment_required,
            },
        },
        "started_at": deployment.started_at.isoformat(),
    }
