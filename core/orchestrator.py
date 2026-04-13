"""
Atlas Orchestrator — LaunchOps Founder Edition
The brain. Coordinates all agents through a stage-aware pipeline.

Phase 1 (sync): no trust boundary, full Tier 3 local execution.
Phase 2 (async, Phase2Executor): propose → ProofGuard attest → HITL → execute,
with SSE-friendly per-agent event streaming for the dashboard.

Stages:
  init → intake → formation → infrastructure → legal → payments →
  funding → coaching → growth → done
"""

import asyncio
import inspect
import logging
import traceback
from datetime import datetime
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Optional

from .config import get_config, LaunchOpsConfig
from .context import SharedContext
from .credentials import get_vault

logger = logging.getLogger("LaunchOps.orchestrator")
from .proofguard import (
    ProofGuardMiddleware,
    SecurityError,
    STATUS_APPROVED,
    STATUS_BLOCKED,
    STATUS_REJECTED,
    STATUS_REQUIRES_HITL,
)


# ── Stage Definitions ─────────────────────────────────────────────────────

STAGES = [
    "init",
    "intake",          # Build Spec intake — define YOUR business
    "formation",       # Entity formation, EIN, bank, compliance
    "infrastructure",  # Docker stack, WordPress, Vaultwarden, Mautic
    "legal",           # Paperwork agent — legal docs package
    "payments",        # Stripe setup
    "funding",         # Funding intelligence report
    "coaching",        # ExecAI strategic review
    "growth",          # Go-to-market execution
    "done",
]


class AtlasOrchestrator:
    """
    Central orchestrator that drives the entire LaunchOps pipeline.
    Manages agent lifecycle, stage transitions, and error recovery.
    """

    def __init__(self, config: Optional[LaunchOpsConfig] = None):
        self.config = config or get_config()
        self.context = SharedContext()
        self.vault = get_vault()
        self.agents: Dict[str, Any] = {}
        self._stage_handlers: Dict[str, Callable] = {}
        self._hooks: Dict[str, List[Callable]] = {"pre_stage": [], "post_stage": []}

    # ── Agent Registration ────────────────────────────────────────────────

    def register_agent(self, name: str, agent: Any):
        """Register an agent. No permission checks — Tier 3."""
        self.agents[name] = agent
        self.context.log(f"Agent registered: {name}", agent="orchestrator")

    def register_stage_handler(self, stage: str, handler: Callable):
        """Register a handler function for a specific stage."""
        self._stage_handlers[stage] = handler

    def register_hook(self, hook_type: str, fn: Callable):
        """Register pre/post stage hooks."""
        self._hooks.setdefault(hook_type, []).append(fn)

    # ── Pipeline Execution ────────────────────────────────────────────────

    def run(self, start_stage: Optional[str] = None, end_stage: Optional[str] = None):
        """
        Run the full pipeline or a subset of stages.
        No guardrails. If an agent fails, log it and continue.
        """
        start_idx = STAGES.index(start_stage) if start_stage else 0
        end_idx = STAGES.index(end_stage) + 1 if end_stage else len(STAGES)
        stages_to_run = STAGES[start_idx:end_idx]

        logger.info(
            "Pipeline started",
            extra={"run_id": self.context.run_id, "stages": stages_to_run},
        )

        self.context.log(f"Pipeline started: {stages_to_run}", agent="orchestrator")

        for stage in stages_to_run:
            self._execute_stage(stage)

        self.context.stage = "done"
        self._print_summary()
        return self.context.to_dict()

    def run_stage(self, stage: str):
        """Run a single stage."""
        if stage not in STAGES:
            raise ValueError(f"Unknown stage: {stage}. Valid: {STAGES}")
        self._execute_stage(stage)

    def _execute_stage(self, stage: str):
        """Execute a single stage with hooks and error handling."""
        logger.info("Stage starting: %s", stage, extra={"stage": stage})

        self.context.stage = stage

        # Pre-stage hooks
        for hook in self._hooks.get("pre_stage", []):
            try:
                hook(stage, self.context)
            except Exception as e:
                self.context.log_error(f"Pre-hook failed: {e}", agent="orchestrator")

        # Execute the stage handler
        handler = self._stage_handlers.get(stage)
        if handler:
            try:
                result = handler(self.context, self.agents, self.config)
                if result:
                    self.context.store_agent_output(f"stage_{stage}", result)
                logger.info("Stage complete: %s", stage, extra={"stage": stage})
            except Exception as e:
                self.context.log_error(
                    f"Stage {stage} failed: {e}\n{traceback.format_exc()}",
                    agent="orchestrator",
                )
                logger.error(
                    "Stage failed: %s — %s", stage, e,
                    extra={"stage": stage},
                    exc_info=True,
                )
        else:
            logger.warning("No handler registered for stage: %s", stage, extra={"stage": stage})

        # Post-stage hooks
        for hook in self._hooks.get("post_stage", []):
            try:
                hook(stage, self.context)
            except Exception as e:
                self.context.log_error(f"Post-hook failed: {e}", agent="orchestrator")

    # ── Status ────────────────────────────────────────────────────────────

    def status(self) -> Dict[str, Any]:
        """Get current orchestrator status."""
        return {
            "run_id": self.context.run_id,
            "stage": self.context.stage,
            "agents_registered": list(self.agents.keys()),
            "stages_with_handlers": list(self._stage_handlers.keys()),
            "errors": len(self.context._data.get("errors", [])),
            "milestones": len(
                self.context._data.get("documentary", {}).get("milestones", [])
            ),
        }

    def _print_summary(self):
        """Log run summary."""
        errors = self.context._data.get("errors", [])
        milestones = self.context._data.get("documentary", {}).get("milestones", [])

        logger.info(
            "Pipeline complete — %d errors, %d milestones, context at %s",
            len(errors),
            len(milestones),
            self.context.path,
            extra={
                "run_id": self.context.run_id,
                "errors": len(errors),
                "milestones": len(milestones),
            },
        )
        for m in milestones:
            logger.info("Milestone: %s", m.get("title", "?"))
        for e in errors[-5:]:
            logger.error(
                "Error [%s]: %s",
                e.get("agent", "?"),
                str(e.get("message", ""))[:120],
            )


