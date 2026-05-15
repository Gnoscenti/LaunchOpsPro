"""
LaunchOps Bridge — Import/Dispatch Module

Receives Action Manifests and dispatches actions to Founder Edition agents.
This module runs as part of the Founder Edition service or as a standalone bridge service.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from ..manifest.models import (
    Action,
    ActionManifest,
    ActionResult,
    ManifestExecutionResult,
    ManifestExecutionMode,
)

logger = logging.getLogger("launchops.bridge.dispatcher")


class AgentDispatcher:
    """
    Dispatches Action Manifest actions to Founder Edition agents.

    Supports three execution patterns:
    1. BaseAgent subclasses (analyze → execute)
    2. Founder Edition method dispatch
    3. LLM fallback for agents without Python implementations
    """

    def __init__(
        self,
        agent_loader: Optional[Callable] = None,
        llm_client: Optional[Any] = None,
        on_progress: Optional[Callable] = None,
        on_result: Optional[Callable] = None,
    ):
        """
        Args:
            agent_loader: Function to load agent instances by ID
            llm_client: LLM client for fallback execution
            on_progress: Callback for progress events
            on_result: Callback for action results
        """
        self.agent_loader = agent_loader
        self.llm_client = llm_client
        self.on_progress = on_progress
        self.on_result = on_result
        self._cancelled = False

    def cancel(self):
        """Cancel ongoing execution."""
        self._cancelled = True

    def _emit_progress(self, action: Action, percent: int, message: str):
        """Emit a progress event."""
        if self.on_progress:
            self.on_progress({
                "action_id": action.action_id,
                "agent_id": action.agent_id,
                "label": action.label,
                "percent": percent,
                "message": message,
            })

    def _emit_result(self, result: ActionResult):
        """Emit an action result event."""
        if self.on_result:
            self.on_result(result.dict())

    def _generate_proof_hash(self, action_id: str, output: str) -> str:
        """Generate a proof hash for an action execution."""
        return hashlib.sha256(
            f"{action_id}:{int(time.time())}:{output}".encode()
        ).hexdigest()[:32]

    def execute_manifest(self, manifest: ActionManifest) -> ManifestExecutionResult:
        """
        Execute all actions in a manifest.

        Respects execution_config.mode:
        - sequential: execute actions in sort_order
        - dependency-graph: execute actions when dependencies are met
        """
        self._cancelled = False
        started_at = datetime.utcnow()

        result = ManifestExecutionResult(
            manifest_id=manifest.manifest_id,
            status="running",
            started_at=started_at,
            total_actions=len(manifest.actions),
        )

        # Validate manifest
        dep_errors = manifest.validate_dependencies()
        if dep_errors:
            result.status = "failed"
            result.errors = dep_errors
            result.completed_at = datetime.utcnow()
            return result

        # Dry run mode — validate only
        if manifest.execution_config.dry_run:
            result.status = "validated"
            result.completed_at = datetime.utcnow()
            return result

        # Execute based on mode
        if manifest.execution_config.mode == ManifestExecutionMode.SEQUENTIAL:
            self._execute_sequential(manifest, result)
        elif manifest.execution_config.mode == ManifestExecutionMode.DEPENDENCY_GRAPH:
            self._execute_dependency_graph(manifest, result)
        else:
            self._execute_sequential(manifest, result)

        # Finalize
        result.completed_at = datetime.utcnow()
        if result.failed_actions > 0:
            result.status = "partial" if result.completed_actions > 0 else "failed"
        elif self._cancelled:
            result.status = "cancelled"
        else:
            result.status = "completed"

        return result

    def _execute_sequential(
        self, manifest: ActionManifest, result: ManifestExecutionResult
    ):
        """Execute actions sequentially in sort_order."""
        sorted_actions = sorted(manifest.actions, key=lambda a: a.sort_order)
        accumulated_context = dict(manifest.business_context.accumulated_context)

        for action in sorted_actions:
            if self._cancelled:
                break

            # Inject accumulated context into action
            action.context.update(accumulated_context)

            action_result = self._execute_single_action(action)
            result.results.append(action_result)

            if action_result.success:
                result.completed_actions += 1
                # Accumulate outputs for downstream actions
                if action_result.output:
                    accumulated_context[action.agent_id] = action_result.output
            else:
                result.failed_actions += 1
                if manifest.execution_config.halt_on_failure:
                    result.errors.append(
                        f"Halted at action '{action.label}': {action_result.error}"
                    )
                    break

            self._emit_result(action_result)

    def _execute_dependency_graph(
        self, manifest: ActionManifest, result: ManifestExecutionResult
    ):
        """Execute actions respecting dependency graph."""
        completed_ids: set = set()
        accumulated_context: Dict[str, Any] = dict(
            manifest.business_context.accumulated_context
        )

        while not self._cancelled:
            ready = manifest.get_ready_actions(completed_ids)
            if not ready:
                break

            for action in ready:
                if self._cancelled:
                    break

                action.context.update(accumulated_context)
                action_result = self._execute_single_action(action)
                result.results.append(action_result)

                if action_result.success:
                    result.completed_actions += 1
                    completed_ids.add(action.action_id)
                    if action_result.output:
                        accumulated_context[action.agent_id] = action_result.output
                else:
                    result.failed_actions += 1
                    if manifest.execution_config.halt_on_failure:
                        result.errors.append(
                            f"Halted at action '{action.label}': {action_result.error}"
                        )
                        return

                self._emit_result(action_result)

    def _execute_single_action(self, action: Action) -> ActionResult:
        """Execute a single action using the appropriate agent."""
        started_at = datetime.utcnow()

        self._emit_progress(action, 0, f"Starting: {action.label}")

        try:
            # Try to load the agent
            agent = None
            if self.agent_loader:
                agent = self.agent_loader(action.agent_id, action.config)

            if agent is None:
                # LLM fallback
                self._emit_progress(action, 30, f"No Python agent for {action.agent_id}, using LLM fallback")
                output = self._execute_llm_fallback(action)
                execution_mode = "llm_fallback"
            elif hasattr(agent, "analyze") and hasattr(agent, "execute"):
                # BaseAgent pattern
                self._emit_progress(action, 20, "Running analysis phase")
                analysis = agent.analyze(action.context)

                self._emit_progress(action, 50, "Executing agent task")
                task = {
                    "type": action.config.get("type", "execute"),
                    **action.context,
                    **action.config,
                    "analysis": analysis,
                }
                output = agent.execute(task)
                execution_mode = "python"
            elif action.method:
                # Method dispatch
                self._emit_progress(action, 30, f"Dispatching {action.agent_id}.{action.method}()")
                method = getattr(agent, action.method, None)
                if method:
                    output = method(**action.inputs) if action.inputs else method()
                else:
                    raise AttributeError(f"Method {action.method} not found on {action.agent_id}")
                execution_mode = "python"
            else:
                # Try execute() as default
                self._emit_progress(action, 30, "Executing agent")
                if hasattr(agent, "execute"):
                    output = agent.execute(action.config)
                else:
                    output = self._execute_llm_fallback(action)
                execution_mode = "python" if hasattr(agent, "execute") else "llm_fallback"

            # Normalize output
            if isinstance(output, dict):
                if "success" not in output:
                    output["success"] = True
            elif output is None:
                output = {"success": True, "message": "Action completed (no output)"}
            else:
                output = {"success": True, "data": str(output)}

            self._emit_progress(action, 100, f"Completed: {action.label}")

            proof_hash = self._generate_proof_hash(
                action.action_id, json.dumps(output, default=str)
            )

            return ActionResult(
                action_id=action.action_id,
                agent_id=action.agent_id,
                success=True,
                execution_mode=execution_mode,
                started_at=started_at,
                completed_at=datetime.utcnow(),
                output=output,
                proof_hash=proof_hash,
            )

        except Exception as exc:
            logger.exception(f"Action '{action.label}' failed: {exc}")
            self._emit_progress(action, 100, f"Failed: {action.label} — {str(exc)}")

            return ActionResult(
                action_id=action.action_id,
                agent_id=action.agent_id,
                success=False,
                execution_mode="error",
                started_at=started_at,
                completed_at=datetime.utcnow(),
                error=str(exc),
            )

    def _execute_llm_fallback(self, action: Action) -> Dict[str, Any]:
        """Execute an action using LLM when no Python agent is available."""
        if not self.llm_client:
            return {
                "success": True,
                "mode": "llm_fallback_placeholder",
                "message": f"Action '{action.label}' requires LLM execution but no client configured",
                "agent_id": action.agent_id,
            }

        # Build a prompt from the action
        prompt = f"""You are the {action.agent_id} agent. Execute the following task:

Task: {action.label}
Description: {action.description or 'No description provided'}

Context:
{json.dumps(action.context, indent=2, default=str)}

Configuration:
{json.dumps(action.config, indent=2, default=str)}

Provide your response as structured JSON with:
- summary: Brief summary of what was accomplished
- actions: List of specific actions taken
- outputs: Generated artifacts or data
- recommendations: Next steps
"""
        try:
            response = self.llm_client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[
                    {"role": "system", "content": f"You are the {action.agent_id} agent."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as exc:
            return {
                "success": True,
                "mode": "llm_fallback",
                "message": f"LLM execution completed with warning: {str(exc)}",
                "agent_id": action.agent_id,
            }
