"""
Persistent State Store — Sprint 1 Hardening
=============================================

SQLite-backed storage for deployments, run records, and HITL decisions.
Replaces the in-memory Python dicts that died on restart and broke under
multi-worker uvicorn.

Uses synchronous sqlite3 (not aiosqlite) via a thin thread-safe wrapper
so we avoid adding a new dependency. All write paths use WAL mode for
concurrent-reader safety.

Tables:
    deployments     Active and historical pipeline deployments
    runs            Pipeline execution run records
    hitl_decisions  Human-in-the-loop approve/reject state

Usage:
    from core.store import get_store

    store = get_store()
    store.save_deployment(deployment_id, status, payload)
    dep = store.get_deployment(deployment_id)
    store.save_hitl_decision(attestation_id, "APPROVED")
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("LaunchOps.store")

# ── Default DB path ─────────────────────────────────────────────────────────

_DEFAULT_DB_DIR = os.path.expanduser("~/.launchops/data")
_DEFAULT_DB_PATH = os.path.join(_DEFAULT_DB_DIR, "launchops.db")


# ── Schema ──────────────────────────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS deployments (
    deployment_id   TEXT PRIMARY KEY,
    status          TEXT NOT NULL DEFAULT 'pending',
    payload         TEXT,
    started_at      TEXT NOT NULL,
    completed_at    TEXT,
    event_count     INTEGER DEFAULT 0,
    last_error      TEXT,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
    run_id          TEXT PRIMARY KEY,
    started_at      TEXT NOT NULL,
    completed_at    TEXT,
    status          TEXT NOT NULL DEFAULT 'running',
    stages_completed INTEGER DEFAULT 0,
    stages_total    INTEGER DEFAULT 0,
    errors          TEXT,
    artifacts       TEXT,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hitl_decisions (
    attestation_id  TEXT PRIMARY KEY,
    status          TEXT NOT NULL DEFAULT 'PENDING',
    reason          TEXT,
    decided_at      TEXT,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_hitl_status ON hitl_decisions(status);
"""


# ── Store class ─────────────────────────────────────────────────────────────


class StateStore:
    """
    Thread-safe SQLite state store. One instance per process, reused
    across all routes and the orchestrator.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or os.getenv("LAUNCHOPS_DB_PATH", _DEFAULT_DB_PATH)
        self._local = threading.local()
        self._ensure_dir()
        self._init_schema()
        logger.info("StateStore initialized at %s", self.db_path)

    def _ensure_dir(self) -> None:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

    @property
    def _conn(self) -> sqlite3.Connection:
        """One connection per thread (sqlite3 is not thread-safe by default)."""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            conn = sqlite3.connect(self.db_path, timeout=10)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=5000")
            self._local.conn = conn
        return self._local.conn

    def _init_schema(self) -> None:
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def _now(self) -> str:
        return datetime.utcnow().isoformat() + "Z"

    # ── Deployments ─────────────────────────────────────────────────────────

    def save_deployment(
        self,
        deployment_id: str,
        status: str = "pending",
        payload: Optional[Dict[str, Any]] = None,
        started_at: Optional[str] = None,
        completed_at: Optional[str] = None,
        event_count: int = 0,
        last_error: Optional[str] = None,
    ) -> None:
        now = self._now()
        self._conn.execute(
            """
            INSERT INTO deployments
                (deployment_id, status, payload, started_at, completed_at,
                 event_count, last_error, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(deployment_id) DO UPDATE SET
                status = excluded.status,
                completed_at = excluded.completed_at,
                event_count = excluded.event_count,
                last_error = excluded.last_error,
                updated_at = excluded.updated_at
            """,
            (
                deployment_id,
                status,
                json.dumps(payload or {}, default=str),
                started_at or now,
                completed_at,
                event_count,
                last_error,
                now,
            ),
        )
        self._conn.commit()

    def get_deployment(self, deployment_id: str) -> Optional[Dict[str, Any]]:
        row = self._conn.execute(
            "SELECT * FROM deployments WHERE deployment_id = ?", (deployment_id,)
        ).fetchone()
        return self._row_to_dict(row) if row else None

    def list_deployments(self, limit: int = 50) -> List[Dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM deployments ORDER BY started_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    # ── Runs ────────────────────────────────────────────────────────────────

    def save_run(
        self,
        run_id: str,
        status: str = "running",
        started_at: Optional[str] = None,
        completed_at: Optional[str] = None,
        stages_completed: int = 0,
        stages_total: int = 0,
        errors: Optional[List[Dict[str, Any]]] = None,
        artifacts: Optional[List[str]] = None,
    ) -> None:
        now = self._now()
        self._conn.execute(
            """
            INSERT INTO runs
                (run_id, started_at, completed_at, status, stages_completed,
                 stages_total, errors, artifacts, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(run_id) DO UPDATE SET
                status = excluded.status,
                completed_at = excluded.completed_at,
                stages_completed = excluded.stages_completed,
                errors = excluded.errors,
                updated_at = excluded.updated_at
            """,
            (
                run_id,
                started_at or now,
                completed_at,
                status,
                stages_completed,
                stages_total,
                json.dumps(errors or [], default=str),
                json.dumps(artifacts or [], default=str),
                now,
            ),
        )
        self._conn.commit()

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        row = self._conn.execute(
            "SELECT * FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
        return self._row_to_dict(row) if row else None

    def list_runs(self, limit: int = 50) -> List[Dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM runs ORDER BY started_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    # ── HITL decisions ──────────────────────────────────────────────────────

    def save_hitl_decision(
        self,
        attestation_id: str,
        status: str = "PENDING",
        reason: Optional[str] = None,
    ) -> None:
        now = self._now()
        decided_at = now if status in ("APPROVED", "REJECTED") else None
        self._conn.execute(
            """
            INSERT INTO hitl_decisions
                (attestation_id, status, reason, decided_at, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(attestation_id) DO UPDATE SET
                status = excluded.status,
                reason = excluded.reason,
                decided_at = excluded.decided_at
            """,
            (attestation_id, status, reason, decided_at, now),
        )
        self._conn.commit()

    def get_hitl_decision(self, attestation_id: str) -> Optional[Dict[str, Any]]:
        row = self._conn.execute(
            "SELECT * FROM hitl_decisions WHERE attestation_id = ?",
            (attestation_id,),
        ).fetchone()
        return self._row_to_dict(row) if row else None

    # ── Helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        # Parse JSON columns back into dicts/lists
        for col in ("payload", "errors", "artifacts"):
            if col in d and isinstance(d[col], str):
                try:
                    d[col] = json.loads(d[col])
                except (json.JSONDecodeError, TypeError):
                    pass
        return d

    def close(self) -> None:
        if hasattr(self._local, "conn") and self._local.conn:
            self._local.conn.close()
            self._local.conn = None


# ── Singleton ───────────────────────────────────────────────────────────────

_store: Optional[StateStore] = None
_lock = threading.Lock()


def get_store() -> StateStore:
    global _store
    if _store is None:
        with _lock:
            if _store is None:
                _store = StateStore()
    return _store
