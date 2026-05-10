"""
Task graph data models for the LaunchOps orchestrator.
Provides BusinessRun, Task, TaskStatus, TaskGraph, and TaskNode.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class Task:
    id: str
    name: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    dependencies: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TaskNode:
    task: Task
    children: List[str] = field(default_factory=list)
    parents: List[str] = field(default_factory=list)


@dataclass
class TaskGraph:
    tasks: Dict[str, Task] = field(default_factory=dict)
    nodes: Dict[str, TaskNode] = field(default_factory=dict)

    def add_task(self, task: Task, depends_on: Optional[List[str]] = None) -> None:
        self.tasks[task.id] = task
        node = TaskNode(task=task, parents=depends_on or [])
        self.nodes[task.id] = node
        for parent_id in (depends_on or []):
            if parent_id in self.nodes:
                self.nodes[parent_id].children.append(task.id)


@dataclass
class BusinessRun:
    id: str
    goal: str
    tasks: List[Task] = field(default_factory=list)
    task_graph: Optional[TaskGraph] = None
    workspace_path: str = ""
    artifacts_path: str = ""
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)


def create_default_task_graph(
    goal: str,
    workspace_path: str,
    artifacts_path: str,
) -> BusinessRun:
    """Create a default linear task graph for a generic business goal."""
    default_steps = [
        ("security", "Generate credentials and secrets"),
        ("legal", "Legal formation documents"),
        ("repo", "GitHub repository setup"),
        ("stripe", "Subscription billing setup"),
        ("email", "Transactional email setup"),
        ("website", "Marketing site generation"),
        ("marketing", "Marketing automation"),
        ("support", "Customer support setup"),
        ("analytics", "Analytics configuration"),
        ("project", "Project management setup"),
        ("growth", "Go-to-market strategy"),
    ]

    tasks = []
    prev_id = None
    for step_name, description in default_steps:
        task = Task(
            id=f"task_{step_name}",
            name=step_name,
            description=description,
            dependencies=[prev_id] if prev_id else [],
        )
        tasks.append(task)
        prev_id = task.id

    return BusinessRun(
        id=f"run_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
        goal=goal,
        tasks=tasks,
        workspace_path=workspace_path,
        artifacts_path=artifacts_path,
    )