# ══════════════════════════════════════════════════════════════════════════
# PHASE 2 — Governed Async Execution Layer
# ══════════════════════════════════════════════════════════════════════════
#
# Phase 2 layers ProofGuard governance on top of the existing sync pipeline:
#
#   1. REFLECTION   agent drafts a plan (propose_plan) but does NOT execute
#   2. GOVERNANCE   plan → ProofGuard.attest_action → CQS score + verdict
#   3. HITL         if REQUIRES_HITL, pause and wait for human approval
#   4. EXECUTION    sync stage handler fires via asyncio.to_thread
#   5. AUDIT        result written back to ProofGuard for reflection scoring
#
# Deterministic control: stage order is the immutable STAGES list; agents
# cannot decide to skip ahead. Per-agent event streaming is designed for
# fastapi.StreamingResponse (SSE) so the dashboard can render live logs.
#
# Backwards compat: the existing AtlasOrchestrator above is untouched. The
# Phase2Executor composes over it rather than replacing it, so the Phase 1
# CLI and existing /atlas/execute endpoint keep working as before.


# ── Per-agent event schema ──────────────────────────────────────────────────

# Events emitted by Phase2Executor.execute_stage / run_pipeline, consumed
# by the SSE endpoint in api/routes/execute_v2.py:
#
#   pipeline_start      {run_id, stages, total, timestamp}
#   stage_start         {stage, index, total, agents}
#   agent_propose       {stage, agent, plan_preview}
#   proofguard_verdict  {stage, agent, status, cqs_score, attestation_id, reason?}
#   hitl_waiting        {stage, agent, attestation_id, dashboard_url?}
#   hitl_resumed        {stage, agent, attestation_id}
#   agent_executing     {stage, agent}
#   ui_component        {type:"ui_component", component, props, source_agent, stage}  # Phase 3
#   agent_result        {stage, agent, status, summary}
#   stage_complete      {stage, index, status, agent_count}
#   stage_error         {stage, index, error}
#   pipeline_complete   {run_id, final_stage, stages_completed, errors, timestamp}
#
# StreamEvent callback signature: async def cb(event: str, data: dict) -> None


