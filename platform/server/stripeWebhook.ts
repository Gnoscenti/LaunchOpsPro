/**
 * Stripe Webhook Handler
 * ======================
 * Handles Stripe subscription lifecycle events:
 *   - checkout.session.completed → activate subscription
 *   - customer.subscription.updated → sync tier changes
 *   - customer.subscription.deleted → downgrade to explorer
 *   - invoice.payment_failed → flag payment issue
 *
 * MUST be mounted with express.raw() body parser BEFORE express.json().
 */

import { Router, Request, Response } from "express";
import { stripe, getTierIdFromPriceId, getTierIdFromProductId } from "./stripeProducts";
import * as db from "./db";
import type Stripe from "stripe";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export const stripeWebhookRouter = Router();

// ─── Tier Mapping from Stripe Price → Our Tier ─────────────────────────

/**
 * Determine the subscription tier from a Stripe subscription object.
 * Uses direct Price ID and Product ID lookup against our hardcoded IDs.
 * Falls back to price-amount heuristic if IDs don't match.
 */
function determineTierFromSubscription(
  subscription: Stripe.Subscription
): "explorer" | "founder" | "governance" | "enterprise" {
  const item = subscription.items.data[0];
  if (!item) return "explorer";

  const price = item.price;

  // 1. Try exact Price ID match
  const tierByPrice = getTierIdFromPriceId(price.id);
  if (tierByPrice) return tierByPrice;

  // 2. Try exact Product ID match
  const productId = typeof price.product === "string" ? price.product : price.product?.id;
  if (productId) {
    const tierByProduct = getTierIdFromProductId(productId);
    if (tierByProduct) return tierByProduct;
  }

  // 3. Fallback: map by price amount (cents)
  const amount = price.unit_amount || 0;
  if (amount >= 100000) return "enterprise"; // $1000+
  if (amount >= 20000) return "governance"; // $200+
  if (amount >= 3000) return "founder"; // $30+
  return "explorer";
}

/**
 * Find the user associated with a Stripe event.
 * Checks metadata first, then falls back to customer ID lookup.
 */
async function findUserFromEvent(
  session?: Stripe.Checkout.Session | null,
  customerId?: string | null
): Promise<{ id: number } | undefined> {
  // Try metadata user_id first
  if (session?.metadata?.user_id) {
    const userId = parseInt(session.metadata.user_id, 10);
    if (!isNaN(userId)) {
      const user = await db.getUserById(userId);
      if (user) return user;
    }
  }

  // Try client_reference_id
  if (session?.client_reference_id) {
    const userId = parseInt(session.client_reference_id, 10);
    if (!isNaN(userId)) {
      const user = await db.getUserById(userId);
      if (user) return user;
    }
  }

  // Fall back to Stripe customer ID
  const custId = customerId || (typeof session?.customer === "string" ? session.customer : session?.customer?.id);
  if (custId) {
    const user = await db.getUserByStripeCustomerId(custId);
    if (user) return user;
  }

  return undefined;
}

// ─── Webhook Endpoint ──────────────────────────────────────────────────

stripeWebhookRouter.post(
  "/api/stripe/webhook",
  // express.raw() is applied at the route level in _core/index.ts
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      console.error("[Stripe Webhook] Missing stripe-signature header");
      return res.status(400).json({ error: "Missing signature" });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[Stripe Webhook] Signature verification failed: ${message}`);
      return res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    }

    console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

    // Handle test events
    if (event.id.startsWith("evt_test_")) {
      console.log("[Stripe Webhook] Test event detected, returning verification response");
      return res.json({ verified: true });
    }

    try {
      switch (event.type) {
        // ─── Checkout Completed ──────────────────────────────────────
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`[Stripe Webhook] Checkout completed: ${session.id}`);

          if (session.mode !== "subscription") {
            console.log("[Stripe Webhook] Not a subscription checkout, skipping");
            break;
          }

          const user = await findUserFromEvent(session);
          if (!user) {
            console.error("[Stripe Webhook] Could not find user for checkout session:", session.id);
            break;
          }

          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id;

          if (subscriptionId) {
            // Fetch the full subscription to determine the tier
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const tier = determineTierFromSubscription(subscription);

            await db.updateUserTier(
              user.id,
              tier,
              customerId || undefined,
              subscriptionId
            );

            console.log(
              `[Stripe Webhook] User ${user.id} upgraded to ${tier} (sub: ${subscriptionId})`
            );
          }
          break;
        }

        // ─── Subscription Updated ────────────────────────────────────
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId =
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer?.id;

          const user = await findUserFromEvent(null, customerId);
          if (!user) {
            console.error("[Stripe Webhook] Could not find user for subscription update:", subscription.id);
            break;
          }

          if (subscription.status === "active" || subscription.status === "trialing") {
            const tier = determineTierFromSubscription(subscription);
            await db.updateUserTier(user.id, tier, customerId, subscription.id);
            console.log(`[Stripe Webhook] User ${user.id} subscription updated to ${tier}`);
          } else if (
            subscription.status === "canceled" ||
            subscription.status === "unpaid" ||
            subscription.status === "past_due"
          ) {
            // Downgrade on cancellation or payment issues
            await db.updateUserTier(user.id, "explorer");
            console.log(
              `[Stripe Webhook] User ${user.id} downgraded to explorer (status: ${subscription.status})`
            );
          }
          break;
        }

        // ─── Subscription Deleted ────────────────────────────────────
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId =
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer?.id;

          const user = await findUserFromEvent(null, customerId);
          if (!user) {
            console.error("[Stripe Webhook] Could not find user for subscription deletion:", subscription.id);
            break;
          }

          await db.updateUserTier(user.id, "explorer");
          console.log(`[Stripe Webhook] User ${user.id} subscription deleted, downgraded to explorer`);
          break;
        }

        // ─── Payment Failed ──────────────────────────────────────────
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId =
            typeof invoice.customer === "string"
              ? invoice.customer
              : invoice.customer?.id;

          const user = await findUserFromEvent(null, customerId || undefined);
          if (user) {
            console.warn(
              `[Stripe Webhook] Payment failed for user ${user.id}, invoice: ${invoice.id}`
            );
            // Don't immediately downgrade — Stripe will retry.
            // After all retries fail, subscription.deleted will fire.
          }
          break;
        }

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      console.error(`[Stripe Webhook] Error processing ${event.type}:`, err);
      // Return 200 to prevent Stripe from retrying (we logged the error)
      return res.status(200).json({ received: true, error: "Processing error" });
    }

    return res.status(200).json({ received: true });
  }
);
