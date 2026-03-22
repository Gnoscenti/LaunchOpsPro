"""Gnoscenti Atlas Engine — Marketplace Vertical Template"""
from __future__ import annotations
from typing import Any, Dict
from verticals.base import VerticalTemplate


class MarketplaceVertical(VerticalTemplate):
    name = "marketplace"
    description = "Two-sided marketplace with vendor management and split payments"
    agents = ["security", "paralegal", "repo", "stripe", "email", "wordpress", "mautic", "support", "analytics", "growth"]

    def get_agent_config(self, agent_name: str, context: Dict) -> Dict[str, Any]:
        configs = {
            "paralegal": {"type": "generate_formation_docs", "entity_type": "C-Corp", "state": "Delaware"},
            "stripe": {
                "type": "configure_stripe",
                "plans": [
                    {"name": "Vendor Basic", "price_monthly": 49, "price_yearly": 490, "features": ["10 listings", "Standard commission"]},
                    {"name": "Vendor Pro", "price_monthly": 149, "price_yearly": 1490, "features": ["Unlimited listings", "Reduced commission", "Featured placement"]},
                ],
            },
            "wordpress": {"type": "deploy_wordpress", "plugins_extra": ["woocommerce", "dokan-lite"]},
            "email": {"type": "configure_email", "provider": "sendgrid"},
            "growth": {"billing_validated": True, "analytics_validated": True},
        }
        return configs.get(agent_name, {"type": f"deploy_{agent_name}"})
