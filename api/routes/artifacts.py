"""Artifact listing and retrieval endpoints."""

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter(prefix="/artifacts", tags=["artifacts"])

# Default artifacts directory
ARTIFACTS_DIR = Path(os.environ.get("ARTIFACTS_PATH", os.path.expanduser("~/.launchops/documents")))
DATA_DIR = Path(os.environ.get("LAUNCHOPS_DATA_DIR", os.path.expanduser("~/.launchops")))


def scan_artifacts(base_dir: Path) -> list:
    """Scan a directory for generated artifacts."""
    artifacts = []
    if not base_dir.exists():
        return artifacts

    for root, dirs, files in os.walk(base_dir):
        for f in files:
            filepath = Path(root) / f
            rel_path = filepath.relative_to(base_dir)

            # Determine stage from directory structure
            parts = rel_path.parts
            stage = parts[0] if len(parts) > 1 else "general"

            # Determine type from extension
            ext = filepath.suffix.lower()
            artifact_type = {
                ".md": "document",
                ".json": "config",
                ".html": "report",
                ".pdf": "report",
                ".txt": "document",
            }.get(ext, "file")

            stat = filepath.stat()
            artifacts.append({
                "id": str(rel_path).replace("/", "_").replace(".", "_"),
                "stage": stage,
                "agent": "unknown",
                "type": artifact_type,
                "filename": f,
                "path": str(filepath),
                "relative_path": str(rel_path),
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size_bytes": stat.st_size,
            })

    return sorted(artifacts, key=lambda a: a["created_at"], reverse=True)


@router.get("/")
async def list_artifacts(stage: Optional[str] = None, type: Optional[str] = None):
    """List all generated artifacts, optionally filtered by stage or type."""
    artifacts = scan_artifacts(ARTIFACTS_DIR) + scan_artifacts(DATA_DIR / "data")

    if stage:
        artifacts = [a for a in artifacts if a["stage"] == stage]
    if type:
        artifacts = [a for a in artifacts if a["type"] == type]

    return {"artifacts": artifacts, "total": len(artifacts)}


@router.get("/{artifact_id}")
async def get_artifact(artifact_id: str):
    """Get metadata for a specific artifact."""
    artifacts = scan_artifacts(ARTIFACTS_DIR) + scan_artifacts(DATA_DIR / "data")
    for a in artifacts:
        if a["id"] == artifact_id:
            return a
    raise HTTPException(404, f"Artifact not found: {artifact_id}")


@router.get("/{artifact_id}/download")
async def download_artifact(artifact_id: str):
    """Download an artifact file."""
    artifacts = scan_artifacts(ARTIFACTS_DIR) + scan_artifacts(DATA_DIR / "data")
    for a in artifacts:
        if a["id"] == artifact_id:
            path = Path(a["path"])
            if path.exists():
                return FileResponse(path, filename=a["filename"])
            raise HTTPException(404, f"File not found on disk: {a['path']}")
    raise HTTPException(404, f"Artifact not found: {artifact_id}")
