/**
 * Subscription Tier System
 * ========================
 * Revenue architecture for the Atlas Orchestrator platform.
 *
 * Tiers:
 *   Explorer  — Free, 3 reports/month, basic agents only
 *   Founder   — $49/mo, unlimited reports, all agents, priority execution
 *   Governance — $299/mo, everything + ProofGuard, HITL gates, compliance exports
 *   Enterprise — $1500+/mo, white-label, dedicated support, SLA, custom agents
 */

// ─── Tier Definitions ───────────────────────────────────────────────────

export type SubscriptionTier = "explorer" | "founder" | "governance" | "enterprise";

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  tagline: string;
  price: number; // monthly USD, 0 = free
  priceLabel: string;
  reportLimit: number; // -1 = unlimited
  features: string[];
  /** Agent categories this tier can access */
  agentAccess: "basic" | "all" | "all+custom";
  /** Whether ProofGuard governance is enabled */
  proofGuardEnabled: boolean;
  /** Whether HITL approval gates are available */
  hitlEnabled: boolean;
  /** Whether compliance/audit exports are available */
  complianceExportEnabled: boolean;
  /** Max concurrent executions */
  maxConcurrentExecutions: number;
  /** Stripe price ID (set when Stripe is wired) */
  stripePriceId?: string;
  /** Badge color for UI */
  badgeColor: string;
  /** Icon name from lucide-react */
  icon: string;
}

export const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  explorer: {
    id: "explorer",
    name: "Explorer",
    tagline: "Start your launch journey",
    price: 0,
    priceLabel: "Free",
    reportLimit: 3,
    features: [
      "3 reports per month",
      "Basic agent access (5 agents)",
      "Brand Architect naming tool",
      "Trust Score preview",
      "Community support",
    ],
    agentAccess: "basic",
    proofGuardEnabled: false,
    hitlEnabled: false,
    complianceExportEnabled: false,
    maxConcurrentExecutions: 1,
    badgeColor: "oklch(0.65 0.15 160)", // teal
    icon: "Compass",
  },

  founder: {
    id: "founder",
    name: "Founder Autopilot",
    tagline: "Launch with confidence",
    price: 49,
    priceLabel: "$49/mo",
    reportLimit: -1, // unlimited
    features: [
      "Unlimited reports & executions",
      "All 25 agents unlocked",
      "Full 20-step Business Launch Pipeline",
      "Real-time SSE execution streaming",
      "Artifact storage & download",
      "Priority execution queue",
      "Email support",
    ],
    agentAccess: "all",
    proofGuardEnabled: false,
    hitlEnabled: false,
    complianceExportEnabled: false,
    maxConcurrentExecutions: 3,
    badgeColor: "oklch(0.75 0.15 85)", // gold
    icon: "Rocket",
  },

  governance: {
    id: "governance",
    name: "Governance Pro",
    tagline: "Trust at scale",
    price: 299,
    priceLabel: "$299/mo",
    reportLimit: -1,
    features: [
      "Everything in Founder Autopilot",
      "ProofGuard governance engine",
      "HITL approval gates for high-risk agents",
      "Immutable attestation audit trail",
      "Compliance export (PDF/JSON)",
      "CQS scoring & risk classification",
      "Dedicated Slack channel",
      "Documentary-ready proof records",
    ],
    agentAccess: "all",
    proofGuardEnabled: true,
    hitlEnabled: true,
    complianceExportEnabled: true,
    maxConcurrentExecutions: 5,
    badgeColor: "oklch(0.65 0.18 280)", // purple
    icon: "Shield",
  },

  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Your platform, your rules",
    price: 1500,
    priceLabel: "$1,500+/mo",
    reportLimit: -1,
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
    agentAccess: "all+custom",
    proofGuardEnabled: true,
    hitlEnabled: true,
    complianceExportEnabled: true,
    maxConcurrentExecutions: -1, // unlimited
    badgeColor: "oklch(0.55 0.2 30)", // crimson
    icon: "Building2",
  },
};

// ─── Tier Ordering (for comparison) ─────────────────────────────────────

const TIER_ORDER: SubscriptionTier[] = ["explorer", "founder", "governance", "enterprise"];

export function tierLevel(tier: SubscriptionTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function isAtLeast(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return tierLevel(userTier) >= tierLevel(requiredTier);
}

// ─── Basic Agent List (Explorer tier) ───────────────────────────────────

export const BASIC_AGENTS = [
  "brand-architect",
  "business-builder",
  "content-engine",
  "founder-os",
  "documentary-tracker",
];

export function canAccessAgent(tier: SubscriptionTier, agentId: string): boolean {
  const config = TIER_CONFIGS[tier];
  if (config.agentAccess === "all" || config.agentAccess === "all+custom") return true;
  return BASIC_AGENTS.includes(agentId);
}

// ─── Report Quota ───────────────────────────────────────────────────────

export function hasReportQuota(tier: SubscriptionTier, currentCount: number): boolean {
  const config = TIER_CONFIGS[tier];
  if (config.reportLimit === -1) return true;
  return currentCount < config.reportLimit;
}

export function getReportQuotaInfo(tier: SubscriptionTier, currentCount: number) {
  const config = TIER_CONFIGS[tier];
  return {
    limit: config.reportLimit,
    used: currentCount,
    remaining: config.reportLimit === -1 ? -1 : Math.max(0, config.reportLimit - currentCount),
    unlimited: config.reportLimit === -1,
    exhausted: config.reportLimit !== -1 && currentCount >= config.reportLimit,
  };
}

// ─── Feature Gates ──────────────────────────────────────────────────────

export function canUseProofGuard(tier: SubscriptionTier): boolean {
  return TIER_CONFIGS[tier].proofGuardEnabled;
}

export function canUseHITL(tier: SubscriptionTier): boolean {
  return TIER_CONFIGS[tier].hitlEnabled;
}

export function canExportCompliance(tier: SubscriptionTier): boolean {
  return TIER_CONFIGS[tier].complianceExportEnabled;
}

export function getMaxConcurrentExecutions(tier: SubscriptionTier): number {
  return TIER_CONFIGS[tier].maxConcurrentExecutions;
}

// ─── Upgrade Suggestions ────────────────────────────────────────────────

export function getUpgradeSuggestion(
  currentTier: SubscriptionTier,
  blockedFeature: string
): { suggestedTier: SubscriptionTier; reason: string; price: string } | null {
  if (currentTier === "enterprise") return null;

  const nextTierIndex = tierLevel(currentTier) + 1;
  if (nextTierIndex >= TIER_ORDER.length) return null;

  const suggestedTier = TIER_ORDER[nextTierIndex];
  const config = TIER_CONFIGS[suggestedTier];

  return {
    suggestedTier,
    reason: `Upgrade to ${config.name} to unlock ${blockedFeature}`,
    price: config.priceLabel,
  };
}
