"""Docker service health endpoints."""

import asyncio
import time
from typing import List

from fastapi import APIRouter

router = APIRouter(prefix="/services", tags=["services"])

# LaunchOps stack services and their expected ports/URLs
STACK_SERVICES = [
    {"name": "WordPress", "url": "http://localhost:8080", "port": 8080},
    {"name": "SuiteCRM", "url": "http://localhost:8081", "port": 8081},
    {"name": "Mautic", "url": "http://localhost:8082", "port": 8082},
    {"name": "Matomo", "url": "http://localhost:8083", "port": 8083},
    {"name": "Vaultwarden", "url": "http://localhost:8084", "port": 8084},
]


async def check_service(service: dict) -> dict:
    """Check if a service is responding."""
    import urllib.request
    import urllib.error

    start = time.time()
    try:
        result = await asyncio.to_thread(
            lambda: urllib.request.urlopen(service["url"], timeout=3)
        )
        elapsed = int((time.time() - start) * 1000)
        return {
            "name": service["name"],
            "url": service["url"],
            "port": service["port"],
            "status": "up",
            "response_time_ms": elapsed,
            "error": None,
        }
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        return {
            "name": service["name"],
            "url": service["url"],
            "port": service["port"],
            "status": "down",
            "response_time_ms": elapsed,
            "error": str(e),
        }


@router.get("/")
async def list_services():
    """Check health of all LaunchOps stack services."""
    tasks = [check_service(s) for s in STACK_SERVICES]
    results = await asyncio.gather(*tasks)

    up_count = sum(1 for r in results if r["status"] == "up")
    return {
        "services": results,
        "total": len(results),
        "up": up_count,
        "down": len(results) - up_count,
    }


@router.get("/{service_name}")
async def get_service(service_name: str):
    """Check health of a specific service."""
    for s in STACK_SERVICES:
        if s["name"].lower() == service_name.lower():
            return await check_service(s)
    return {"error": f"Unknown service: {service_name}", "known": [s["name"] for s in STACK_SERVICES]}
