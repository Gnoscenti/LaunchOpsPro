"""
Shared application state — Atlas orchestrator, context, and persistent store.

Both the CLI (`python launchops.py launch`) and the API server share
the same orchestrator and context, ensuring a single source of truth.

The `run_store` list is a thin compatibility shim over the SQLite-backed
StateStore (core/store.py). Existing routes that append to `run_store`
still work but the data is also persisted to disk and survives restarts.
"""

import sys
from pathlib import Path
from typing import List, Optional

# Ensure repo root is importable
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from core.orchestrator import AtlasOrchestrator
from core.context import SharedContext
from core.store import get_store

_atlas: Optional[AtlasOrchestrator] = None
_context: Optional[SharedContext] = None

# Compatibility shim: existing routes append to this list. We keep it for
# in-process reads but also write-through to SQLite so data survives.
run_store: List[dict] = []


def get_atlas() -> AtlasOrchestrator:
    """Get or create the global Atlas orchestrator with all agents and handlers wired."""
    global _atlas, _context
    if _atlas is None:
        # Use the full build_system to get agents + handlers wired
        from launchops import build_system
        system = build_system()
        _atlas = system["orchestrator"]
        _context = system.get("context", _atlas.context)

        # Hydrate in-memory run_store from SQLite on first boot
        store = get_store()
        for run in store.list_runs(limit=100):
            run_store.append(run)
    return _atlas


def get_context() -> SharedContext:
    """Get the shared context (creates Atlas if needed)."""
    get_atlas()
    return _context
