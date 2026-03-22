"""Gnoscenti Atlas Engine — E-Commerce Vertical Template"""
from __future__ import annotations
from typing import Any, Dict
from verticals.base import VerticalTemplate


class EcommerceVertical(VerticalTemplate):
    name = "ecommerce"
    description = "E-commerce store with WooCommerce, Stripe, and email marketing"
    agents = ["security", "paralegal", "repo", "stripe", "email", "wordpress", "mautic", "support", "analytics", "growth"]

    def get_agent_config(self, agent_name: str, context: Dict) -> Dict[str, Any]:
        configs = {
            "paralegal": {"type": "generate_formation_docs", "entity_type": "LLC", "state": "Wyoming"},
            "stripe": {
                "type": "configure_stripe",
                "plans": [
                    {"name": "Standard", "price_monthly": 0, "price_yearly": 0, "features": ["Pay per order"]},
                ],
            },
            "wordpress": {"type": "deploy_wordpress", "plugins_extra": ["woocommerce", "woocommerce-stripe"]},
            "email": {"type": "configure_email", "provider": "sendgrid"},
            "growth": {"billing_validated": True, "analytics_validated": True},
        }
        return configs.get(agent_name, {"type": f"deploy_{agent_name}"})
