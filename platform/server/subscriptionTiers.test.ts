import { describe, it, expect } from "vitest";
import {
  TIER_CONFIGS,
  tierLevel,
  isAtLeast,
  canAccessAgent,
  hasReportQuota,
  getReportQuotaInfo,
  canUseProofGuard,
  canUseHITL,
  canExportCompliance,
  getUpgradeSuggestion,
  BASIC_AGENTS,
  getMaxConcurrentExecutions,
} from "./subscriptionTiers";

describe("Subscription Tier System", () => {
  // ─── Tier Configuration ──────────────────────────────────────────────

  it("should define all 4 tiers", () => {
    expect(Object.keys(TIER_CONFIGS)).toEqual(["explorer", "founder", "governance", "enterprise"]);
  });

  it("should have correct pricing", () => {
    expect(TIER_CONFIGS.explorer.price).toBe(0);
    expect(TIER_CONFIGS.founder.price).toBe(49);
    expect(TIER_CONFIGS.governance.price).toBe(299);
    expect(TIER_CONFIGS.enterprise.price).toBe(1500);
  });

  it("should have correct report limits", () => {
    expect(TIER_CONFIGS.explorer.reportLimit).toBe(3);
    expect(TIER_CONFIGS.founder.reportLimit).toBe(-1); // unlimited
    expect(TIER_CONFIGS.governance.reportLimit).toBe(-1);
    expect(TIER_CONFIGS.enterprise.reportLimit).toBe(-1);
  });

  // ─── Tier Ordering ───────────────────────────────────────────────────

  it("should order tiers correctly", () => {
    expect(tierLevel("explorer")).toBe(0);
    expect(tierLevel("founder")).toBe(1);
    expect(tierLevel("governance")).toBe(2);
    expect(tierLevel("enterprise")).toBe(3);
  });

  it("should compare tiers with isAtLeast", () => {
    expect(isAtLeast("explorer", "explorer")).toBe(true);
    expect(isAtLeast("explorer", "founder")).toBe(false);
    expect(isAtLeast("founder", "explorer")).toBe(true);
    expect(isAtLeast("governance", "founder")).toBe(true);
    expect(isAtLeast("enterprise", "governance")).toBe(true);
    expect(isAtLeast("founder", "governance")).toBe(false);
  });

  // ─── Agent Access ────────────────────────────────────────────────────

  it("should restrict explorer to basic agents", () => {
    for (const agentId of BASIC_AGENTS) {
      expect(canAccessAgent("explorer", agentId)).toBe(true);
    }
    expect(canAccessAgent("explorer", "stripe-agent")).toBe(false);
    expect(canAccessAgent("explorer", "formation-advisor")).toBe(false);
  });

  it("should allow founder access to all agents", () => {
    expect(canAccessAgent("founder", "stripe-agent")).toBe(true);
    expect(canAccessAgent("founder", "formation-advisor")).toBe(true);
    expect(canAccessAgent("founder", "brand-architect")).toBe(true);
  });

  // ─── Report Quota ────────────────────────────────────────────────────

  it("should enforce explorer report limit of 3", () => {
    expect(hasReportQuota("explorer", 0)).toBe(true);
    expect(hasReportQuota("explorer", 2)).toBe(true);
    expect(hasReportQuota("explorer", 3)).toBe(false);
    expect(hasReportQuota("explorer", 10)).toBe(false);
  });

  it("should allow unlimited reports for paid tiers", () => {
    expect(hasReportQuota("founder", 999)).toBe(true);
    expect(hasReportQuota("governance", 999)).toBe(true);
    expect(hasReportQuota("enterprise", 999)).toBe(true);
  });

  it("should return correct quota info", () => {
    const explorerQuota = getReportQuotaInfo("explorer", 2);
    expect(explorerQuota.limit).toBe(3);
    expect(explorerQuota.used).toBe(2);
    expect(explorerQuota.remaining).toBe(1);
    expect(explorerQuota.unlimited).toBe(false);
    expect(explorerQuota.exhausted).toBe(false);

    const exhaustedQuota = getReportQuotaInfo("explorer", 3);
    expect(exhaustedQuota.exhausted).toBe(true);
    expect(exhaustedQuota.remaining).toBe(0);

    const founderQuota = getReportQuotaInfo("founder", 50);
    expect(founderQuota.unlimited).toBe(true);
    expect(founderQuota.remaining).toBe(-1);
  });

  // ─── Feature Gates ───────────────────────────────────────────────────

  it("should gate ProofGuard to governance+ tiers", () => {
    expect(canUseProofGuard("explorer")).toBe(false);
    expect(canUseProofGuard("founder")).toBe(false);
    expect(canUseProofGuard("governance")).toBe(true);
    expect(canUseProofGuard("enterprise")).toBe(true);
  });

  it("should gate HITL to governance+ tiers", () => {
    expect(canUseHITL("explorer")).toBe(false);
    expect(canUseHITL("founder")).toBe(false);
    expect(canUseHITL("governance")).toBe(true);
    expect(canUseHITL("enterprise")).toBe(true);
  });

  it("should gate compliance export to governance+ tiers", () => {
    expect(canExportCompliance("explorer")).toBe(false);
    expect(canExportCompliance("founder")).toBe(false);
    expect(canExportCompliance("governance")).toBe(true);
    expect(canExportCompliance("enterprise")).toBe(true);
  });

  it("should set correct concurrent execution limits", () => {
    expect(getMaxConcurrentExecutions("explorer")).toBe(1);
    expect(getMaxConcurrentExecutions("founder")).toBe(3);
    expect(getMaxConcurrentExecutions("governance")).toBe(5);
    expect(getMaxConcurrentExecutions("enterprise")).toBe(-1); // unlimited
  });

  // ─── Upgrade Suggestions ─────────────────────────────────────────────

  it("should suggest upgrade from explorer to founder", () => {
    const suggestion = getUpgradeSuggestion("explorer", "unlimited reports");
    expect(suggestion).not.toBeNull();
    expect(suggestion!.suggestedTier).toBe("founder");
    expect(suggestion!.price).toBe("$49/mo");
  });

  it("should suggest upgrade from founder to governance", () => {
    const suggestion = getUpgradeSuggestion("founder", "ProofGuard");
    expect(suggestion).not.toBeNull();
    expect(suggestion!.suggestedTier).toBe("governance");
    expect(suggestion!.price).toBe("$299/mo");
  });

  it("should return null for enterprise (no upgrade available)", () => {
    const suggestion = getUpgradeSuggestion("enterprise", "anything");
    expect(suggestion).toBeNull();
  });
});
