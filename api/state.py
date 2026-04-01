"""
Shared application state — Atlas orchestrator and context singletons.

Both the CLI (`python launchops.py launch`) and the API server share
the same orchestrator and context, ensuring a single source of truth.
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

_atlas: Optional[AtlasOrchestrator] = None
_context: Optional[SharedContext] = None

# In-memory run history (persists for the lifetime of the API process)
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
    return _atlas


def get_context() -> SharedContext:
    """Get the shared context (creates Atlas if needed)."""
    get_atlas()
    return _context
