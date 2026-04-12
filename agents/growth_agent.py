"""
Gnoscenti Atlas Engine - Growth Agent
Evaluates growth readiness and generates a structured GTM strategy.
Blocked by Atlas governance until billing and analytics are validated.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from agents.base import BaseAgent


CHANNEL_MATRIX = {
    "saas": {
        "primary": ["Content marketing (SEO)", "Product-led growth (free trial)", "LinkedIn outreach"],
        "secondary": ["YouTube tutorials", "Developer communities", "Partner integrations"],
        "paid": ["Google Ads (bottom-funnel)", "LinkedIn Ads (ABM)"],
    },
    "ecommerce": {
        "primary": ["Google Shopping", "Instagram/TikTok organic", "Email marketing"],
        "secondary": ["Influencer partnerships", "Pinterest", "Affiliate program"],
        "paid": ["Meta Ads", "Google Shopping Ads"],
    },
    "agency": {
        "primary": ["LinkedIn content", "Referral program", "Cold outreach"],
        "secondary": ["Case studies", "Speaking engagements", "Partnerships"],
        "paid": ["LinkedIn Ads", "Retargeting"],
    },
    "marketplace": {
        "primary": ["SEO (supply and demand pages)", "Community building", "PR"],
        "secondary": ["Partnerships", "API integrations", "Referral program"],
        "paid": ["Google Ads", "Meta Ads"],
    },
}

GROWTH_METRICS = {
    "saas": {
        "north_star": "Weekly Active Users (WAU)",
        "acquisition": ["CAC", "Organic vs Paid ratio", "Trial-to-paid conversion"],
        "retention": ["MRR Churn", "Net Revenue Retention (NRR)", "DAU/MAU ratio"],
        "monetization": ["ARPU", "LTV", "LTV:CAC ratio (target: 3:1+)"],
    },
    "ecommerce": {
        "north_star": "Revenue per Visitor",
        "acquisition": ["CAC", "ROAS", "New customer rate"],
        "retention": ["Repeat purchase rate", "Email open rate", "LTV"],
        "monetization": ["AOV", "Gross margin", "Refund rate"],
    },
}


class GrowthAgent(BaseAgent):
    def __init__(self, llm_client=None, config=None):
        super().__init__("Growth", llm_client, config)

    # ── Phase 2: propose_plan for ProofGuard attestation ────────────────

    async def propose_plan(
        self, task_payload: Dict[str, Any], context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Classify the proposed growth action. GrowthAgent is 99% read-only
        (it synthesizes strategies via LLM) but can bump to medium-risk
        when it touches live content distribution channels.

        IMDA pillar: "User Enablement" — growth outputs are directly
        founder-facing strategic recommendations.
        """
        task_type = task_payload.get("type", "growth_strategy")

        # Channel-pushing actions that modify external state
        write_actions = {
            "publish_content",
            "launch_campaign",
            "deploy_abandoned_cart",
        }

        if task_type in write_actions:
            risk_tier = "medium"
            side_effects = "external_channel_write"
            reversibility = "reversible (pause campaign)"
        else:
            risk_tier = "low"
            side_effects = "llm_only"
            reversibility = "n/a"

        business_type = task_payload.get("business_type", "saas")

        return {
            "agent": self.name,
            "intended_action": task_type,
            "risk_tier": risk_tier,
            "imda_pillar": "User Enablement",
            "business_type": business_type,
            "target_channels": CHANNEL_MATRIX.get(business_type, {}).get("primary", []),
            "side_effects": side_effects,
            "reversibility": reversibility,
            "rationale": (
                f"growth_agent will run {task_type} for a {business_type} business; "
                + (
                    "output is a strategy document only — no external writes."
                    if task_type not in write_actions
                    else "this writes to external marketing channels."
                )
            ),
        }

    def analyze(self, context: Dict[str, Any]) -> Dict[str, Any]:
        self.log_info("Generating growth strategy...")
        business_type = context.get("business_type", "saas")
        business_name = context.get("business_name", "Your Business")
        domain = context.get("domain", "")

        channels = CHANNEL_MATRIX.get(business_type, CHANNEL_MATRIX["saas"])
        metrics = GROWTH_METRICS.get(business_type, GROWTH_METRICS["saas"])

        # Use LLM for personalized strategy if available
        llm_strategy = ""
        if self.llm_client:
            prompt = f"""Generate a 90-day GTM strategy for {business_name}, a {business_type} business.
Domain: {domain}
Focus on: acquisition, activation, retention, revenue, referral (AARRR framework).
Be specific, actionable, and structured. No fluff."""
            llm_strategy = self.ask_llm(prompt)

        strategy = {
            "success": True,
            "message": "Growth strategy generated",
            "business_type": business_type,
            "channels": channels,
            "metrics": metrics,
            "90_day_plan": self._build_90_day_plan(business_type),
            "icp_framework": self._icp_framework(business_type),
            "llm_strategy": llm_strategy,
            "blockers_check": self._check_blockers(context),
        }
        return strategy

    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        return self.analyze(task)

    def _build_90_day_plan(self, business_type: str) -> Dict[str, List[str]]:
        return {
            "days_1_30": [
                "Define and document ICP (Ideal Customer Profile)",
                "Set up analytics and conversion tracking",
                "Launch landing page with clear value proposition",
                "Begin content calendar (2 posts/week minimum)",
                "Activate first 10 beta users — collect feedback",
                "Set up email welcome sequence in Mautic",
            ],
            "days_31_60": [
                "Optimize onboarding based on beta feedback",
                "Launch referral program",
                "Begin SEO content production",
                "Set up retargeting pixels",
                "Reach 100 trial signups",
                "Achieve first 10 paying customers",
            ],
            "days_61_90": [
                "Scale top-performing acquisition channel",
                "Launch case study with first paying customers",
                "Implement NPS survey",
                "Optimize pricing based on conversion data",
                "Reach MRR target: $[DEFINE TARGET]",
                "Hire first growth hire or agency",
            ],
        }

    def _icp_framework(self, business_type: str) -> Dict[str, str]:
        if business_type == "saas":
            return {
                "who": "Founders and operators at 1-50 person companies",
                "pain": "Spending too much time on manual business operations",
                "gain": "Automated, professional business infrastructure in hours not months",
                "trigger": "Just raised funding / just launched / scaling team",
                "channel": "LinkedIn, Twitter/X, Indie Hackers, Product Hunt",
            }
        return {
            "who": "[Define your ideal customer]",
            "pain": "[What problem do they have?]",
            "gain": "[What outcome do they want?]",
            "trigger": "[What event makes them buy now?]",
            "channel": "[Where do they spend time?]",
        }

    def _check_blockers(self, context: Dict) -> List[str]:
        blockers = []
        if not context.get("billing_validated"):
            blockers.append("⚠ Billing not validated — do not scale paid acquisition")
        if not context.get("analytics_validated"):
            blockers.append("⚠ Analytics not validated — cannot measure CAC or conversion")
        if not context.get("architecture_validated"):
            blockers.append("⚠ Architecture not validated — product may not be stable")
        return blockers
