"""
LaunchOps Bridge — Export Module

Generates Action Manifests from LaunchOpsPro execution data.
This module is designed to be integrated into the LaunchOpsPro backend
as a new API endpoint.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..manifest.models import (
    ActionManifest,
    Action,
    ManifestSource,
    BusinessContext,
    ExecutionConfig,
    ManifestMetadata,
    ExecutionMode,
    ActionPriority,
    BusinessType,
)


# Agent ID mapping from LaunchOpsPro registry to Founder Edition AGENT_MAP
AGENT_ID_MAP = {
    # Direct mappings (same ID in both systems)
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
    # Aliases for common variations
    "security": "security-agent",
    "legal": "paralegal",
    "stripe": "stripe-agent",
    "wordpress": "wordpress-agent",
    "mautic": "mautic-agent",
    "support": "support-agent",
    "files": "files-agent",
    "project": "project-agent",
    "analytics": "analytics-agent",
    "growth": "growth-agent",
    "email": "email-agent",
    "repo": "repo-agent",
}


def map_execution_mode(mode: str) -> ExecutionMode:
    """Map LaunchOpsPro execution mode to manifest execution mode."""
    mode_map = {
        "python": ExecutionMode.PYTHON,
        "llm": ExecutionMode.LLM,
        "hybrid": ExecutionMode.HYBRID,
    }
    return mode_map.get(mode, ExecutionMode.HYBRID)


def determine_priority(agent_id: str, sort_order: int, total_steps: int) -> ActionPriority:
    """Determine action priority based on agent type and position."""
    critical_agents = {"security-agent", "formation-advisor", "paperwork-agent"}
    high_agents = {"stripe-agent", "repo-agent", "funding-intelligence"}

    if agent_id in critical_agents:
        return ActionPriority.CRITICAL
    if agent_id in high_agents:
        return ActionPriority.HIGH
    if sort_order < total_steps * 0.3:
        return ActionPriority.HIGH
    return ActionPriority.MEDIUM


def export_manifest_from_execution(
    execution_data: Dict[str, Any],
    steps: List[Dict[str, Any]],
    context_chain: Optional[Dict[str, Any]] = None,
    callback_url: Optional[str] = None,
) -> ActionManifest:
    """
    Generate an Action Manifest from a LaunchOpsPro execution.

    Args:
        execution_data: The execution record from LaunchOpsPro DB
        steps: Ordered list of workflow steps with their configs
        context_chain: Accumulated context from the execution
        callback_url: URL to POST results back to

    Returns:
        A fully-formed ActionManifest ready for Founder Edition consumption
    """
    execution_id = str(execution_data.get("id", "unknown"))
    workflow_id = str(execution_data.get("workflowId", ""))
    workflow_name = execution_data.get("workflowName", "LaunchOps Pipeline")

    # Extract business context from the first step's output or execution metadata
    results = execution_data.get("results", {}) or {}
    first_step_output = results.get("steps", [{}])[0] if results.get("steps") else {}

    business_name = (
        execution_data.get("businessName")
        or first_step_output.get("output", {}).get("business_name")
        or "Unnamed Business"
    )
    business_type_raw = execution_data.get("businessType", "saas")
    goal = execution_data.get("goal", "Launch business")

    # Build actions from steps
    actions = []
    total_steps = len(steps)

    for i, step in enumerate(steps):
        agent_id_raw = step.get("agentId", "")
        agent_id = AGENT_ID_MAP.get(agent_id_raw, agent_id_raw)

        # Determine method for method-dispatch agents
        config = step.get("config", {}) or {}
        method = config.pop("_method", None)

        # Build context for this action from the context chain
        action_context = {}
        if context_chain and "steps" in context_chain:
            # Include outputs from prior steps that this agent needs
            for prior_step in context_chain["steps"]:
                if prior_step.get("agentId") != agent_id_raw:
                    action_context[prior_step.get("agentId", "unknown")] = (
                        prior_step.get("chainableOutput", {})
                    )

        # Determine dependencies (previous action in sequential mode)
        dependencies = []
        if i > 0:
            dependencies.append(actions[i - 1].action_id)

        action = Action(
            action_id=f"action_{uuid.uuid4().hex[:12]}",
            sort_order=i,
            agent_id=agent_id,
            method=method,
            label=step.get("label", f"Step {i + 1}"),
            description=step.get("description", ""),
            execution_mode=map_execution_mode(step.get("executionMode", "hybrid")),
            priority=determine_priority(agent_id, i, total_steps),
            config=config,
            context=action_context,
            inputs=step.get("inputs", {}),
            expected_outputs=step.get("expectedOutputs", []),
            dependencies=dependencies,
            timeout_seconds=step.get("timeout", 300),
        )
        actions.append(action)

    # Build the manifest
    manifest = ActionManifest(
        manifest_id=str(uuid.uuid4()),
        version="1.0.0",
        created_at=datetime.utcnow(),
        source=ManifestSource(
            system="launchops-pro",
            execution_id=execution_id,
            workflow_id=workflow_id,
            workflow_name=workflow_name,
        ),
        business_context=BusinessContext(
            business_name=business_name,
            business_type=BusinessType(business_type_raw) if business_type_raw in BusinessType.__members__.values() else BusinessType.SAAS,
            industry=execution_data.get("industry"),
            goal=goal,
            constraints=execution_data.get("constraints", {}),
            accumulated_context=context_chain or {},
        ),
        actions=actions,
        execution_config=ExecutionConfig(
            mode="sequential",
            halt_on_failure=True,
            callback_url=callback_url,
            timeout_seconds=3600,
            dry_run=False,
        ),
        metadata=ManifestMetadata(
            user_id=str(execution_data.get("userId", "")),
            proof_hashes=execution_data.get("proofHashes", []),
            tags=execution_data.get("tags", []),
        ),
    )

    return manifest


def export_manifest_from_template(
    template_definition: Dict[str, Any],
    business_context: Dict[str, Any],
    callback_url: Optional[str] = None,
) -> ActionManifest:
    """
    Generate an Action Manifest from a workflow template definition.
    Useful for creating manifests before execution (pre-planning).

    Args:
        template_definition: The template's `definition` JSON (contains steps array)
        business_context: User-provided business context
        callback_url: URL to POST results back to

    Returns:
        A pre-execution ActionManifest
    """
    steps = template_definition.get("steps", [])

    actions = []
    total_steps = len(steps)

    for i, step in enumerate(steps):
        agent_id_raw = step.get("agentId", "")
        agent_id = AGENT_ID_MAP.get(agent_id_raw, agent_id_raw)

        dependencies = []
        if i > 0:
            dependencies.append(actions[i - 1].action_id)

        action = Action(
            action_id=f"action_{uuid.uuid4().hex[:12]}",
            sort_order=step.get("sortOrder", i),
            agent_id=agent_id,
            label=step.get("label", f"Step {i + 1}"),
            description=step.get("description", ""),
            execution_mode=ExecutionMode.HYBRID,
            priority=determine_priority(agent_id, i, total_steps),
            config=step.get("config", {}),
            context={},
            dependencies=dependencies,
        )
        actions.append(action)

    manifest = ActionManifest(
        manifest_id=str(uuid.uuid4()),
        version="1.0.0",
        created_at=datetime.utcnow(),
        source=ManifestSource(
            system="launchops-pro",
            execution_id=f"template_{uuid.uuid4().hex[:8]}",
            workflow_name=business_context.get("workflow_name", "Template Pipeline"),
        ),
        business_context=BusinessContext(
            business_name=business_context.get("business_name", "New Business"),
            business_type=BusinessType(business_context.get("business_type", "saas")),
            goal=business_context.get("goal", "Launch business"),
            constraints=business_context.get("constraints", {}),
        ),
        actions=actions,
        execution_config=ExecutionConfig(
            callback_url=callback_url,
        ),
    )

    return manifest
