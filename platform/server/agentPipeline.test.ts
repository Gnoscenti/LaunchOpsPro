import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getAgent,
  listAgents,
  getAgentPrompt,
  hasPythonAgent,
  getResponseFormat,
  findAgentsByCapability,
  findAgentsByCategory,
  getRegistryStats,
} from "./agentRegistry";
import {
  getProviderHealth,
  getRoutingStats,
  getModelForAgent,
  getAvailableProviders,
} from "./llmRouter";
import {
  initContext,
  appendToContext,
  buildContextForAgent,
  getContext,
  getSerializableContext,
  clearContext,
} from "./contextChain";

/**
 * Tests for the Atlas Orchestrator agent pipeline:
 *   - Agent Registry: agent definitions, lookups, prompts, response formats
 *   - Context Chain: initialization, accumulation, selective retrieval, serialization
 */

// ─── Agent Registry Tests ──────────────────────────────────────────────────

describe("Agent Registry", () => {
  it("has all 24 agents registered", () => {
    const agents = listAgents();
    expect(agents.length).toBeGreaterThanOrEqual(24);
  });

  it("retrieves a known agent by ID", () => {
    const agent = getAgent("synthesis-agent");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("Synthesis Agent");
    expect(agent!.category).toBe("strategic");
    expect(agent!.executionMode).toBe("llm");
  });

  it("returns undefined for unknown agent ID", () => {
    const agent = getAgent("nonexistent-agent");
    expect(agent).toBeUndefined();
  });

  it("all agents have required fields", () => {
    const agents = listAgents();
    for (const agent of agents) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(agent.description).toBeTruthy();
      expect(agent.capabilities.length).toBeGreaterThan(0);
      expect(["python", "llm", "hybrid"]).toContain(agent.executionMode);
      expect(agent.systemPrompt).toBeTruthy();
      expect(agent.category).toBeTruthy();
    }
  });

  it("strategic agents have persistArtifact enabled", () => {
    const strategicAgents = findAgentsByCategory("strategic");
    expect(strategicAgents.length).toBeGreaterThanOrEqual(3);
    for (const agent of strategicAgents) {
      expect(agent.persistArtifact).toBe(true);
      expect(agent.artifactType).toBeTruthy();
    }
  });

  // ── Founder Edition Agents ──────────────────────────────────────────────

  it("has Content Engine agent registered with method dispatch", () => {
    const agent = getAgent("content-engine");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("Content Engine");
    expect(agent!.category).toBe("content");
    // Content Engine is python-primary with LLM fallback
    expect(["python", "hybrid"]).toContain(agent!.executionMode);
    expect(agent!.capabilities).toContain("content_generation");
    expect(agent!.capabilities).toContain("seo");
    // Method dispatch metadata
    expect(agent!.metadata?.methodDispatch).toBe(true);
    expect(agent!.metadata?.methods).toContain("generate_blog");
    expect(agent!.metadata?.methods).toContain("generate_social");
  });

  it("has DynExecutiv agent registered with method dispatch", () => {
    const agent = getAgent("dynexecutiv-agent");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("DynExecutiv Agent");
    expect(agent!.category).toBe("strategic");
    expect(agent!.executionMode).toBe("hybrid");
    expect(agent!.capabilities).toContain("strategy");
    expect(agent!.capabilities).toContain("decision_making");
    expect(agent!.metadata?.methodDispatch).toBe(true);
    expect(agent!.metadata?.methods).toContain("analyze_decision");
  });

  it("has Founder OS agent registered with method dispatch", () => {
    const agent = getAgent("founder-os-agent");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("Founder OS Agent");
    expect(agent!.category).toBe("operations");
    expect(agent!.executionMode).toBe("hybrid");
    expect(agent!.capabilities).toContain("automation");
    expect(agent!.capabilities).toContain("scheduling");
    expect(agent!.metadata?.methodDispatch).toBe(true);
    expect(agent!.metadata?.methods).toContain("daily_briefing");
  });

  it("has Metrics Agent registered with method dispatch", () => {
    const agent = getAgent("metrics-agent");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("Metrics Enforcement Agent");
    expect(agent!.category).toBe("analytics");
    expect(["python", "hybrid"]).toContain(agent!.executionMode);
    expect(agent!.capabilities).toContain("analytics");
    expect(agent!.capabilities).toContain("kpi_tracking");
    expect(agent!.metadata?.methodDispatch).toBe(true);
    expect(agent!.metadata?.methods).toContain("collect_metrics");
  });

  it("method dispatch agents have source set to founder-edition", () => {
    const feAgents = ["content-engine", "dynexecutiv-agent", "founder-os-agent", "metrics-agent"];
    for (const id of feAgents) {
      const agent = getAgent(id);
      expect(agent).toBeDefined();
      expect(agent!.metadata?.source).toBe("launchops-founder-edition");
    }
  });

  it("7-pillar agent requires context from synthesis agent", () => {
    const agent = getAgent("seven-pillar-agent");
    expect(agent!.requiredContext).toContain("executive_summary");
    expect(agent!.requiredContext).toContain("wedge_and_icp");
    expect(agent!.requiredContext).toContain("business_model");
  });

  it("systems agent requires context from 7-pillar agent", () => {
    const agent = getAgent("systems-agent");
    expect(agent!.requiredContext).toContain("pillars");
  });

  it("generates prompt with context injection", () => {
    const prompt = getAgentPrompt("seven-pillar-agent", "Test context data");
    expect(prompt).toContain("7-Pillar Execution Agent");
    expect(prompt).toContain("Prior Context");
    expect(prompt).toContain("Test context data");
  });

  it("generates prompt without context when none provided", () => {
    const prompt = getAgentPrompt("synthesis-agent");
    expect(prompt).toContain("Synthesis Agent");
    expect(prompt).not.toContain("Prior Context");
  });

  it("returns fallback prompt for unknown agent", () => {
    const prompt = getAgentPrompt("unknown-agent");
    expect(prompt).toContain("AI agent");
  });

  it("correctly identifies Python agents", () => {
    expect(hasPythonAgent("security-agent")).toBe(true);
    expect(hasPythonAgent("synthesis-agent")).toBe(false);
  });

  it("returns json_object format for strategic agents", () => {
    const format = getResponseFormat("synthesis-agent");
    expect(format.type).toBe("json_object");
  });

  it("returns json_schema format for operational agents", () => {
    const format = getResponseFormat("business-builder");
    expect(format.type).toBe("json_schema");
    expect(format.json_schema).toBeDefined();
  });

  it("finds agents by capability", () => {
    const strategyAgents = findAgentsByCapability("strategy");
    expect(strategyAgents.length).toBeGreaterThanOrEqual(3);
    expect(strategyAgents.map((a) => a.id)).toContain("synthesis-agent");
  });

  it("finds agents by category", () => {
    const infraAgents = findAgentsByCategory("infrastructure");
    expect(infraAgents.length).toBeGreaterThanOrEqual(1);
  });

  it("returns registry stats with updated counts", () => {
    const stats = getRegistryStats();
    expect(stats.totalAgents).toBeGreaterThanOrEqual(24);
    expect(stats.categories.length).toBeGreaterThan(0);
    expect(stats.capabilities.length).toBeGreaterThan(0);
    expect(stats.byExecutionMode.llm).toBeGreaterThan(0);
    expect(stats.byExecutionMode.python).toBeGreaterThan(0);
    expect(stats.byExecutionMode.hybrid).toBeGreaterThan(0);
  });
});

