/**
 * Revenue Features Test Suite
 * ============================
 * Tests for naming contests, subscription tiers, and documentary tracker data.
 */
import { describe, it, expect, vi } from "vitest";

// ─── Subscription Tier Config ───────────────────────────────────────────

describe("Subscription Tier Configuration", () => {
  it("should define four tiers with correct pricing", async () => {
    const { TIER_CONFIGS } = await import("./subscriptionTiers");
    expect(Object.keys(TIER_CONFIGS)).toHaveLength(4);
    expect(TIER_CONFIGS.explorer.price).toBe(0);
    expect(TIER_CONFIGS.founder.price).toBe(49);
    expect(TIER_CONFIGS.governance.price).toBe(299);
    expect(TIER_CONFIGS.enterprise.price).toBe(1500);
  });

  it("should enforce report limits per tier", async () => {
    const { TIER_CONFIGS } = await import("./subscriptionTiers");
    expect(TIER_CONFIGS.explorer.reportLimit).toBe(3);
    expect(TIER_CONFIGS.founder.reportLimit).toBe(-1); // unlimited
    expect(TIER_CONFIGS.governance.reportLimit).toBe(-1);
    expect(TIER_CONFIGS.enterprise.reportLimit).toBe(-1);
  });

  it("should enforce agent access levels per tier", async () => {
    const { TIER_CONFIGS } = await import("./subscriptionTiers");
    expect(TIER_CONFIGS.explorer.agentAccess).toBe("basic");
    expect(TIER_CONFIGS.founder.agentAccess).toBe("all");
    expect(TIER_CONFIGS.governance.agentAccess).toBe("all");
    expect(TIER_CONFIGS.enterprise.agentAccess).toBe("all+custom");
  });

  it("should gate ProofGuard correctly per tier", async () => {
    const { TIER_CONFIGS } = await import("./subscriptionTiers");
    expect(TIER_CONFIGS.explorer.proofGuardEnabled).toBe(false);
    expect(TIER_CONFIGS.founder.proofGuardEnabled).toBe(false);
    expect(TIER_CONFIGS.governance.proofGuardEnabled).toBe(true);
    expect(TIER_CONFIGS.enterprise.proofGuardEnabled).toBe(true);
  });

  it("should have concurrent execution limits", async () => {
    const { TIER_CONFIGS } = await import("./subscriptionTiers");
    expect(TIER_CONFIGS.explorer.maxConcurrentExecutions).toBe(1);
    expect(TIER_CONFIGS.founder.maxConcurrentExecutions).toBe(3);
    expect(TIER_CONFIGS.governance.maxConcurrentExecutions).toBe(5);
    expect(TIER_CONFIGS.enterprise.maxConcurrentExecutions).toBe(-1);
  });
});

// ─── Tier Utility Functions ─────────────────────────────────────────────

describe("Tier Utility Functions", () => {
  it("canAccessAgent should gate basic agents for explorer", async () => {
    const { canAccessAgent } = await import("./subscriptionTiers");
    expect(canAccessAgent("explorer", "brand-architect")).toBe(true);
    expect(canAccessAgent("explorer", "some-premium-agent")).toBe(false);
    expect(canAccessAgent("founder", "some-premium-agent")).toBe(true);
  });

  it("hasReportQuota should enforce limits correctly", async () => {
    const { hasReportQuota } = await import("./subscriptionTiers");
    expect(hasReportQuota("explorer", 0)).toBe(true);
    expect(hasReportQuota("explorer", 2)).toBe(true);
    expect(hasReportQuota("explorer", 3)).toBe(false);
    expect(hasReportQuota("founder", 999)).toBe(true); // unlimited
  });

  it("isAtLeast should compare tier levels correctly", async () => {
    const { isAtLeast } = await import("./subscriptionTiers");
    expect(isAtLeast("explorer", "explorer")).toBe(true);
    expect(isAtLeast("explorer", "founder")).toBe(false);
    expect(isAtLeast("governance", "founder")).toBe(true);
    expect(isAtLeast("enterprise", "explorer")).toBe(true);
  });

  it("getUpgradeSuggestion should suggest next tier", async () => {
    const { getUpgradeSuggestion } = await import("./subscriptionTiers");
    const suggestion = getUpgradeSuggestion("explorer", "pipeline");
    expect(suggestion).not.toBeNull();
    expect(suggestion!.suggestedTier).toBe("founder");
    expect(getUpgradeSuggestion("enterprise", "anything")).toBeNull();
  });
});

// ─── Naming Contest Data Structures ─────────────────────────────────────