StreamCallback = Callable[[str, Dict[str, Any]], Awaitable[None]]


# ── Sync-agent adapters ────────────────────────────────────────────────────


async def _propose_plan_for_agent(
    agent: Any,
    task_payload: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Call `agent.propose_plan(task_payload, context)` if the agent defines it
    (async or sync). Otherwise wrap the task as a passthrough plan so existing
    sync agents work with the governed flow without modification.
    """
    propose = getattr(agent, "propose_plan", None)
    if callable(propose):
        if inspect.iscoroutinefunction(propose):
            return await propose(task_payload, context=context)
        return await asyncio.to_thread(propose, task_payload, context)

    agent_name = getattr(agent, "name", agent.__class__.__name__)
    return {
        "agent": agent_name,
        "plan_type": "passthrough",
        "task": task_payload,
        "rationale": f"{agent_name} has no propose_plan(); executing task as-is.",
    }


async def _execute_plan_for_agent(agent: Any, plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a ProofGuard-approved plan against an agent.

    Priority order:
      1. async `agent.execute(plan)` — for native async agents
      2. sync `agent.execute(task)` in a worker thread — for BaseAgent subclasses
    """
    execute = getattr(agent, "execute", None)
    if not callable(execute):
        return {"success": False, "error": f"{agent!r} has no execute() method"}

    # Sync BaseAgent agents expect the original task dict, not the wrapper
    task = plan.get("task", plan) if isinstance(plan, dict) else plan

    if inspect.iscoroutinefunction(execute):
        return await execute(plan)
    return await asyncio.to_thread(execute, task)


# ── Phase 2 Executor ───────────────────────────────────────────────────────


class Phase2Executor:
    """
    Governed async executor for the LaunchOps pipeline.

    Composes over an existing AtlasOrchestrator (Phase 1), reusing its
    stage handlers and agent registry, while adding the ProofGuard
    propose → attest → HITL → execute pipeline.

    Typical usage (inside an SSE endpoint):

        executor = Phase2Executor(atlas)
        async for event_name, payload in executor.run_pipeline(start, end):
            yield sse_event(event_name, payload)
    """

    def __init__(
        self,
        atlas: AtlasOrchestrator,
        proofguard: Optional[ProofGuardMiddleware] = None,
        governance_gates: Optional[Dict[str, Any]] = None,
    ):
        self.atlas = atlas
        self.proofguard = proofguard or ProofGuardMiddleware()
        self.state: Dict[str, Any] = {}
        # Governance gates: keyed by target stage name.  Each gate has
        #   requires_stages, validation_checks, block_on_failure.
        # Set by the onboarding flow via VerticalDeploymentPlan.governance_gates.
        self._governance_gates = governance_gates or {}

    # ── Single-agent governed execution ───────────────────────────────────

    async def execute_stage_for_agent(
        self,
        stage_name: str,
        agent: Any,
        task_payload: Dict[str, Any],
        stream: Optional[StreamCallback] = None,
    ) -> Dict[str, Any]:
        """
        Run one agent through a governed stage. Matches the user-provided
        Phase 2 spec: propose → attest → (HITL) → execute → audit.
        """
        agent_name = getattr(agent, "name", agent.__class__.__name__)

        async def emit(event: str, data: Dict[str, Any]) -> None:
            if stream is not None:
                await stream(event, data)

        # 1. REFLECTION — agent drafts the plan but does NOT execute it yet
        proposed = await _propose_plan_for_agent(agent, task_payload, self.state)
        await emit(
            "agent_propose",
            {
                "stage": stage_name,
                "agent": agent_name,
                "plan_preview": _summarize(proposed, limit=240),
            },
        )

        # 2. GOVERNANCE — send plan to ProofGuard for CQS scoring
        attestation = await self.proofguard.attest_action(
            agent_name=agent_name,
            stage=stage_name,
            proposed_action=proposed,
        )

        status = attestation.get("status")
        cqs_score = attestation.get("cqs_score", 0)
        attestation_id = attestation.get("attestation_id")

        await emit(
            "proofguard_verdict",
            {
                "stage": stage_name,
                "agent": agent_name,
                "status": status,
                "cqs_score": cqs_score,
                "attestation_id": attestation_id,
                "reason": attestation.get("reason"),
            },
        )

        # 3. ENFORCEMENT
        if status in (STATUS_BLOCKED, STATUS_REJECTED):
            raise SecurityError(
                f"ProofGuard blocked {agent_name} at {stage_name}: "
                f"{attestation.get('reason', 'no reason provided')}"
            )

        if status == STATUS_REQUIRES_HITL or self.proofguard.hitl_enabled:
            await emit(
                "hitl_waiting",
                {
                    "stage": stage_name,
                    "agent": agent_name,
                    "attestation_id": attestation_id,
                },
            )
            await self.proofguard.wait_for_hitl(attestation_id)
            await emit(
                "hitl_resumed",
                {
                    "stage": stage_name,
                    "agent": agent_name,
                    "attestation_id": attestation_id,
                },
            )

        # 4. EXECUTION
        await emit("agent_executing", {"stage": stage_name, "agent": agent_name})
        try:
            result = await _execute_plan_for_agent(agent, proposed)
            success = _is_success(result)
        except Exception as e:
            result = {"success": False, "error": str(e)}
            success = False

        # Persist result in shared memory for downstream agents
        self.state.setdefault(stage_name, {})[agent_name] = result

        # Phase 3: Extract Generative UI payloads and emit a dedicated
        # `ui_component` event per widget. The frontend's component
        # registry dispatches on the `component` field.
        try:
            from .generative_ui import extract_ui_payloads

            ui_payloads, _ = extract_ui_payloads(result)
            for payload in ui_payloads:
                # Stamp attribution if the agent didn't
                payload.setdefault("source_agent", agent_name)
                payload.setdefault("stage", stage_name)
                await emit("ui_component", payload)
        except Exception as e:
            # Never let GUI extraction break the pipeline
            import logging

            logging.getLogger("launchops.orchestrator").debug(
                "GUI payload extraction skipped: %s", e
            )

        await emit(
            "agent_result",
            {
                "stage": stage_name,
                "agent": agent_name,
                "status": "completed" if success else "error",
                "summary": _summarize(result, limit=240),
            },
        )

        # 5. AUDIT — fire-and-forget loopback to ProofGuard
        await self.proofguard.record_execution(attestation_id, result, success)

        return result

    # ── Full-stage governed execution (uses Phase 1 handlers) ─────────────

    async def execute_stage(
        self,
        stage_name: str,
        stream: Optional[StreamCallback] = None,
    ) -> Dict[str, Any]:
        """
        Run a whole stage through governance.

        The existing sync stage handler (from core/stage_handlers.py) knows
        which agents run for this stage and with what args. We wrap that entire
        handler in a single governance sandwich so the Phase 2 flow works with
        the Phase 1 stage-handler registry without rewriting every handler.

        For per-agent attestation, call execute_stage_for_agent() instead.
        """
        handler = self.atlas._stage_handlers.get(stage_name)
        if handler is None:
            return {"status": "skipped", "reason": f"no handler for {stage_name}"}

        agent_names = sorted(self.atlas.agents.keys())

        # 1. REFLECTION — summarize what this stage intends to do
        proposed_action = {
            "stage": stage_name,
            "handler": getattr(handler, "__name__", "<lambda>"),
            "candidate_agents": agent_names,
            "context_summary": {
                "run_id": getattr(self.atlas.context, "run_id", None),
                "current_stage": getattr(self.atlas.context, "stage", None),
            },
        }

        # 2. GOVERNANCE
        attestation = await self.proofguard.attest_action(
            agent_name="orchestrator",
            stage=stage_name,
            proposed_action=proposed_action,
        )
        status = attestation.get("status")
        attestation_id = attestation.get("attestation_id")

        if stream is not None:
            await stream(
                "proofguard_verdict",
                {
                    "stage": stage_name,
                    "agent": "orchestrator",
                    "status": status,
                    "cqs_score": attestation.get("cqs_score", 0),
                    "attestation_id": attestation_id,
                    "reason": attestation.get("reason"),
                },
            )

        if status in (STATUS_BLOCKED, STATUS_REJECTED):
            raise SecurityError(
                f"ProofGuard blocked stage {stage_name}: "
                f"{attestation.get('reason', 'no reason provided')}"
            )

        if status == STATUS_REQUIRES_HITL or self.proofguard.hitl_enabled:
            if stream is not None:
                await stream(
                    "hitl_waiting",
                    {
                        "stage": stage_name,
                        "agent": "orchestrator",
                        "attestation_id": attestation_id,
                    },
                )
            await self.proofguard.wait_for_hitl(attestation_id)
            if stream is not None:
                await stream(
                    "hitl_resumed",
                    {
                        "stage": stage_name,
                        "agent": "orchestrator",
                        "attestation_id": attestation_id,
                    },
                )

        # 3. EXECUTION — run the sync handler in a worker thread
        try:
            result = await asyncio.to_thread(self.atlas.run_stage, stage_name)
            success = True
        except Exception as e:
            result = {"success": False, "error": str(e), "trace": traceback.format_exc()}
            success = False

        # Carry stage state forward for downstream reflection
        self.state[stage_name] = result

        # Phase 3: Extract Generative UI payloads from everything the handler
        # wrote into shared context, not just the direct return value. This
        # catches payloads produced by sync stage handlers in stage_handlers.py
        # that end up inside context.agent_outputs[stage].
        if stream is not None:
            try:
                from .generative_ui import extract_ui_payloads

                stage_outputs = getattr(self.atlas.context, "_data", {}).get(
                    "agent_outputs", {}
                ).get(stage_name, {})
                combined = {"stage_result": result, "agent_outputs": stage_outputs}
                ui_payloads, _ = extract_ui_payloads(combined)
                for payload in ui_payloads:
                    payload.setdefault("stage", stage_name)
                    await stream("ui_component", payload)
            except Exception as e:
                import logging

                logging.getLogger("launchops.orchestrator").debug(
                    "Stage-level GUI payload extraction skipped: %s", e
                )

        # 4. AUDIT
        await self.proofguard.record_execution(attestation_id, result or {}, success)

        if not success:
            raise RuntimeError(result.get("error", f"stage {stage_name} failed"))
        return result or {}

    # ── Full-pipeline streaming runner ────────────────────────────────────

    async def run_pipeline(
        self,
        start_stage: Optional[str] = None,
        end_stage: Optional[str] = None,
    ) -> AsyncIterator[tuple]:
        """
        Run a range of pipeline stages and yield (event_name, payload) tuples
        for an SSE stream. Stops at the first SecurityError (governance is
        non-negotiable) but keeps going on runtime errors.
        """
        start_idx = STAGES.index(start_stage) if start_stage else 0
        end_idx = STAGES.index(end_stage) + 1 if end_stage else len(STAGES)
        stages_to_run = STAGES[start_idx:end_idx]

        run_id = getattr(self.atlas.context, "run_id", datetime.utcnow().isoformat())

        yield (
            "pipeline_start",
            {
                "run_id": run_id,
                "stages": stages_to_run,
                "total": len(stages_to_run),
                "timestamp": datetime.utcnow().isoformat(),
                "hitl_enabled": self.proofguard.hitl_enabled,
                "proofguard_url": self.proofguard.api_url,
            },
        )

        # Fan-in queue so per-agent callbacks emit into the same async stream
        event_queue: asyncio.Queue = asyncio.Queue()

        async def stream_cb(event: str, data: Dict[str, Any]) -> None:
            await event_queue.put((event, data))

        completed_stages: List[str] = []
        errors: List[Dict[str, Any]] = []

        for i, stage in enumerate(stages_to_run):
            # ── Governance Gate Check ────────────────────────────────────
            # If the vertical deployment plan defines a gate for this stage,
            # verify that all prerequisite stages completed and that the
            # required validation checks are present in shared context.
            gate = self._governance_gates.get(stage)
            if gate is not None:
                gate_name = getattr(gate, "name", str(gate))
                requires = getattr(gate, "requires_stages", [])
                checks = getattr(gate, "validation_checks", [])
                block = getattr(gate, "block_on_failure", True)

                # Prerequisite stages check
                missing_stages = [s for s in requires if s not in completed_stages]

                # Validation checks against shared context
                failed_checks = []
                for check_key in checks:
                    ctx_val = getattr(self.atlas.context, "get", lambda k, d=None: d)(check_key)
                    state_val = self.state.get(check_key)
                    if not ctx_val and not state_val:
                        failed_checks.append(check_key)

                if missing_stages or failed_checks:
                    gate_payload = {
                        "stage": stage,
                        "gate": gate_name,
                        "missing_stages": missing_stages,
                        "failed_checks": failed_checks,
                        "block_on_failure": block,
                    }

                    if block:
                        yield ("governance_gate_blocked", gate_payload)
                        errors.append({
                            "stage": stage,
                            "error": f"Governance gate '{gate_name}' blocked: "
                                     f"missing stages={missing_stages}, "
                                     f"failed checks={failed_checks}",
                            "kind": "governance_gate",
                        })
                        yield (
                            "stage_error",
                            {"stage": stage, "index": i,
                             "error": f"Governance gate blocked: {gate_name}",
                             "kind": "governance_gate"},
                        )
                        continue  # Skip this stage
                    else:
                        yield ("governance_gate_warning", gate_payload)

                else:
                    yield (
                        "governance_gate_passed",
                        {"stage": stage, "gate": gate_name},
                    )

            yield (
                "stage_start",
                {
                    "stage": stage,
                    "index": i,
                    "total": len(stages_to_run),
                    "agents": sorted(self.atlas.agents.keys()),
                },
            )

            # Kick off the governed stage in a background task so we can
            # drain streamed events from the queue as they arrive.
            task = asyncio.create_task(self.execute_stage(stage, stream=stream_cb))

            while not task.done() or not event_queue.empty():
                try:
                    evt = await asyncio.wait_for(event_queue.get(), timeout=0.2)
                    yield evt
                except asyncio.TimeoutError:
                    continue

            try:
                await task
                completed_stages.append(stage)
                yield (
                    "stage_complete",
                    {"stage": stage, "index": i, "status": "completed"},
                )
            except SecurityError as e:
                # Governance is hard-stop
                errors.append({"stage": stage, "error": str(e), "kind": "security"})
                yield (
                    "stage_error",
                    {"stage": stage, "index": i, "error": str(e), "kind": "security"},
                )
                break
            except Exception as e:
                errors.append({"stage": stage, "error": str(e), "kind": "runtime"})
                yield (
                    "stage_error",
                    {"stage": stage, "index": i, "error": str(e), "kind": "runtime"},
                )

            await asyncio.sleep(0)  # yield control

        yield (
            "pipeline_complete",
            {
                "run_id": run_id,
                "final_stage": getattr(self.atlas.context, "stage", None),
                "stages_completed": len(stages_to_run) - len(errors),
                "errors": len(errors),
                "error_details": errors,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )


# ── Small helpers ───────────────────────────────────────────────────────────


def _summarize(value: Any, limit: int = 240) -> str:
    """Produce a short string preview of an arbitrary value for SSE payloads."""
    try:
        if isinstance(value, (dict, list)):
            import json

            s = json.dumps(value, default=str)
        else:
            s = str(value)
    except Exception:
        s = repr(value)
    return s if len(s) <= limit else s[: limit - 1] + "…"


def _is_success(result: Any) -> bool:
    """Best-effort success check for heterogeneous agent return shapes."""
    if isinstance(result, dict):
        if "success" in result:
            return bool(result["success"])
        if "status" in result:
            return result["status"] in ("completed", "success", "ok")
        return "error" not in result
    return result is not None
