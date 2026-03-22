"""Gnoscenti Atlas Engine — Agency Vertical Template"""
from __future__ import annotations
from typing import Any, Dict
from verticals.base import VerticalTemplate


class AgencyVertical(VerticalTemplate):
    name = "agency"
    description = "Service agency with project management, client portal, and invoicing"
    agents = ["security", "paralegal", "repo", "stripe", "email", "wordpress", "files", "project", "support", "analytics", "growth"]

    def get_agent_config(self, agent_name: str, context: Dict) -> Dict[str, Any]:
        configs = {
            "paralegal": {"type": "generate_formation_docs", "entity_type": "LLC", "state": context.get("state", "Delaware")},
            "stripe": {
                "type": "configure_stripe",
                "plans": [
                    {"name": "Retainer", "price_monthly": 2500, "price_yearly": 25000, "features": ["20 hours/month", "Dedicated PM", "Weekly reports"]},
                    {"name": "Project", "price_monthly": 5000, "price_yearly": 50000, "features": ["40 hours/month", "Full team access", "Daily standups"]},
                ],
            },
            "email": {"type": "configure_email", "provider": "postmark"},
            "growth": {"billing_validated": True, "analytics_validated": True},
        }
        return configs.get(agent_name, {"type": f"deploy_{agent_name}"})
