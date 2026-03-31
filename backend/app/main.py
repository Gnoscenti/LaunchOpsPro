"""Main FastAPI application for Founder Autopilot."""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import json
from pathlib import Path
from datetime import datetime

from app.settings import settings
from app.core.business_spec import BuildConstraints, BusinessSpec, BusinessConcept
from app.core.task_graph import BusinessRun, Task, RunStatus, create_default_task_graph
from app.core.permissions import permission_manager
from app.agents.orchestrator import OrchestratorAgent
from app.agents.business_builder import BusinessBuilderAgent
from app.agents.webdev import WebDevAgent
from app.agents.stripe_agent import StripeAgent
from app.agents.marketing import MarketingAgent
from app.agents.reviewer import ReviewerAgent

# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered business builder orchestrator with agent-based architecture"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize agents
orchestrator = OrchestratorAgent()
business_builder = BusinessBuilderAgent()
webdev = WebDevAgent()
stripe_agent = StripeAgent()
marketing = MarketingAgent()
reviewer = ReviewerAgent()

# In-memory storage for runs (in production, use database)
runs_storage: Dict[str, BusinessRun] = {}


# Request/Response models
class CreateRunRequest(BaseModel):
    goal: str
    constraints: Optional[Dict[str, Any]] = None


class ExecuteTaskRequest(BaseModel):
    task_id: str
    inputs: Optional[Dict[str, Any]] = None


class RunResponse(BaseModel):
    run_id: str
    status: str
    current_task_id: Optional[str]
    progress: float


# Load prompts
def load_prompts() -> Dict[str, str]:
    """Load business prompts from JSON file."""
    prompts_file = Path(settings.prompts_path) / "business_prompts.json"
    
    if not prompts_file.exists():
        return {}
    
    with open(prompts_file) as f:
        data = json.load(f)
    
    # Extract prompts into dict
    prompts = {}
    for pack in data.get("packs", []):
        for prompt in pack.get("prompts", []):
            prompts[prompt["id"]] = prompt["prompt"]
    
    return prompts


PROMPTS = load_prompts()


# API Endpoints
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/prompts")
async def list_prompts():
    """List all available prompts."""
    return {"prompts": list(PROMPTS.keys()), "count": len(PROMPTS)}


@app.get("/prompts/{prompt_id}")
async def get_prompt(prompt_id: str):
    """Get a specific prompt."""
    if prompt_id not in PROMPTS:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    return {"id": prompt_id, "prompt": PROMPTS[prompt_id]}


@app.post("/runs", response_model=RunResponse)
async def create_run(request: CreateRunRequest):
    """Create a new business building run."""
    
    # Create execution plan
    run = orchestrator.plan_execution(request.goal, request.constraints or {})
    
    # Store run
    runs_storage[run.id] = run
    
    # Save to disk
    run_file = Path(settings.workspace_path) / f"{run.id}.json"
    run_file.parent.mkdir(parents=True, exist_ok=True)
    run_file.write_text(run.to_json())
    
    return RunResponse(
        run_id=run.id,
        status=run.status.value,
        current_task_id=run.current_task_id,
        progress=0.0
    )


@app.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(run_id: str):
    """Get run status."""
    if run_id not in runs_storage:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = runs_storage[run_id]
    
    # Calculate progress
    completed = sum(1 for t in run.tasks if t.status.value == "completed")
    total = len(run.tasks)
    progress = completed / total if total > 0 else 0.0
    
    return RunResponse(
        run_id=run.id,
        status=run.status.value,
        current_task_id=run.current_task_id,
        progress=progress
    )


@app.get("/runs/{run_id}/tasks")
async def list_tasks(run_id: str):
    """List all tasks in a run."""
    if run_id not in runs_storage:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = runs_storage[run_id]
    
    return {
        "run_id": run.id,
        "tasks": [
            {
                "id": t.id,
                "type": t.type.value,
                "title": t.title,
                "status": t.status.value,
                "agent": t.agent_name,
            }
            for t in run.tasks
        ]
    }


@app.post("/runs/{run_id}/execute")
async def execute_next_task(run_id: str, background_tasks: BackgroundTasks):
    """Execute the next task in the run."""
    if run_id not in runs_storage:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = runs_storage[run_id]
    
    # Get next task
    next_task = run.get_next_task()
    if not next_task:
        return {"message": "No more tasks to execute", "run_id": run.id}
    
    # Execute task in background
    background_tasks.add_task(execute_task_background, run_id, next_task.id)
    
    return {
        "message": "Task execution started",
        "run_id": run.id,
        "task_id": next_task.id,
        "task_title": next_task.title
    }


async def execute_task_background(run_id: str, task_id: str):
    """Execute a task in the background."""
    run = runs_storage[run_id]
    task = run.get_task(task_id)
    
    if not task:
        return
    
    try:
        # Mark as running
        task.status = "running"
        task.started_at = datetime.utcnow()
        run.current_task_id = task_id
        run.status = RunStatus.RUNNING
        
        # Gather context from previous tasks
        context = {}
        for prev_task in run.tasks:
            if prev_task.status.value == "completed":
                context[prev_task.id] = prev_task.outputs
        
        # Execute task
        outputs = orchestrator.execute_task(task, context, PROMPTS)
        
        # Mark as completed
        run.mark_task_completed(task_id, outputs)
        
        # Save run
        run_file = Path(settings.workspace_path) / f"{run.id}.json"
        run_file.write_text(run.to_json())
        
    except Exception as e:
        # Mark as failed
        run.mark_task_failed(task_id, str(e))
        
        # Save run
        run_file = Path(settings.workspace_path) / f"{run.id}.json"
        run_file.write_text(run.to_json())


@app.get("/runs/{run_id}/tasks/{task_id}")
async def get_task(run_id: str, task_id: str):
    """Get task details."""
    if run_id not in runs_storage:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = runs_storage[run_id]
    task = run.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "id": task.id,
        "type": task.type.value,
        "title": task.title,
        "description": task.description,
        "status": task.status.value,
        "agent": task.agent_name,
        "inputs": task.inputs,
        "outputs": task.outputs,
        "artifacts": task.artifacts,
    }


@app.get("/permissions")
async def list_permissions():
    """List all agent permissions."""
    from app.core.permissions import AGENT_PERMISSIONS
    
    return {
        agent: [p.value for p in perms]
        for agent, perms in AGENT_PERMISSIONS.items()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
