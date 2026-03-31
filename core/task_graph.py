"""Task graph and orchestration state management for Atlas."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import json


class TaskStatus(str, Enum):
    """Task execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class TaskType(str, Enum):
    """Types of tasks in the orchestration."""
    IDEATION = "ideation"
    SCAFFOLDING = "scaffolding"
    DEVELOPMENT = "development"
    LAUNCH = "launch"
    GROWTH = "growth"


class Task(BaseModel):
    """A single task in the execution graph."""
    id: str
    type: TaskType
    title: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    dependencies: List[str] = Field(default_factory=list)
    
    # Execution
    agent_name: Optional[str] = None
    tool_permissions: List[str] = Field(default_factory=list)
    prompt_id: Optional[str] = None
    
    # State
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    
    # I/O
    inputs: Dict[str, Any] = Field(default_factory=dict)
    outputs: Dict[str, Any] = Field(default_factory=dict)
    artifacts: List[str] = Field(default_factory=list)


class BusinessRun(BaseModel):
    """A complete business building run state."""
    id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "created"
    tasks: List[Task] = Field(default_factory=list)
    workspace_path: str
    
    def get_task(self, task_id: str) -> Optional[Task]:
        for task in self.tasks:
            if task.id == task_id:
                return task
        return None

    def to_json(self) -> str:
        return self.model_dump_json(indent=2)
