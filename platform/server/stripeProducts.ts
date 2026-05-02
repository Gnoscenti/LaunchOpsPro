/**
 * Stripe Product & Price Configuration
 * =====================================
 * Centralized definitions for all subscription tiers.
 * Products and prices are created lazily on first checkout via ensureStripeProducts().
 * IDs are cached in memory after first creation.
 */

import Stripe from "stripe";

// Initialize Stripe only if the key is provided, otherwise create a dummy object
// to prevent the app from crashing on startup when the key is missing.
const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeKey 
  ? new Stripe(stripeKey, { apiVersion: "2025-01-27.acacia" as any }) 
  : ({} as Stripe);

export { stripe };

// ─── Tier → Stripe Mapping ─────────────────────────────────────────────

export interface StripeTierProduct {
  tierId: "founder" | "governance" | "enterprise";
  name: string;
  description: string;
  priceAmountCents: number; // monthly price in cents
  features: string[];
}

export const STRIPE_TIER_PRODUCTS: StripeTierProduct[] = [
  {
    tierId: "founder",
    name: "Founder Autopilot",
    description:
      "Unlimited reports, all 25 agents, full pipeline, priority execution, email support.",
    priceAmountCents: 4900, // $49/mo
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
    name: "Governance Pro",
    description:
      "Everything in Founder + ProofGuard, HITL gates, compliance exports, documentary-ready proofs.",
    priceAmountCents: 29900, // $299/mo
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
    name: "Enterprise",
    description:
      "White-label, custom agents, dedicated account manager, 99.9% SLA, SSO/SAML, on-premise option.",
    priceAmountCents: 150000, // $1,500/mo
    features: [
      "Everything in Governance Pro",
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

// ─── Cached Stripe IDs (populated on first call) ───────────────────────

interface CachedIds {
  productId: string;
  priceId: string;
}

const priceCache = new Map<string, CachedIds>();

/**
 * Find or create Stripe Product + Price for a given tier.
 * Uses metadata lookup to avoid duplicates across restarts.
 */
async function findOrCreateProduct(
  tier: StripeTierProduct
): Promise<CachedIds> {
  // Check cache first
  const cached = priceCache.get(tier.tierId);
  if (cached) return cached;

  // Search for existing product by metadata
  const existingProducts = await stripe.products.search({
    query: `metadata["tier_id"]:"${tier.tierId}"`,
  });

  let productId: string;
  let priceId: string;

  if (existingProducts.data.length > 0) {
    const product = existingProducts.data[0];
    productId = product.id;

    // Find the active monthly price
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      type: "recurring",
      limit: 1,
    });

    if (prices.data.length > 0) {
      priceId = prices.data[0].id;
    } else {
      // Create price if missing
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: tier.priceAmountCents,
        currency: "usd",
        recurring: { interval: "month" },
      });
      priceId = price.id;
    }
  } else {
    // Create new product + price
    const product = await stripe.products.create({
      name: tier.name,
      description: tier.description,
      metadata: {
        tier_id: tier.tierId,
        platform: "atlas_orchestrator",
      },
    });
    productId = product.id;

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: tier.priceAmountCents,
      currency: "usd",
      recurring: { interval: "month" },
    });
    priceId = price.id;
  }

  const ids = { productId, priceId };
  priceCache.set(tier.tierId, ids);
  return ids;
}

/**
 * Ensure all Stripe products and prices exist.
 * Call this once at startup or before first checkout.
 */
export async function ensureStripeProducts(): Promise<
  Map<string, CachedIds>
> {
  for (const tier of STRIPE_TIER_PRODUCTS) {
    await findOrCreateProduct(tier);
  }
  return priceCache;
}

/**
 * Get the Stripe Price ID for a specific tier.
 * Will create the product/price if it doesn't exist yet.
 */
export async function getStripePriceId(
  tierId: "founder" | "governance" | "enterprise"
): Promise<string> {
  const tier = STRIPE_TIER_PRODUCTS.find((t) => t.tierId === tierId);
  if (!tier) throw new Error(`Unknown tier: ${tierId}`);
  const ids = await findOrCreateProduct(tier);
  return ids.priceId;
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
