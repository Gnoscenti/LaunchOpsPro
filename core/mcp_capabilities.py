"""
MCP Capability Registry — LaunchOps Founder Edition
=====================================================

Central place where LaunchOps agent capabilities are exposed on the shared
MCPGateway. Called once from launchops.py::build_system() after all agents
are instantiated.

Design:
  * Thin wrapper closures translate MCP tool kwargs into the sync agent's
    expected {"type": ..., ...} task dict — no agent changes required.
  * Capabilities are only registered when their owning agent exists in the
    agents dict, so a minimal system (missing optional agents) still works.
  * StripeAgent.create_subscription_tier self-registers in StripeAgent
    __init__ when mcp_gateway is passed, so it's NOT duplicated here.

Add a new capability:
  1. Write a schema describing inputs
  2. Pick (or write) a wrapper function
  3. Call gateway.expose_capability(...) inside register_launchops_capabilities
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict

logger = logging.getLogger("LaunchOps.MCPCapabilities")


# ── Wrapper helpers ─────────────────────────────────────────────────────────


def _task_executor(agent: Any, task_type: str) -> Callable[..., Any]:
    """
    Build an MCP-callable closure that invokes `agent.execute({"type": task_type, **kwargs})`.
    Keeps all existing sync agents usable via MCP without rewriting them.
    """

    def _call(**kwargs: Any) -> Any:
        task = {"type": task_type, **kwargs}
        return agent.execute(task)

    _call.__name__ = f"{task_type}_via_{getattr(agent, 'name', agent.__class__.__name__)}"
    return _call


# ── Schemas ────────────────────────────────────────────────────────────────


_FORMATION_SCHEMA = {
    "type": "object",
    "properties": {
        "business_name": {"type": "string", "description": "Legal entity name"},
        "entity_type": {
            "type": "string",
            "enum": ["LLC", "C-Corporation", "S-Corporation", "Partnership"],
            "description": "Legal entity type",
        },
        "state": {"type": "string", "description": "State of formation (e.g., 'Delaware', 'California')"},
    },
    "required": ["business_name", "entity_type", "state"],
}

_DOCUMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "business_name": {"type": "string"},
        "entity_type": {"type": "string"},
        "state": {"type": "string"},
        "business": {
            "type": "object",
            "description": "Full business config dict (passed through to the generator)",
        },
    },
    "required": ["business_name"],
}

_IP_AUDIT_SCHEMA = {
    "type": "object",
    "properties": {
        "business_name": {"type": "string"},
        "has_code": {"type": "boolean", "default": True},
        "has_brand": {"type": "boolean", "default": True},
        "has_novel_methods": {"type": "boolean", "default": False},
    },
    "required": ["business_name"],
}

_SECURITY_AUDIT_SCHEMA = {
    "type": "object",
    "properties": {
        "scope": {
            "type": "string",
            "enum": ["full", "quick", "network", "secrets"],
            "default": "full",
        },
    },
}

_FUNDING_READINESS_SCHEMA = {
    "type": "object",
    "properties": {
        "entity_type": {"type": "string"},
        "revenue_model": {"type": "string"},
        "monthly_revenue": {"type": "number", "default": 0},
    },
}

_GROWTH_STRATEGY_SCHEMA = {
    "type": "object",
    "properties": {
        "business_name": {"type": "string"},
        "industry": {"type": "string"},
        "target_customer": {"type": "string"},
    },
    "required": ["business_name"],
}


# ── Registration ───────────────────────────────────────────────────────────


def register_launchops_capabilities(
    gateway: Any, agents: Dict[str, Any]
) -> Dict[str, str]:
    """
    Register all LaunchOps agent capabilities on the shared MCPGateway.

    Returns:
        dict mapping capability_name → agent_key that was registered. Useful
        for introspection and audit logs.
    """
    registered: Dict[str, str] = {}

    def _expose(name: str, description: str, schema: Dict, agent_key: str, task_type: str) -> None:
        if agent_key not in agents:
            logger.debug("Skipping MCP capability %s: agent %s not loaded", name, agent_key)
            return
        gateway.expose_capability(
            name=name,
            description=description,
            schema=schema,
            func=_task_executor(agents[agent_key], task_type),
        )
        registered[name] = agent_key

    # ── Paperwork / Legal ───────────────────────────────────────────────────

    _expose(
        name="generate_formation_package",
        description=(
            "Generate a complete corporate formation package: Articles of "
            "Incorporation, Operating Agreement, Bylaws, and EIN filing "
            "instructions for the given entity type and state."
        ),
        schema=_FORMATION_SCHEMA,
        agent_key="paperwork_agent",
        task_type="generate_all",
    )

    _expose(
        name="generate_operating_agreement",
        description="Generate a full Operating Agreement for an LLC or corporation.",
        schema=_DOCUMENT_SCHEMA,
        agent_key="paperwork_agent",
        task_type="generate_operating_agreement",
    )

    _expose(
        name="generate_nda",
        description="Generate a mutual Non-Disclosure Agreement template.",
        schema=_DOCUMENT_SCHEMA,
        agent_key="paperwork_agent",
        task_type="generate_nda",
    )

    _expose(
        name="generate_privacy_policy",
        description="Generate a privacy policy suitable for a SaaS product.",
        schema=_DOCUMENT_SCHEMA,
        agent_key="paperwork_agent",
        task_type="generate_privacy_policy",
    )

    _expose(
        name="generate_terms_of_service",
        description="Generate Terms of Service for a SaaS product.",
        schema=_DOCUMENT_SCHEMA,
        agent_key="paperwork_agent",
        task_type="generate_terms_of_service",
    )

    _expose(
        name="run_ip_audit",
        description=(
            "Run an intellectual property audit to identify protectable "
            "assets and recommend filing priorities."
        ),
        schema=_IP_AUDIT_SCHEMA,
        agent_key="paperwork_agent",
        task_type="ip_audit",
    )

    # ── Security ────────────────────────────────────────────────────────────

    _expose(
        name="run_security_audit",
        description="Run a security audit of the current LaunchOps infrastructure.",
        schema=_SECURITY_AUDIT_SCHEMA,
        agent_key="security_agent",
        task_type="audit",
    )

    # ── Funding ─────────────────────────────────────────────────────────────

    _expose(
        name="funding_readiness_report",
        description=(
            "Evaluate the business's funding readiness for SAFE, "
            "Convertible Note, or Priced Round."
        ),
        schema=_FUNDING_READINESS_SCHEMA,
        agent_key="funding_intelligence",
        task_type="readiness_report",
    )

    # ── Growth ──────────────────────────────────────────────────────────────

    _expose(
        name="generate_growth_strategy",
        description=(
            "Generate a go-to-market growth strategy including channels, "
            "content cadence, and success metrics."
        ),
        schema=_GROWTH_STRATEGY_SCHEMA,
        agent_key="growth_agent",
        task_type="growth_strategy",
    )

    # NOTE: StripeAgent.create_subscription_tier self-registers inside
    # StripeAgent.__init__ when mcp_gateway is provided — do NOT also
    # register it here (would duplicate the entry in gateway.registered_tools).

    logger.info("MCP capabilities registered: %s", sorted(registered.keys()))
    return registered