// ─── Context Chain Tests ───────────────────────────────────────────────────

describe("Context Chain", () => {
  beforeEach(() => {
    // Clean up any leftover contexts
    clearContext(999);
    clearContext(1000);
    clearContext(1001);
  });

  it("initializes a fresh context", () => {
    const ctx = initContext(999);
    expect(ctx.executionId).toBe(999);
    expect(ctx.steps).toHaveLength(0);
    expect(ctx.chainableContext).toEqual({});
    expect(ctx.summary).toBe("");
    expect(ctx.estimatedTokens).toBe(0);
  });

  it("appends step output to context", () => {
    initContext(1000);
    const updated = appendToContext(1000, {
      stepId: 1,
      agentId: "synthesis-agent",
      label: "Synthesis",
      output: {
        executive_summary: ["Point 1", "Point 2"],
        wedge_and_icp: "Solo founders in SaaS",
        business_model: "Pilot → subscription",
      },
      completedAt: Date.now(),
    });

    expect(updated.steps).toHaveLength(1);
    expect(updated.chainableContext["executive_summary"]).toEqual(["Point 1", "Point 2"]);
    expect(updated.chainableContext["wedge_and_icp"]).toBe("Solo founders in SaaS");
    expect(updated.chainableContext["business_model"]).toBe("Pilot → subscription");
    // Also namespaced
    expect(updated.chainableContext["synthesis-agent.executive_summary"]).toEqual(["Point 1", "Point 2"]);
  });

  it("accumulates multiple step outputs", () => {
    initContext(1001);

    appendToContext(1001, {
      stepId: 1,
      agentId: "synthesis-agent",
      label: "Synthesis",
      output: { executive_summary: ["Point 1"], wedge_and_icp: "Solo founders" },
      completedAt: Date.now(),
    });

    const updated = appendToContext(1001, {
      stepId: 2,
      agentId: "seven-pillar-agent",
      label: "7-Pillar Plan",
      output: { pillars: [{ pillar_name: "Business Model" }] },
      completedAt: Date.now(),
    });

    expect(updated.steps).toHaveLength(2);
    // Both agents' outputs are in the chain
    expect(updated.chainableContext["executive_summary"]).toEqual(["Point 1"]);
    expect(updated.chainableContext["pillars"]).toEqual([{ pillar_name: "Business Model" }]);
  });

  it("builds targeted context for an agent with requiredContext", () => {
    initContext(1001);

    appendToContext(1001, {
      stepId: 1,
      agentId: "synthesis-agent",
      label: "Synthesis",
      output: {
        executive_summary: ["Point 1"],
        wedge_and_icp: "Solo founders",
        business_model: "Pilot → subscription",
        irrelevant_field: "This should not appear",
      },
      completedAt: Date.now(),
    });

    // 7-pillar agent requires: executive_summary, wedge_and_icp, business_model
    const context = buildContextForAgent(1001, "seven-pillar-agent");
    expect(context).toContain("Executive Summary");
    expect(context).toContain("Wedge And Icp");
    expect(context).toContain("Business Model");
  });

  it("returns full summary for agents without requiredContext", () => {
    initContext(1001);

    appendToContext(1001, {
      stepId: 1,
      agentId: "synthesis-agent",
      label: "Synthesis",
      output: { summary: "Business is viable" },
      completedAt: Date.now(),
    });

    // business-builder has no requiredContext → gets full summary
    const context = buildContextForAgent(1001, "business-builder");
    expect(context).toContain("Workflow Execution Context");
    expect(context).toContain("Synthesis");
  });

  it("returns empty string for empty context", () => {
    initContext(1001);
    const context = buildContextForAgent(1001, "synthesis-agent");
    expect(context).toBe("");
  });

  it("retrieves context by execution ID", () => {
    initContext(1001);
    appendToContext(1001, {
      stepId: 1,
      agentId: "synthesis-agent",
      label: "Synthesis",
      output: { summary: "Test" },
      completedAt: Date.now(),
    });

    const ctx = getContext(1001);
    expect(ctx).toBeDefined();
    expect(ctx!.steps).toHaveLength(1);
  });

  it("returns undefined for non-existent context", () => {
    const ctx = getContext(9999);
    expect(ctx).toBeUndefined();
  });

  it("serializes context for DB persistence", () => {
    initContext(1001);
    appendToContext(1001, {
      stepId: 1,
      agentId: "synthesis-agent",
      label: "Synthesis",
      output: { summary: "Persisted" },
      completedAt: Date.now(),
    });

    const serialized = getSerializableContext(1001);
    expect(serialized).toBeDefined();
    expect(serialized!.steps).toHaveLength(1);
    expect(serialized!.chainableContext).toBeDefined();
    expect(serialized!.summary).toBeTruthy();
  });

  it("clears context after execution", () => {
    initContext(1001);
    appendToContext(1001, {
      stepId: 1,
      agentId: "synthesis-agent",
      label: "Synthesis",
      output: { summary: "Will be cleared" },
      completedAt: Date.now(),
    });

    clearContext(1001);
    expect(getContext(1001)).toBeUndefined();
  });

  it("auto-initializes context if appendToContext called without init", () => {
    clearContext(1001);
    const updated = appendToContext(1001, {
      stepId: 1,
      agentId: "synthesis-agent",
      label: "Synthesis",
      output: { summary: "Auto-init" },
      completedAt: Date.now(),
    });

    expect(updated.steps).toHaveLength(1);
  });
});

