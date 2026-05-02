from typing import List, Dict, Any

class SaaSVertical:
    """
    SaaS Vertical Template for Founder Autopilot.
    Adapted from ATLAS LaunchOps.
    """
    name = "saas"
    description = "B2B/B2C SaaS with subscription billing and product-led growth"
    
    # Ordered list of steps/agents to execute
    steps = [
        "security",    # 1. Generate credentials
        "legal",       # 2. Legal formation
        "repo",        # 3. GitHub repo setup
        "stripe",      # 4. Subscription billing
        "email",       # 5. Transactional email
        "website",     # 6. Marketing site
        "marketing",   # 7. Marketing automation
        "support",     # 8. Customer support
        "analytics",   # 9. Analytics setup
        "project",     # 10. Project management
        "growth",      # 11. GTM strategy
    ]

    def get_config(self, step_name: str) -> Dict[str, Any]:
        """Returns the configuration for a specific step."""
        configs = {
            "legal": {
                "type": "generate_formation_docs",
                "entity_type": "LLC",
                "state": "Delaware",
                "notes": "Recommended for solo founders. Use C-Corp for VC funding."
            },
            "stripe": {
                "type": "configure_stripe",
                "plans": [
                    {"name": "Starter", "price": 29, "interval": "month"},
                    {"name": "Pro", "price": 79, "interval": "month"},
                    {"name": "Enterprise", "price": 299, "interval": "month"},
                ]
            },
            "website": {
                "type": "deploy_website",
                "stack": "nextjs",
                "hosting": "vercel"
            },
            "growth": {
                "requirements": ["stripe", "analytics"],
                "strategy": "product_led_growth"
            }
        }
        return configs.get(step_name, {"type": f"execute_{step_name}"})
