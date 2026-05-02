import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// ─── Tier-Gated Procedures ──────────────────────────────────────────────

import { isAtLeast, type SubscriptionTier } from '../subscriptionTiers';

export const TIER_INSUFFICIENT_MSG = 'Upgrade your plan to access this feature (10003)';

/**
 * Create a procedure that requires a minimum subscription tier.
 * Usage: founderProcedure, governanceProcedure, enterpriseProcedure
 */
function createTierProcedure(minTier: SubscriptionTier) {
  return t.procedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      const userTier = (ctx.user as Record<string, unknown>).subscriptionTier as SubscriptionTier ?? 'explorer';
      if (!isAtLeast(userTier, minTier)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: TIER_INSUFFICIENT_MSG,
          cause: { requiredTier: minTier, currentTier: userTier },
        });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );
}

/** Requires Founder tier ($49/mo) or above */
export const founderProcedure = createTierProcedure('founder');

/** Requires Governance tier ($299/mo) or above */
export const governanceProcedure = createTierProcedure('governance');

/** Requires Enterprise tier ($1500+/mo) */
export const enterpriseProcedure = createTierProcedure('enterprise');