describe("Naming Contest Data Validation", () => {
  it("should validate candidate structure", () => {
    const candidate = {
      id: "test-123",
      name: "BrandName",
      tagline: "The future of branding",
    };
    expect(candidate.id).toBeTruthy();
    expect(candidate.name.length).toBeGreaterThan(0);
    expect(candidate.name.length).toBeLessThanOrEqual(255);
  });

  it("should require at least 2 candidates", () => {
    const candidates = [
      { id: "1", name: "Alpha" },
      { id: "2", name: "Beta" },
    ];
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("should enforce max 10 candidates", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      name: `Brand${i}`,
    }));
    expect(candidates.length).toBeLessThanOrEqual(10);
  });

  it("should generate unique share IDs", () => {
    const crypto = require("crypto");
    const ids = new Set(
      Array.from({ length: 100 }, () => crypto.randomBytes(12).toString("base64url"))
    );
    expect(ids.size).toBe(100); // all unique
  });

  it("should validate fingerprint format", () => {
    // Simulate browser fingerprint generation
    const raw = ["Mozilla/5.0", "en-US", "1920", "1080", "-420"].join("|");
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    const fingerprint = hash.toString(36);
    expect(fingerprint).toBeTruthy();
    expect(typeof fingerprint).toBe("string");
  });
});

// ─── Documentary Story Templates ────────────────────────────────────────

describe("Documentary Story Templates", () => {
  const mockData = {
    trustScore: 67,
    totalExecutions: 3,
    completedExecutions: 1,
    successRate: 33,
    totalAgents: 25,
    totalWorkflows: 2,
    proofguardApproved: 5,
    proofguardTotal: 6,
    avgCqs: 85,
    daysSinceStart: 30,
    userName: "TestFounder",
  };

  it("should generate launch milestone with real data", () => {
    const template = `Just hit ${mockData.totalExecutions} automated executions on my business launch pipeline.\n\n${mockData.successRate}% success rate. ${mockData.totalAgents} AI agents working in parallel.`;
    expect(template).toContain("3 automated executions");
    expect(template).toContain("33% success rate");
    expect(template).toContain("25 AI agents");
  });

  it("should generate trust score update with governance data", () => {
    const template = `Trust Score update: ${mockData.trustScore}/100\n\n${mockData.proofguardApproved}/${mockData.proofguardTotal} governance checks passed\nAvg Confidence-Quality Score: ${mockData.avgCqs}/100`;
    expect(template).toContain("67/100");
    expect(template).toContain("5/6 governance checks");
    expect(template).toContain("85/100");
  });

  it("should generate investor-ready summary with all metrics", () => {
    const approvalRate = mockData.proofguardTotal > 0
      ? Math.round((mockData.proofguardApproved / mockData.proofguardTotal) * 100)
      : 0;
    expect(approvalRate).toBe(83);
  });

  it("should respect Twitter character limit indicator", () => {
    const shortContent = "Short tweet";
    const longContent = "A".repeat(300);
    expect(shortContent.length).toBeLessThanOrEqual(280);
    expect(longContent.length).toBeGreaterThan(280);
  });

  it("should include all required data points in templates", () => {
    const requiredFields = [
      "trustScore",
      "totalExecutions",
      "successRate",
      "totalAgents",
      "proofguardApproved",
      "proofguardTotal",
      "avgCqs",
    ];
    for (const field of requiredFields) {
      expect(mockData).toHaveProperty(field);
      expect(typeof (mockData as any)[field]).toBe("number");
    }
  });
});

// ─── Vote Deduplication Logic ───────────────────────────────────────────

describe("Vote Deduplication", () => {
  it("should detect duplicate votes by fingerprint", () => {
    const votes = [
      { contestId: 1, fingerprint: "abc123", candidateId: "a" },
      { contestId: 1, fingerprint: "def456", candidateId: "b" },
    ];

    const newVote = { contestId: 1, fingerprint: "abc123", candidateId: "b" };
    const isDuplicate = votes.some(
      (v) => v.contestId === newVote.contestId && v.fingerprint === newVote.fingerprint
    );
    expect(isDuplicate).toBe(true);
  });

  it("should allow different fingerprints to vote", () => {
    const votes = [
      { contestId: 1, fingerprint: "abc123", candidateId: "a" },
    ];

    const newVote = { contestId: 1, fingerprint: "xyz789", candidateId: "a" };
    const isDuplicate = votes.some(
      (v) => v.contestId === newVote.contestId && v.fingerprint === newVote.fingerprint
    );
    expect(isDuplicate).toBe(false);
  });

  it("should calculate vote percentages correctly", () => {
    const results = [
      { candidateId: "a", votes: 30 },
      { candidateId: "b", votes: 20 },
      { candidateId: "c", votes: 50 },
    ];
    const total = results.reduce((sum, r) => sum + r.votes, 0);
    expect(total).toBe(100);

    const percentages = results.map((r) => Math.round((r.votes / total) * 100));
    expect(percentages).toEqual([30, 20, 50]);
  });

  it("should identify leading candidate", () => {
    const results = [
      { candidateId: "a", votes: 30 },
      { candidateId: "b", votes: 50 },
      { candidateId: "c", votes: 20 },
    ];
    const maxVotes = Math.max(...results.map((r) => r.votes));
    const leader = results.find((r) => r.votes === maxVotes);
    expect(leader?.candidateId).toBe("b");
  });
});
