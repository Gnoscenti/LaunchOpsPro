"""Docker service health models."""

from typing import Optional
from pydantic import BaseModel


class ServiceHealth(BaseModel):
    """Health status of a Docker-managed service."""
    name: str
    url: str
    status: str  # up | down | unknown
    port: int
    response_time_ms: Optional[int] = None
    error: Optional[str] = None
