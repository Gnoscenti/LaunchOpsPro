"""
Permission manager stub.
In production this would gate agent actions behind HITL approval.
In MOCK_MODE all actions are auto-approved.
"""

from __future__ import annotations

import os
from typing import Any, Dict


class PermissionManager:
    """Controls which agent actions require human-in-the-loop approval."""

    def __init__(self) -> None:
        self.mock_mode = os.getenv("MOCK_MODE", "true").lower() == "true"
        self._approved: Dict[str, bool] = {}

    def requires_approval(self, action: str) -> bool:
        """Return True if the action needs explicit human approval."""
        if self.mock_mode:
            return False
        high_risk = {"stripe", "legal", "repo", "email"}
        return action in high_risk

    def approve(self, action: str, context: Dict[str, Any] | None = None) -> bool:
        """Approve an action. Auto-approves in mock mode."""
        if self.mock_mode:
            return True
        self._approved[action] = True
        return True

    def is_approved(self, action: str) -> bool:
        return self.mock_mode or self._approved.get(action, False)


# Singleton used by orchestrator
permission_manager = PermissionManager()
