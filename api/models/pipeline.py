"""Pipeline and execution models."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    """Request body for full pipeline execution."""
    start_stage: Optional[str] = None
    end_stage: Optional[str] = None


class ExecuteStageRequest(BaseModel):
    """Request body for single stage execution."""
    stage: str


class StageInfo(BaseModel):
    """Status of a single pipeline stage."""
    index: int
    name: str
    status: str  # pending | current | completed | error
    has_output: bool = False
    agents: List[str] = Field(default_factory=list)
    duration_ms: Optional[int] = None
    error: Optional[str] = None


class PipelineStatus(BaseModel):
    """Overall pipeline status."""
    stages: List[StageInfo]
    total: int
    current_stage: Optional[str] = None
    run_id: Optional[str] = None
    human_approval_enabled: bool = False


class RunRecord(BaseModel):
    """A single pipeline execution run."""
    run_id: str
    started_at: str
    completed_at: Optional[str] = None
    status: str  # running | completed | failed
    stages_completed: int = 0
    stages_total: int = 0
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    artifacts: List[str] = Field(default_factory=list)


class ArtifactRecord(BaseModel):
    """A generated artifact from a pipeline stage."""
    id: str
    stage: str
    agent: str
    type: str  # document | config | report | brief
    filename: str
    path: str
    created_at: str
    size_bytes: int = 0
