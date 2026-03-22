"""
Gnoscenti Atlas Engine — SaaS Vertical Template
Optimized for B2B and B2C SaaS products with subscription billing.
"""
from __future__ import annotations
from typing import Any, Dict
from verticals.base import VerticalTemplate


class SaaSVertical(VerticalTemplate):
    name = "saas"
    description = "B2B/B2C SaaS with subscription billing, product-led growth"
    agents = [
        "security",    # 1. Generate all credentials first
        "paralegal",   # 2. Legal formation (Delaware C-Corp for VC, LLC for solo)
        "repo",        # 3. GitHub repo + CI/CD
        "stripe",      # 4. Subscription billing
        "email",       # 5. Transactional email + onboarding sequences
        "wordpress",   # 6. Marketing site
        "mautic",      # 7. Marketing automation
        "support",     # 8. Customer support (Chatwoot)
        "analytics",   # 9. Privacy-friendly analytics (Matomo)
        "project",     # 10. Project management (Taiga)
        "growth",      # 11. GTM strategy (gated by billing + analytics)
    ]

    def get_agent_config(self, agent_name: str, context: Dict) -> Dict[str, Any]:
        configs = {
            "paralegal": {
                "type": "generate_formation_docs",
                "entity_type": "LLC",
                "state": "Delaware",
                "recommended_state": "Delaware (LLC for solo, C-Corp for VC)",
            },
            "stripe": {
                "type": "configure_stripe",
                "plans": [
                    {"name": "Starter", "price_monthly": 29, "price_yearly": 290,
                     "features": ["5 projects", "10GB storage", "Email support"]},
                    {"name": "Pro", "price_monthly": 79, "price_yearly": 790,
                     "features": ["Unlimited projects", "100GB storage", "Priority support", "API access"]},
                    {"name": "Enterprise", "price_monthly": 299, "price_yearly": 2990,
                     "features": ["Everything in Pro", "SSO", "Dedicated support", "SLA"]},
                ],
            },
            "email": {
                "type": "configure_email",
                "provider": "postmark",
            },
            "growth": {
                "billing_validated": True,
                "analytics_validated": True,
            },
        }
        return configs.get(agent_name, {"type": f"deploy_{agent_name}"})
