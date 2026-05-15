"""
LaunchOps Bridge — Action Manifest Models

Pydantic models representing the Action Manifest schema.
Used by both the export endpoint (LaunchOpsPro) and import endpoint (Founder Edition).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from enum import Enum

from pydantic import BaseModel, Field


class ExecutionMode(str, Enum):
    PYTHON = "python"
    LLM = "llm"
    HYBRID = "hybrid"


class ActionPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ManifestExecutionMode(str, Enum):
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    DEPENDENCY_GRAPH = "dependency-graph"


class BusinessType(str, Enum):
    SAAS = "saas"
    ECOMMERCE = "ecommerce"
    AGENCY = "agency"
    MARKETPLACE = "marketplace"
    OTHER = "other"


class RetryPolicy(BaseModel):
    max_retries: int = 2
    backoff_seconds: int = 5


class ActionConfig(BaseModel):
    """Agent-specific configuration parameters."""
    type: Optional[str] = None
    method_dispatch: Optional[str] = Field(None, alias="_method")

    model_config = {"extra": "allow", "populate_by_name": True}


class Action(BaseModel):
    """A single executable action for a Founder Edition agent."""
    action_id: str = Field(default_factory=lambda: f"action_{uuid.uuid4().hex[:12]}")
    sort_order: int = 0
    agent_id: str
    method: Optional[str] = None
    label: str
    description: Optional[str] = None
    execution_mode: ExecutionMode = ExecutionMode.HYBRID
    priority: ActionPriority = ActionPriority.MEDIUM
    config: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)
    inputs: Dict[str, Any] = Field(default_factory=dict)
    expected_outputs: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)
    timeout_seconds: int = 300
    retry_policy: RetryPolicy = Field(default_factory=RetryPolicy)


class ManifestSource(BaseModel):
    """Origin system metadata."""
    system: str = "launchops-pro"
    execution_id: str
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = None


class BusinessContext(BaseModel):
    """Business context accumulated from the pipeline."""
    business_name: str
    business_type: BusinessType = BusinessType.SAAS
    industry: Optional[str] = None
    goal: str
    constraints: Dict[str, Any] = Field(default_factory=dict)
    accumulated_context: Dict[str, Any] = Field(default_factory=dict)


class ExecutionConfig(BaseModel):
    """Global execution configuration."""
    mode: ManifestExecutionMode = ManifestExecutionMode.SEQUENTIAL
    halt_on_failure: bool = True
    callback_url: Optional[str] = None
    timeout_seconds: int = 3600
    dry_run: bool = False


class ManifestMetadata(BaseModel):
    """Additional metadata for tracking and auditing."""
    user_id: Optional[str] = None
    proof_hashes: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)


class ActionManifest(BaseModel):
    """
    The LaunchOps Action Manifest — standardized format for packaging
    LaunchOpsPro pipeline outputs into executable action manifests
    for Founder Edition agents.
    """
    manifest_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    version: str = "1.0.0"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    source: ManifestSource
    business_context: BusinessContext
    actions: List[Action]
    execution_config: ExecutionConfig = Field(default_factory=ExecutionConfig)
    metadata: ManifestMetadata = Field(default_factory=ManifestMetadata)

    def get_action_by_id(self, action_id: str) -> Optional[Action]:
        """Look up an action by its ID."""
        for action in self.actions:
            if action.action_id == action_id:
                return action
        return None

    def get_ready_actions(self, completed_ids: set) -> List[Action]:
        """Get actions whose dependencies are all satisfied."""
        ready = []
        for action in self.actions:
            if action.action_id in completed_ids:
                continue
            if all(dep in completed_ids for dep in action.dependencies):
                ready.append(action)
        return ready

    def validate_dependencies(self) -> List[str]:
        """Check for missing or circular dependencies."""
        errors = []
        all_ids = {a.action_id for a in self.actions}
        for action in self.actions:
            for dep in action.dependencies:
                if dep not in all_ids:
                    errors.append(
                        f"Action '{action.action_id}' depends on unknown action '{dep}'"
                    )
        return errors


class ActionResult(BaseModel):
    """Result of executing a single action."""
    action_id: str
    agent_id: str
    success: bool
    execution_mode: str = "unknown"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    output: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    proof_hash: Optional[str] = None


class ManifestExecutionResult(BaseModel):
    """Complete result of executing a manifest."""
    manifest_id: str
    status: str  # "completed", "failed", "partial", "cancelled"
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_actions: int
    completed_actions: int = 0
    failed_actions: int = 0
    results: List[ActionResult] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
