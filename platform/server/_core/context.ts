import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

// ─── Self-Hosted Auth Bypass ─────────────────────────────────────────────────
// When AUTH_BYPASS_ENABLED=true, all tRPC requests are treated as authenticated
// with a mock admin user. This allows the platform to function without the
// Manus OAuth portal on self-hosted deployments.
const AUTH_BYPASS_ENABLED = process.env.AUTH_BYPASS_ENABLED === "true";

const MOCK_USER = {
  id: 1,
  openId: "self-hosted-admin",
  name: "Admin",
  email: "admin@launchops.local",
  loginMethod: "self-hosted",
  role: "admin",
  subscriptionTier: "enterprise",
  reportCount: 0,
  billingPeriodStart: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
} as unknown as User;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // If auth bypass is enabled, always return the mock admin user
  if (AUTH_BYPASS_ENABLED) {
    return {
      req: opts.req,
      res: opts.res,
      user: MOCK_USER,
    };
  }

  let user: User | null = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
