"""
Structured Logging — Sprint 1 Hardening
=========================================

Configures the Python logging hierarchy for the entire LaunchOps stack.
All loggers under the "LaunchOps.*" and "launchops.*" namespaces emit
structured JSON with contextual fields:

    {
        "timestamp": "2026-04-13T10:30:00.123Z",
        "level": "INFO",
        "logger": "LaunchOps.ProofGuard",
        "message": "Attestation passed",
        "run_id": "20260413_103000",
        "stage": "payments",
        "agent": "stripe_agent",
        "deployment_id": "dep_abc123"
    }

Usage:
    Call `configure_logging()` once at app startup (in api/main.py or
    launchops.py). After that, every `logging.getLogger("LaunchOps.Foo")`
    call anywhere in the codebase will emit structured JSON to stderr.

    import logging
    from core.logging_config import configure_logging, set_context

    configure_logging()
    set_context(run_id="abc", stage="init")
    logger = logging.getLogger("LaunchOps.MyAgent")
    logger.info("Starting stage")
    # → {"timestamp": "...", "level": "INFO", ... , "run_id": "abc", "stage": "init"}

Environment:
    LOG_LEVEL               DEBUG | INFO | WARNING | ERROR (default INFO)
    LOG_FORMAT              json | text (default json)
"""

from __future__ import annotations

import json
import logging
import os
import sys
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional


# ── Thread-local context ────────────────────────────────────────────────────
# Lightweight alternative to structlog's context_vars. Works with
# `asyncio.to_thread` because each thread inherits the calling thread's
# context at creation time — and we reset it at the top of each stage.

_context = threading.local()


def set_context(**kwargs: Any) -> None:
    """Set contextual fields that will appear on every log line."""
    for k, v in kwargs.items():
        setattr(_context, k, v)


def clear_context() -> None:
    _context.__dict__.clear()


def get_context() -> Dict[str, Any]:
    return dict(_context.__dict__)


# ── JSON formatter ──────────────────────────────────────────────────────────


class JSONFormatter(logging.Formatter):
    """Emit one JSON object per log record to stderr."""

    def format(self, record: logging.LogRecord) -> str:
        entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Merge thread-local context
        entry.update(get_context())

        # Merge any extra fields passed via logger.info("msg", extra={...})
        for key in ("run_id", "stage", "agent", "deployment_id", "tenant_id",
                     "attestation_id", "cqs_score", "event"):
            val = getattr(record, key, None)
            if val is not None:
                entry[key] = val

        # Include exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(entry, default=str)


class TextFormatter(logging.Formatter):
    """Human-readable formatter for local dev (LOG_FORMAT=text)."""

    FMT = "%(asctime)s %(levelname)-5s [%(name)s] %(message)s"

    def __init__(self) -> None:
        super().__init__(fmt=self.FMT, datefmt="%H:%M:%S")


# ── Configuration ───────────────────────────────────────────────────────────


_configured = False


def configure_logging(
    level: Optional[str] = None,
    fmt: Optional[str] = None,
) -> None:
    """
    Configure the root LaunchOps logging hierarchy. Safe to call multiple
    times — subsequent calls are no-ops.

    Args:
        level: DEBUG | INFO | WARNING | ERROR. Overrides LOG_LEVEL env var.
        fmt:   json | text. Overrides LOG_FORMAT env var.
    """
    global _configured
    if _configured:
        return
    _configured = True

    level = (level or os.getenv("LOG_LEVEL", "INFO")).upper()
    fmt = (fmt or os.getenv("LOG_FORMAT", "json")).lower()

    handler = logging.StreamHandler(sys.stderr)
    if fmt == "json":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(TextFormatter())

    # Configure all LaunchOps loggers
    for prefix in ("LaunchOps", "launchops"):
        logger = logging.getLogger(prefix)
        logger.setLevel(getattr(logging, level, logging.INFO))
        logger.addHandler(handler)
        logger.propagate = False

    # Also attach to the root "uvicorn" loggers so FastAPI request logs
    # don't interleave unstructured text with our JSON.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv = logging.getLogger(name)
        uv.handlers.clear()
        uv.addHandler(handler)
        uv.propagate = False
