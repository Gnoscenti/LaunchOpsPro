"""
Gnoscenti Atlas Engine - Audit Log
Append-only structured log of every agent action.
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

LOG_DIR = Path.home() / ".atlas-launchops" / "logs"


def _log_path() -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    return LOG_DIR / f"audit_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.jsonl"


def record(
    agent: str,
    action: str,
    status: str,                    # "success" | "failure" | "skipped"
    details: Optional[Dict[str, Any]] = None,
    error: Optional[str] = None,
) -> None:
    """Append a structured audit record to today's log file."""
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "agent": agent,
        "action": action,
        "status": status,
        "details": details or {},
    }
    if error:
        entry["error"] = error

    try:
        with open(_log_path(), "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as exc:
        logging.getLogger("atlas.audit").warning(f"Failed to write audit log: {exc}")


def tail(n: int = 50) -> list:
    """Return the last n audit records from today's log."""
    path = _log_path()
    if not path.exists():
        return []
    lines = path.read_text().strip().splitlines()
    return [json.loads(l) for l in lines[-n:]]
