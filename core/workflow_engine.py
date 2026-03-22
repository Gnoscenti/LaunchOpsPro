"""
Gnoscenti Atlas Engine - Stage-Aware Workflow Engine
Executes ordered, dependency-aware workflows across product development stages.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from core.audit_log import record as audit

logger = logging.getLogger("atlas.workflow")


class ProductStage(str, Enum):
    IDEATION = "ideation"
    SCAFFOLDING = "scaffolding"
    DEVELOPMENT = "development"
    LAUNCH = "launch"
    GROWTH = "growth"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WorkflowStep:
    id: str
    name: str
    description: str
    executor: Callable[[Dict[str, Any]], Dict[str, Any]]
    required: bool = True
    depends_on: List[str] = field(default_factory=list)
    status: StepStatus = StepStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class Workflow:
    id: str
    name: str
    description: str
    stage: ProductStage
    steps: List[WorkflowStep]
    status: StepStatus = StepStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class WorkflowEngine:
    """
    Executes workflows respecting step dependencies and collecting results.
    """

    def __init__(self):
        self._registry: Dict[ProductStage, List[Workflow]] = {}

    def register(self, workflow: Workflow) -> None:
        self._registry.setdefault(workflow.stage, []).append(workflow)

    def get_workflows_for_stage(self, stage: ProductStage) -> List[Workflow]:
        return self._registry.get(stage, [])

    def execute_workflow(
        self,
        workflow: Workflow,
        context: Dict[str, Any],
        auto: bool = False,
    ) -> bool:
        """
        Execute all steps in a workflow in dependency order.

        Returns True if all required steps succeeded.
        """
        workflow.status = StepStatus.RUNNING
        workflow.started_at = datetime.now(timezone.utc)
        completed_ids: set = set()

        logger.info(f"▶ Workflow: {workflow.name}")

        for step in workflow.steps:
            # Dependency check
            if not all(dep in completed_ids for dep in step.depends_on):
                logger.warning(f"  ⏭ Skipping '{step.name}' — unmet dependencies")
                step.status = StepStatus.SKIPPED
                audit("workflow_engine", f"skip:{step.id}", "skipped",
                      {"workflow": workflow.id, "reason": "unmet_dependencies"})
                if step.required:
                    workflow.status = StepStatus.FAILED
                    return False
                continue

            step.status = StepStatus.RUNNING
            step.started_at = datetime.now(timezone.utc)
            logger.info(f"  ↳ {step.name}")

            try:
                result = step.executor(context)
                step.result = result
                step.status = StepStatus.COMPLETED
                completed_ids.add(step.id)
                audit("workflow_engine", f"step:{step.id}", "success",
                      {"workflow": workflow.id, "result_keys": list(result.keys()) if isinstance(result, dict) else []})
            except Exception as exc:
                step.error = str(exc)
                step.status = StepStatus.FAILED
                logger.error(f"  ✗ {step.name} failed: {exc}")
                audit("workflow_engine", f"step:{step.id}", "failure",
                      {"workflow": workflow.id}, error=str(exc))
                if step.required:
                    workflow.status = StepStatus.FAILED
                    workflow.completed_at = datetime.now(timezone.utc)
                    return False
            finally:
                step.completed_at = datetime.now(timezone.utc)

        workflow.status = StepStatus.COMPLETED
        workflow.completed_at = datetime.now(timezone.utc)
        logger.info(f"✓ Workflow complete: {workflow.name}")
        return True

    def summary(self, workflow: Workflow) -> Dict[str, Any]:
        return {
            "id": workflow.id,
            "name": workflow.name,
            "status": workflow.status,
            "steps": [
                {
                    "id": s.id,
                    "name": s.name,
                    "status": s.status,
                    "error": s.error,
                }
                for s in workflow.steps
            ],
        }


_engine: Optional[WorkflowEngine] = None


def get_workflow_engine() -> WorkflowEngine:
    global _engine
    if _engine is None:
        _engine = WorkflowEngine()
    return _engine
