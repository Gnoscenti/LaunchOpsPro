"""Gnoscenti Atlas Engine — Vertical Template Loader"""
from __future__ import annotations
from verticals.base import VerticalTemplate


def load_vertical(name: str) -> VerticalTemplate:
    from verticals.saas import SaaSVertical
    from verticals.ecommerce import EcommerceVertical
    from verticals.agency import AgencyVertical
    from verticals.marketplace import MarketplaceVertical

    registry = {
        "saas": SaaSVertical,
        "ecommerce": EcommerceVertical,
        "agency": AgencyVertical,
        "marketplace": MarketplaceVertical,
    }
    cls = registry.get(name)
    if not cls:
        raise ValueError(f"Unknown vertical: {name}. Available: {list(registry.keys())}")
    return cls()


def list_verticals() -> list:
    from verticals.saas import SaaSVertical
    from verticals.ecommerce import EcommerceVertical
    from verticals.agency import AgencyVertical
    from verticals.marketplace import MarketplaceVertical

    return [
        {"name": v.name, "description": v.description, "agents": v.agents}
        for v in [SaaSVertical(), EcommerceVertical(), AgencyVertical(), MarketplaceVertical()]
    ]
