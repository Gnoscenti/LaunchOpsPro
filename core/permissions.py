"""Tool permissions and human approval layer."""
import os
from typing import List, Dict, Set
from enum import Enum


# Feature Flag for Human Approval
# By default, personal/founder edition has no guardrails (ENABLE_HUMAN_APPROVAL=False)
ENABLE_HUMAN_APPROVAL = os.getenv("ENABLE_HUMAN_APPROVAL", "false").lower() == "true"


class ToolPermission(str, Enum):
    """Available tool permissions."""
    FILESYSTEM = "filesystem"
    SHELL = "shell"
    GIT = "git"
    STRIPE = "stripe"
    GCLOUD = "gcloud"
    PLAYWRIGHT = "playwright"
    EMAIL = "email"
    SOCIAL = "social"


# Dangerous operations that require human approval if flag is enabled
REQUIRES_HUMAN_APPROVAL = {
    "stripe_create_product",
    "stripe_create_price",
    "stripe_create_webhook",
    "email_send_campaign",
    "social_post_content",
    "shell_sudo",
    "git_push",
    "playwright_submit_form",
}


class PermissionManager:
    """Manages tool permissions and human approval."""
    
    def __init__(self):
        self.requires_approval = REQUIRES_HUMAN_APPROVAL.copy()
    
    def requires_human_approval(self, operation: str) -> bool:
        """Check if an operation requires human approval."""
        if not ENABLE_HUMAN_APPROVAL:
            return False
        return operation in self.requires_approval


# Global permission manager instance
permission_manager = PermissionManager()
