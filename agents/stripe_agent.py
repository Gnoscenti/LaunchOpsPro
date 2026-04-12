"""
Stripe Agent — Tier 1 Financial Operator
========================================

Phase 1 (sync):
    Builds Stripe setup instructions, webhook configs, and product specs.
    Called via BaseAgent.execute(task) from core/stage_handlers.handle_payments.

Phase 2 (MCP-integrated):
    Exposes capabilities through an MCPGateway so other agents (internal or
    external) can invoke them via standardized tool-calling, and defines
    propose_plan() so ProofGuard can attest Stripe actions before they fire.

The class supports BOTH call styles:
  * Legacy dynamic loader: StripeAgent(llm_client=llm, config=cfg)
  * Phase 2 wiring:         StripeAgent(llm_client=llm, config=cfg, mcp_gateway=gw)
  * Tests:                  StripeAgent()

MCP-exposed capabilities:
  * create_saas_subscription  — Create a Stripe Product + recurring Price
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from .base import BaseAgent

# Stripe is optional: if the package is missing, MCP capability still registers
# (producing a clear runtime error only when someone actually tries to use it).
try:
    import stripe  # type: ignore
except ImportError:  # pragma: no cover
    stripe = None  # type: ignore


logger = logging.getLogger("LaunchOps.StripeAgent")


class StripeAgent(BaseAgent):
    """
    Automates Stripe account creation, product/price setup, and subscription
    billing. In Phase 2, also exposes MCP capabilities and implements the
    async propose_plan() hook for ProofGuard attestation.
    """

    def __init__(
        self,
        llm_client: Any = None,
        config: Optional[Dict] = None,
        mcp_gateway: Any = None,
    ):
        super().__init__(
            name="Stripe Agent",
            role="Payment Processing Setup",
            llm_client=llm_client,
            config=config or {},
        )
        self.mcp = mcp_gateway

        # Stripe SDK key — optional; absence is non-fatal until a live call runs
        if stripe is not None:
            stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

        if self.mcp is not None:
            self._register_mcp_capabilities()

    # ── MCP registration ──────────────────────────────────────────────────

    def _register_mcp_capabilities(self) -> None:
        """Expose this agent's capabilities to the broader ecosystem."""
        self.mcp.expose_capability(
            name="create_saas_subscription",
            description=(
                "Creates a Stripe Product and recurring Price for a SaaS tier. "
                "Returns product_id and price_id."
            ),
            schema={
                "type": "object",
                "properties": {
                    "tier_name": {
                        "type": "string",
                        "description": "Human-readable tier name, e.g., 'Pro', 'Enterprise'",
                    },
                    "monthly_price_usd": {
                        "type": "integer",
                        "description": "Monthly price in whole USD dollars",
                    },
                    "currency": {
                        "type": "string",
                        "description": "ISO currency code (default: usd)",
                        "default": "usd",
                    },
                    "interval": {
                        "type": "string",
                        "enum": ["day", "week", "month", "year"],
                        "default": "month",
                    },
                },
                "required": ["tier_name", "monthly_price_usd"],
            },
            func=self.create_subscription_tier,
        )
        logger.info("StripeAgent MCP capabilities registered")

    # ── MCP-callable async execution ──────────────────────────────────────

    async def create_subscription_tier(
        self,
        tier_name: str,
        monthly_price_usd: int,
        currency: str = "usd",
        interval: str = "month",
    ) -> Dict[str, Any]:
        """
        Create a Stripe Product + recurring Price. Intended to be called by
        the MCP execution loop after ProofGuard has attested the plan.

        The signature uses keyword arguments (not an `args: dict`) because
        MCPGateway.invoke_local calls `func(**kwargs)`. Callers who have an
        args dict can still do `await agent.create_subscription_tier(**args)`.
        """
        if stripe is None:
            return {
                "success": False,
                "error": "stripe package not installed. Run `pip install stripe`.",
            }
        if not stripe.api_key:
            return {
                "success": False,
                "error": "STRIPE_SECRET_KEY not set in environment.",
            }

        logger.info(
            "[Stripe] Creating subscription tier: %s @ $%d/%s",
            tier_name,
            monthly_price_usd,
            interval,
        )

        try:
            product = stripe.Product.create(name=tier_name)
            price = stripe.Price.create(
                product=product.id,
                unit_amount=monthly_price_usd * 100,  # cents
                currency=currency,
                recurring={"interval": interval},
            )
            return {
                "success": True,
                "tier_name": tier_name,
                "product_id": product.id,
                "price_id": price.id,
                "unit_amount_cents": monthly_price_usd * 100,
                "currency": currency,
                "interval": interval,
            }
        except Exception as e:
            logger.error("Stripe subscription tier creation failed: %s", e)
            return {"success": False, "error": str(e)}

    # ── Phase 2: propose_plan for ProofGuard attestation ──────────────────

    async def propose_plan(
        self, task_payload: Dict[str, Any], context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Draft the intended Stripe actions for this task and return them
        as a plan object for ProofGuard to attest. Nothing runs against
        Stripe here — this is pure intent generation.

        Falls back to a static passthrough plan if the MCPGateway or LLM
        is not configured, so Phase2Executor's adapter layer still works.
        """
        context = context or {}
        business_model = (
            context.get("intake", {}).get("pricing_strategy")
            or context.get("business", {}).get("pricing")
            or "Standard $29/mo SaaS subscription"
        )
        instruction = task_payload.get("instruction") or task_payload.get(
            "type", "setup_products"
        )

        # If no MCP gateway is wired, return a deterministic plan so the
        # ProofGuard governance layer still has something to attest.
        if self.mcp is None:
            return {
                "intended_action": "create_subscription",
                "source": "static_plan",
                "tier_name": task_payload.get("tier_name", "Pro"),
                "monthly_price_usd": task_payload.get("monthly_price_usd", 29),
                "business_model": business_model,
                "instruction": instruction,
            }

        # Otherwise let the LLM pick which registered MCP tools to call
        prompt = (
            f"Business model: {business_model}\n"
            f"Target request: {instruction}\n\n"
            "Formulate the exact MCP tool call(s) needed to execute this setup. "
            "Return a JSON object with `tool_name` and `arguments`."
        )

        try:
            intent = await self.mcp.execute_agent_chain(
                system_prompt="You are a Stripe Revenue Architect.",
                task=prompt,
                allowed_tools=["create_saas_subscription"],
            )
        except Exception as e:
            logger.warning("propose_plan LLM call failed, falling back: %s", e)
            intent = None

        return {
            "intended_action": "create_subscription",
            "source": "llm" if intent else "static_plan",
            "business_model": business_model,
            "instruction": instruction,
            "payload": intent,
        }

    # ── Phase 1: sync analyze + execute (unchanged behavior) ──────────────

    def analyze(self, context: Dict) -> Dict:
        """Analyze payment requirements."""
        business_name = context.get("business_name")
        business_type = context.get("business_type", "saas")
        pricing_model = context.get("pricing_model", "subscription")

        recommendations: List[str] = []
        if pricing_model == "subscription":
            recommendations.append("Use Stripe Billing for recurring payments")
            recommendations.append("Setup subscription tiers with different features")
            recommendations.append("Enable automatic invoice generation")
        elif pricing_model == "one-time":
            recommendations.append("Use Stripe Checkout for one-time payments")
            recommendations.append("Create payment links for easy sharing")

        recommendations.extend(
            [
                "Enable 3D Secure for fraud protection",
                "Setup webhooks for payment notifications",
                "Configure tax calculation (if applicable)",
                "Enable customer portal for self-service",
            ]
        )

        return {
            "business_name": business_name,
            "business_type": business_type,
            "pricing_model": pricing_model,
            "recommended_payment_methods": ["card", "us_bank_account", "link"],
            "recommended_features": [
                "automatic_tax",
                "customer_portal",
                "invoice_generation",
                "payment_method_update",
            ],
            "recommendations": recommendations,
        }

    def execute(self, task: Dict) -> Dict:
        """
        Sync execution path — used by the Phase 1 stage handler.
        For async MCP-driven execution, use create_subscription_tier() instead.
        """
        task_type = task.get("type")

        if task_type == "create_account":
            return self._create_account(task)
        elif task_type == "configure_webhooks":
            return self._configure_webhooks(task)
        elif task_type in ("create_products", "setup_products"):
            return self._create_products(task)
        elif task_type == "setup_billing":
            return self._setup_billing(task)
        elif task_type == "create_payment_links":
            return self._create_payment_links(task)
        else:
            return {"success": False, "error": f"Unknown task type: {task_type}"}

    # ── Sync helpers (unchanged from Phase 1) ─────────────────────────────

    def _create_account(self, task: Dict) -> Dict:
        """Create Stripe account (instructions only — KYC is manual)."""
        business_name = task.get("business_name")
        email = task.get("email")
        country = task.get("country", "US")
        return {
            "success": True,
            "account_type": "Standard",
            "instructions": [
                "1. Visit https://dashboard.stripe.com/register",
                f"2. Sign up with email: {email}",
                f"3. Business name: {business_name}",
                f"4. Country: {country}",
                "5. Complete identity verification (KYC)",
                "6. Activate your account",
                "7. Get API keys from Developers → API keys",
                "8. Store keys in Bitwarden vault",
            ],
            "kyc_requirements": [
                "Business EIN or SSN",
                "Business address",
                "Bank account details",
                "Identity verification (passport/license)",
            ],
            "timeline": "1-3 business days for verification",
            "test_mode": {
                "note": "Use test mode for development",
                "test_card": "4242 4242 4242 4242",
                "test_keys": "Available immediately without verification",
            },
        }

    def _configure_webhooks(self, task: Dict) -> Dict:
        """Configure Stripe webhooks."""
        webhook_url = task.get("webhook_url")
        events = task.get(
            "events",
            [
                "checkout.session.completed",
                "customer.subscription.created",
                "customer.subscription.updated",
                "customer.subscription.deleted",
                "invoice.payment_succeeded",
                "invoice.payment_failed",
                "payment_intent.succeeded",
                "payment_intent.payment_failed",
            ],
        )
        return {
            "success": True,
            "webhook_url": webhook_url,
            "events": events,
            "instructions": [
                "1. Login to Stripe Dashboard",
                "2. Go to Developers → Webhooks",
                "3. Click 'Add endpoint'",
                f"4. Enter URL: {webhook_url}",
                "5. Select events to listen for:",
                *[f"   - {event}" for event in events],
                "6. Click 'Add endpoint'",
                "7. Copy webhook signing secret",
                "8. Store secret in environment variables",
            ],
        }

    def _create_products(self, task: Dict) -> Dict:
        """Create Stripe products and prices (returns spec, not live creation)."""
        products = task.get("products") or [
            {"name": "Free", "price": 0, "interval": "month"},
            {"name": "Professional", "price": 4900, "interval": "month"},
            {"name": "Enterprise", "price": 19900, "interval": "month"},
        ]
        return {
            "success": True,
            "products": products,
            "instructions": [
                "1. Login to Stripe Dashboard",
                "2. Go to Products → Add product",
                "3. For each tier, create:",
                *[
                    f"   - {p['name']}: ${p['price']/100:.2f}/{p.get('interval', 'month')}"
                    for p in products
                    if p["price"] > 0
                ],
                "4. Set recurring billing interval",
                "5. Add product description and features",
                "6. Copy Price ID for integration",
            ],
            "note": (
                "For live creation via API, use the async "
                "create_subscription_tier() method (Phase 2)."
            ),
        }

    def _setup_billing(self, task: Dict) -> Dict:
        """Setup subscription billing (instructions)."""
        return {
            "success": True,
            "billing_features": [
                "Automatic recurring charges",
                "Prorated upgrades/downgrades",
                "Trial periods",
                "Usage-based billing",
                "Invoice generation",
                "Customer portal",
            ],
            "instructions": [
                "1. Enable Stripe Billing in Dashboard",
                "2. Configure billing settings (invoice, retry, dunning)",
                "3. Enable Customer Portal",
                "4. Integrate Stripe Checkout for new subscriptions",
            ],
        }

    def _create_payment_links(self, task: Dict) -> Dict:
        """Create Stripe payment links (instructions)."""
        return {
            "success": True,
            "payment_links": [],
            "instructions": [
                "1. Go to Payment links in Dashboard",
                "2. Click 'New payment link'",
                "3. Select product/price",
                "4. Configure options (customer info, promo codes, redirect)",
                "5. Copy shareable link",
                "6. Use in emails, social media, etc.",
            ],
            "use_cases": [
                "Share on social media for quick purchases",
                "Include in email campaigns",
                "Add to website as CTA button",
                "Send directly to customers",
                "Use for one-time offers",
            ],
        }

    def validate(self, result: Dict) -> Dict:
        """Validate Stripe setup."""
        checks = {
            "account_created": False,
            "account_verified": False,
            "api_keys_obtained": False,
            "webhooks_configured": False,
            "products_created": False,
            "test_payment_successful": False,
        }
        return {
            "valid": False,
            "checks": checks,
            "manual_verification_required": True,
            "verification_steps": [
                "1. Confirm Stripe account is active",
                "2. Verify identity verification is complete",
                "3. Check API keys are stored in vault",
                "4. Test webhook endpoint receives events",
                "5. Verify products are visible in Dashboard",
                "6. Complete test payment with test card",
                "7. Check webhook receives payment event",
            ],
            "test_payment": {
                "card": "4242 4242 4242 4242",
                "expiry": "Any future date",
                "cvc": "Any 3 digits",
                "zip": "Any 5 digits",
            },
        }
