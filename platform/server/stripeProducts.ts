/**
 * Stripe Product & Price Configuration
 * =====================================
 * Centralized definitions for all subscription tiers.
 * Product and Price IDs are pre-configured from the Stripe sandbox.
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-04-22.dahlia",
});

export { stripe };

// ─── Tier → Stripe Mapping ─────────────────────────────────────────────

export interface StripeTierProduct {
  tierId: "founder" | "governance" | "enterprise";
  name: string;
  description: string;
  priceAmountCents: number; // monthly price in cents
  productId: string; // Stripe product ID
  priceId: string; // Stripe recurring price ID
  features: string[];
}

export const STRIPE_TIER_PRODUCTS: StripeTierProduct[] = [
  {
    tierId: "founder",
    name: "Founder Autopilot",
    description:
      "AI-powered business orchestration for founders. 25 reports/month, full agent access, Naming Contest, Documentary Tracker, Founder Score analytics.",
    priceAmountCents: 4900, // $49/mo
    productId: "prod_URdypveNM0oR16",
    priceId: "price_1TSkgvKnsQ10RdBLsCrJ1kiv",
    features: [
      "Unlimited reports & executions",
      "All 25 agents unlocked",
      "Full 20-step Business Launch Pipeline",
      "Real-time SSE execution streaming",
      "Artifact storage & download",
      "Priority execution queue",
      "Email support",
    ],
  },
  {
    tierId: "governance",
    name: "Governance Shield",
    description:
      "Full ProofGuard governance with immutable attestation audit trails, CQS scoring, HITL approval gates, unlimited reports, priority support, and compliance-grade documentation.",
    priceAmountCents: 29900, // $299/mo
    productId: "prod_URdyycoqgM2CxE",
    priceId: "price_1TSkh7KnsQ10RdBLLgzgum4U",
    features: [
      "Everything in Founder Autopilot",
      "ProofGuard governance engine",
      "HITL approval gates",
      "Immutable attestation audit trail",
      "Compliance export (PDF/JSON)",
      "CQS scoring & risk classification",
      "Dedicated Slack channel",
      "Documentary-ready proof records",
    ],
  },
  {
    tierId: "enterprise",
    name: "Enterprise Command",
    description:
      "White-label deployment, dedicated account manager, custom agent development, SLA guarantees, multi-tenant architecture, API access, and full platform customization.",
    priceAmountCents: 150000, // $1,500/mo
    productId: "prod_URdznUXhHGPFNJ",
    priceId: "price_1TSkhKKnsQ10RdBLF43nD35i",
    features: [
      "Everything in Governance Shield",
      "White-label deployment",
      "Custom agent development",
      "Dedicated account manager",
      "99.9% SLA guarantee",
      "SSO / SAML integration",
      "On-premise option",
      "Custom training & onboarding",
    ],
  },
];

// ─── Direct ID Lookup (no API calls needed) ───────────────────────────

/**
 * Get the Stripe Price ID for a specific tier.
 * Direct lookup — no API calls, no lazy creation.
 */
export function getStripePriceId(
  tierId: "founder" | "governance" | "enterprise"
): string {
  const tier = STRIPE_TIER_PRODUCTS.find((t) => t.tierId === tierId);
  if (!tier) throw new Error(`Unknown tier: ${tierId}`);
  return tier.priceId;
}

/**
 * Get the Stripe Product ID for a specific tier.
 */
export function getStripeProductId(
  tierId: "founder" | "governance" | "enterprise"
): string {
  const tier = STRIPE_TIER_PRODUCTS.find((t) => t.tierId === tierId);
  if (!tier) throw new Error(`Unknown tier: ${tierId}`);
  return tier.productId;
}

/**
 * Resolve a Stripe Price ID back to a tier ID.
 * Used by webhooks to determine which tier a subscription belongs to.
 */
export function getTierIdFromPriceId(
  priceId: string
): "founder" | "governance" | "enterprise" | null {
  const tier = STRIPE_TIER_PRODUCTS.find((t) => t.priceId === priceId);
  return tier ? tier.tierId : null;
}

/**
 * Resolve a Stripe Product ID back to a tier ID.
 * Used by webhooks as fallback when price ID doesn't match.
 */
export function getTierIdFromProductId(
  productId: string
): "founder" | "governance" | "enterprise" | null {
  const tier = STRIPE_TIER_PRODUCTS.find((t) => t.productId === productId);
  return tier ? tier.tierId : null;
}

/**
 * Get or create a Stripe Customer for a user.
 * If the user already has a stripeCustomerId, return it.
 * Otherwise create a new customer and return the ID.
 */
export async function getOrCreateStripeCustomer(user: {
  id: number;
  email?: string | null;
  name?: string | null;
  stripeCustomerId?: string | null;
}): Promise<string> {
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: user.name || undefined,
    metadata: {
      user_id: user.id.toString(),
      platform: "atlas_orchestrator",
    },
  });

  return customer.id;
}
