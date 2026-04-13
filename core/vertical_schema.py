"""
Vertical Deployment Schema — Typed configuration for 1-Click deployments
=========================================================================

When the onboarding UI sends a vertical config to `POST /api/v1/onboard`,
this module validates it, resolves the agent roster and governance gates,
and produces a `VerticalDeploymentPlan` that the Phase2Executor can run.

Each vertical (SaaS, E-commerce, Agency, Marketplace) defines:
  - required_agents:      which agents must fire and in what order
  - legal_config:         entity type, jurisdiction, IP assignment
  - billing_config:       revenue model, tiers, trial period
  - governance_gates:     inter-stage dependency checks that PAUSE the
                          pipeline until upstream validations pass

Governance gates are enforced by Phase2Executor between stages. If a
gate's `requires` list includes stages that haven't passed their
validation check, the pipeline emits a `governance_gate_blocked` SSE
event and waits (or fails, depending on `block_on_failure`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────────────────


class EntityType(str, Enum):
    LLC = "LLC"
    C_CORP = "C-Corp"
    S_CORP = "S-Corp"
    SOLE_PROP = "Sole Proprietorship"


class BillingModel(str, Enum):
    RECURRING = "recurring_subscription"
    ONE_TIME = "one_time"
    USAGE_BASED = "usage_based"
    FREEMIUM = "freemium"
    MARKETPLACE_CUT = "marketplace_cut"


class VerticalType(str, Enum):
    SAAS = "saas"
    ECOMMERCE = "ecommerce"
    AGENCY = "agency"
    MARKETPLACE = "marketplace"


# ── Config dataclasses ──────────────────────────────────────────────────────


@dataclass
class LegalConfig:
    entity_preference: EntityType = EntityType.LLC
    jurisdiction: str = "Delaware"
    ip_assignment_required: bool = False
    generate_nda: bool = True
    generate_privacy_policy: bool = True
    generate_terms_of_service: bool = True


@dataclass
class BillingTier:
    name: str
    price_monthly: float
    price_yearly: Optional[float] = None
    features: List[str] = field(default_factory=list)

    def __post_init__(self):
        if self.price_yearly is None:
            self.price_yearly = round(self.price_monthly * 10, 2)  # ~17% discount


@dataclass
class BillingConfig:
    model: BillingModel = BillingModel.RECURRING
    tiers: List[BillingTier] = field(default_factory=list)
    free_trial_days: int = 0
    currency: str = "usd"


@dataclass
class GovernanceGate:
    """
    A gate that must pass before a downstream stage can proceed.

    Fields:
        name:              human-readable gate name
        requires_stages:   upstream stages that must be completed
        validation_checks: list of string keys the orchestrator checks
                           against SharedContext (e.g., "stripe.webhook_verified")
        block_on_failure:  if True, pipeline halts; if False, emits warning
    """
    name: str
    requires_stages: List[str] = field(default_factory=list)
    validation_checks: List[str] = field(default_factory=list)
    block_on_failure: bool = True


@dataclass
class VerticalDeploymentPlan:
    """
    The fully resolved deployment plan sent to Phase2Executor.

    This is the output of `resolve_deployment_plan()` — it includes the
    ordered agent roster, per-agent task configs, and governance gates
    mapped to specific pipeline stages.
    """
    vertical: VerticalType
    business_name: str
    legal_config: LegalConfig
    billing_config: BillingConfig
    required_agents: List[str]
    agent_configs: Dict[str, Dict[str, Any]]
    governance_gates: Dict[str, GovernanceGate]  # keyed by target stage
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        from dataclasses import asdict
        return asdict(self)


# ── SaaS preset ───────────────────────────────────────────────────────────


SAAS_DEFAULT_TIERS = [
    BillingTier(
        name="Explorer",
        price_monthly=29.99,
        features=["5 projects", "10GB storage", "Email support"],
    ),
    BillingTier(
        name="Pro",
        price_monthly=79.00,
        price_yearly=790.00,
        features=["Unlimited projects", "100GB storage", "Priority support", "API access"],
    ),
    BillingTier(
        name="Corporate",
        price_monthly=149.00,
        price_yearly=1490.00,
        features=["Everything in Pro", "SSO", "Dedicated support", "SLA", "Custom integrations"],
    ),
]

SAAS_AGENT_ROSTER = [
    "security_agent",
    "paralegal_bot",
    "paperwork_agent",
    "repo_agent",
    "stripe_agent",
    "wordpress_agent",
    "mautic_agent",
    "email_agent",
    "support_agent",
    "analytics_agent",
    "growth_agent",
    "content_engine",
]

SAAS_GOVERNANCE_GATES = {
    "growth": GovernanceGate(
        name="Pre-GTM Infrastructure Verification",
        requires_stages=["payments", "infrastructure"],
        validation_checks=[
            "stripe.webhook_verified",
            "analytics.tracking_verified",
        ],
        block_on_failure=True,
    ),
    "payments": GovernanceGate(
        name="Legal Formation Before Revenue",
        requires_stages=["formation", "legal"],
        validation_checks=[
            "formation.entity_created",
        ],
        block_on_failure=True,
    ),
}


def build_saas_plan(
    business_name: str,
    entity_preference: str = "C-Corp",
    jurisdiction: str = "Delaware",
    ip_assignment_required: bool = True,
    tiers: Optional[List[Dict[str, Any]]] = None,
    free_trial_days: int = 14,
    **kwargs: Any,
) -> VerticalDeploymentPlan:
    """
    Build a fully resolved SaaS deployment plan from onboarding inputs.

    This is called by `POST /api/v1/onboard` when the user selects "SaaS".
    """
    # Parse billing tiers from user input or use defaults
    billing_tiers = SAAS_DEFAULT_TIERS
    if tiers:
        billing_tiers = [
            BillingTier(
                name=t.get("name", f"Tier {i+1}"),
                price_monthly=float(t.get("price_monthly", 29)),
                price_yearly=t.get("price_yearly"),
                features=t.get("features", []),
            )
            for i, t in enumerate(tiers)
        ]

    legal = LegalConfig(
        entity_preference=EntityType(entity_preference),
        jurisdiction=jurisdiction,
        ip_assignment_required=ip_assignment_required,
        generate_nda=True,
        generate_privacy_policy=True,
        generate_terms_of_service=True,
    )

    billing = BillingConfig(
        model=BillingModel.RECURRING,
        tiers=billing_tiers,
        free_trial_days=free_trial_days,
    )

    # Per-agent task configs derived from the deployment plan
    agent_configs: Dict[str, Dict[str, Any]] = {
        "security_agent": {
            "type": "full_security_setup",
            "business_name": business_name,
        },
        "paralegal_bot": {
            "type": "compliance_check",
            "entity_type": entity_preference,
            "state": jurisdiction,
        },
        "paperwork_agent": {
            "type": "generate_all",
            "business_name": business_name,
            "entity_type": entity_preference,
            "state": jurisdiction,
        },
        "repo_agent": {
            "type": "setup_repository",
            "business_name": business_name,
        },
        "stripe_agent": {
            "type": "setup_products",
            "business_name": business_name,
            "revenue_model": "subscription",
            "products": [
                {
                    "name": t.name,
                    "price": int(t.price_monthly * 100),
                    "interval": "month",
                    "features": t.features,
                }
                for t in billing_tiers
            ],
        },
        "wordpress_agent": {
            "type": "full_setup",
            "business_name": business_name,
            "template": "saas",
        },
        "mautic_agent": {
            "type": "setup_campaigns",
            "business_name": business_name,
            "onboarding_sequence": True,
            "free_trial_days": free_trial_days,
        },
        "email_agent": {
            "type": "welcome_sequence",
        },
        "support_agent": {
            "type": "setup_support",
            "business_name": business_name,
        },
        "analytics_agent": {
            "type": "setup",
            "platform": "matomo",
            "goals": ["pricing_page_view", "checkout_complete", "trial_signup"],
        },
        "growth_agent": {
            "type": "growth_strategy",
            "business_name": business_name,
            "business_type": "saas",
        },
        "content_engine": {
            "type": "generate_calendar",
            "business_name": business_name,
        },
    }

    return VerticalDeploymentPlan(
        vertical=VerticalType.SAAS,
        business_name=business_name,
        legal_config=legal,
        billing_config=billing,
        required_agents=SAAS_AGENT_ROSTER,
        agent_configs=agent_configs,
        governance_gates=SAAS_GOVERNANCE_GATES,
        metadata=kwargs,
    )


# ── Builder registry ──────────────────────────────────────────────────────


VERTICAL_BUILDERS = {
    "saas": build_saas_plan,
    # ecommerce, agency, marketplace builders to be added
}


def resolve_deployment_plan(
    vertical: str, business_name: str, **kwargs: Any
) -> VerticalDeploymentPlan:
    """
    Resolve a vertical name + onboarding inputs into a fully typed
    deployment plan. Raises ValueError if the vertical is unknown.
    """
    builder = VERTICAL_BUILDERS.get(vertical)
    if builder is None:
        raise ValueError(
            f"Unknown vertical: {vertical}. "
            f"Available: {sorted(VERTICAL_BUILDERS.keys())}"
        )
    return builder(business_name=business_name, **kwargs)
