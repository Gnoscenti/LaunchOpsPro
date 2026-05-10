"""
Business specification data models.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class ProductType(str, Enum):
    SAAS = "saas"
    MARKETPLACE = "marketplace"
    ECOMMERCE = "ecommerce"
    AGENCY = "agency"


class BusinessModel(str, Enum):
    SUBSCRIPTION = "subscription"
    ONE_TIME = "one_time"
    FREEMIUM = "freemium"
    USAGE_BASED = "usage_based"


class Channel(str, Enum):
    SEO = "seo"
    PAID = "paid"
    SOCIAL = "social"
    REFERRAL = "referral"
    OUTBOUND = "outbound"


@dataclass
class PricingTier:
    name: str
    price_monthly: float
    features: List[str] = field(default_factory=list)


@dataclass
class ICP:
    """Ideal Customer Profile."""
    industry: str = ""
    company_size: str = ""
    role: str = ""
    pain_points: List[str] = field(default_factory=list)


@dataclass
class BuildConstraints:
    budget_usd: float = 0.0
    timeline_days: int = 30
    team_size: int = 1
    tech_stack: List[str] = field(default_factory=list)


@dataclass
class BusinessSpec:
    name: str
    description: str
    product_type: ProductType = ProductType.SAAS
    business_model: BusinessModel = BusinessModel.SUBSCRIPTION
    icp: Optional[ICP] = None
    pricing_tiers: List[PricingTier] = field(default_factory=list)
    channels: List[Channel] = field(default_factory=list)
    constraints: Optional[BuildConstraints] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
