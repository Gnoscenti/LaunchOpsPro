"""
DynExecutiv stream endpoint — Phase 3 Generative UI
=====================================================

GET /dynexecutiv/stream

Runs DynExecutivAgent.generate_daily_brief() and streams the result as SSE,
interleaving three types of events:

    message            narrative text (split into chunks)
    ui_component       Generative UI payloads for the dashboard
    done               fires once at the end

Because this endpoint is GET with no body, the dashboard can connect via
the native EventSource API (see useAgentStream with method: "GET").

For POST-based governed execution with per-agent events, use
/atlas/v2/execute instead.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Any, AsyncGenerator, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from api.state import get_atlas
from core.generative_ui import extract_ui_payloads

router = APIRouter(prefix="/dynexecutiv", tags=["dynexecutiv"])


# ── SSE helpers ─────────────────────────────────────────────────────────────


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _chunk_text(text: str, chunk_size: int = 80) -> list[str]:
    """Break a string into chunks at word boundaries for a typewriter feel."""
    if not text:
        return []
    words = text.split(" ")
    chunks: list[str] = []
    buf = ""
    for word in words:
        candidate = f"{buf} {word}".strip()
        if len(candidate) >= chunk_size:
            chunks.append(candidate + " ")
            buf = ""
        else:
            buf = candidate
    if buf:
        chunks.append(buf)
    return chunks


# ── Routes ──────────────────────────────────────────────────────────────────


@router.get("/stream")
async def dynexecutiv_stream() -> StreamingResponse:
    """
    Run DynExecutiv.generate_daily_brief() and stream the narrative + any
    ui_component payloads. Returns `text/event-stream`.
    """
    atlas = get_atlas()
    agent = atlas.agents.get("dynexecutiv")
    if agent is None:
        raise HTTPException(
            503, "DynExecutivAgent is not loaded (check OPENAI_API_KEY)"
        )

    async def event_stream() -> AsyncGenerator[str, None]:
        yield _sse(
            "start",
            {"agent": "dynexecutiv", "timestamp": datetime.utcnow().isoformat()},
        )

        try:
            # The agent may be async or sync — dispatch both
            generate = getattr(agent, "generate_daily_brief", None)
            if generate is None:
                yield _sse(
                    "error",
                    {"error": "DynExecutivAgent has no generate_daily_brief method"},
                )
                return

            if asyncio.iscoroutinefunction(generate):
                result: Dict[str, Any] = await generate(context={})
            else:
                result = await asyncio.to_thread(generate, {})

            if not isinstance(result, dict):
                result = {"narrative": str(result), "ui_payloads": []}

            # Emit UI payloads FIRST — so widgets render above the narrative
            ui_payloads, cleaned = extract_ui_payloads(result)
            for payload in ui_payloads:
                payload.setdefault("source_agent", "dynexecutiv")
                yield _sse("ui_component", payload)
                # Small delay so the browser can render between widgets —
                # produces a satisfying "streaming in" effect.
                await asyncio.sleep(0.05)

            # Narrative text, chunked for typewriter feel
            narrative = cleaned.get("narrative") if isinstance(cleaned, dict) else None
            if narrative:
                for chunk in _chunk_text(narrative, chunk_size=80):
                    yield _sse("message", chunk)
                    await asyncio.sleep(0.03)

            yield _sse(
                "done",
                {
                    "agent": "dynexecutiv",
                    "ui_count": len(ui_payloads),
                    "narrative_chars": len(narrative or ""),
                },
            )
        except Exception as e:
            yield _sse("error", {"error": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/status")
async def dynexecutiv_status() -> Dict[str, Any]:
    """Report whether the DynExecutiv agent is loaded and configured."""
    atlas = get_atlas()
    agent = atlas.agents.get("dynexecutiv")
    return {
        "loaded": agent is not None,
        "has_client": bool(getattr(agent, "client", None)) if agent else False,
        "model": getattr(agent, "model", None) if agent else None,
    }