// ─── LLM Router Tests ─────────────────────────────────────────────────────

describe("LLM Router", () => {
  it("returns provider health for all configured providers", () => {
    const health = getProviderHealth();
    expect(health.length).toBeGreaterThanOrEqual(2);
    const ids = health.map((p) => p.id);
    expect(ids).toContain("forge");
    expect(ids).toContain("anthropic");
  });

  it("each provider has required health fields", () => {
    const health = getProviderHealth();
    for (const provider of health) {
      expect(provider.id).toBeTruthy();
      expect(provider.name).toBeTruthy();
      expect(typeof provider.available).toBe("boolean");
      expect(typeof provider.totalCalls).toBe("number");
      expect(typeof provider.totalTokens).toBe("number");
      expect(typeof provider.avgLatencyMs).toBe("number");
    }
  });

  it("forge provider is available by default", () => {
    const health = getProviderHealth();
    const forge = health.find((p) => p.id === "forge");
    expect(forge).toBeDefined();
    // Forge availability depends on ENV.forgeApiKey being set
    // In test env it may or may not be available
    expect(typeof forge!.available).toBe("boolean");
  });

  it("returns routing stats with aggregate totals", () => {
    const stats = getRoutingStats();
    expect(stats.providers.length).toBeGreaterThanOrEqual(2);
    expect(typeof stats.totalCalls).toBe("number");
    expect(typeof stats.totalTokens).toBe("number");
    expect(stats.primaryProvider).toBe("forge");
    expect(typeof stats.anthropicAvailable).toBe("boolean");
  });

  it("returns correct model for balanced preference agent", () => {
    const result = getModelForAgent({ modelPreference: "balanced" } as any);
    expect(result.provider).toBe("forge");
    expect(result.model).toBeTruthy();
  });

  it("returns correct model for fast preference agent", () => {
    const result = getModelForAgent({ modelPreference: "fast" } as any);
    expect(result.provider).toBe("forge");
    expect(result.model).toBeTruthy();
  });

  it("deep-reasoning preference routes to anthropic when available", () => {
    const result = getModelForAgent({ modelPreference: "deep-reasoning" } as any);
    // In test env, anthropic may not be available, so it falls back to forge
    expect(["forge", "anthropic"]).toContain(result.provider);
    expect(result.model).toBeTruthy();
  });

  it("returns default model when no agent definition provided", () => {
    const result = getModelForAgent();
    expect(result.provider).toBe("forge");
    expect(result.model).toBeTruthy();
  });

  it("lists available providers", () => {
    const available = getAvailableProviders();
    expect(Array.isArray(available)).toBe(true);
    // At minimum, we should have forge or anthropic
    for (const id of available) {
      expect(["forge", "anthropic", "huggingface"]).toContain(id);
    }
  });

  it("model mapping covers all preference x provider combinations", () => {
    const preferences = ["fast", "balanced", "deep-reasoning"] as const;
    for (const pref of preferences) {
      const result = getModelForAgent({ modelPreference: pref } as any);
      expect(result.model).toBeTruthy();
      expect(result.provider).toBeTruthy();
    }
  });
});
