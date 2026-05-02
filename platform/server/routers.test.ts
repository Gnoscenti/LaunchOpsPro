import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Integration tests for Atlas Orchestrator tRPC routers.
 * These test the router procedures using createCaller with mock context.
 * DB calls are mocked to avoid requiring a live database.
 */

// Mock the db module
vi.mock("./db", () => ({
  listWorkflows: vi.fn().mockResolvedValue([
    { id: 1, name: "Test Workflow", status: "draft", userId: 1, createdAt: new Date(), updatedAt: new Date() },
  ]),
  getWorkflow: vi.fn().mockResolvedValue({
    id: 1, name: "Test Workflow", status: "draft", userId: 1, createdAt: new Date(), updatedAt: new Date(),
  }),
  createWorkflow: vi.fn().mockResolvedValue({ id: 2, name: "New Workflow" }),
  updateWorkflow: vi.fn().mockResolvedValue(undefined),
  deleteWorkflow: vi.fn().mockResolvedValue(undefined),
  listSteps: vi.fn().mockResolvedValue([]),
  createStep: vi.fn().mockResolvedValue({ id: 1 }),
  updateStep: vi.fn().mockResolvedValue(undefined),
  deleteStep: vi.fn().mockResolvedValue(undefined),
  bulkUpsertSteps: vi.fn().mockResolvedValue(undefined),
  listExecutions: vi.fn().mockResolvedValue([]),
  getExecution: vi.fn().mockResolvedValue({ id: 1, completedSteps: 0, totalSteps: 3 }),
  createExecution: vi.fn().mockResolvedValue({ id: 1 }),
  updateExecution: vi.fn().mockResolvedValue(undefined),
  createStepExecution: vi.fn().mockResolvedValue({ id: 1 }),
  updateStepExecution: vi.fn().mockResolvedValue(undefined),
  listStepExecutions: vi.fn().mockResolvedValue([]),
  appendLog: vi.fn().mockResolvedValue(undefined),
  listTemplates: vi.fn().mockResolvedValue([
    { id: 1, name: "Business Launch", category: "business", cloneCount: 3 },
  ]),
  getTemplate: vi.fn().mockResolvedValue({
    id: 1, name: "Business Launch", description: "Full business launch", category: "business",
    definition: { steps: [{ agentId: "business-builder", label: "Build Business" }] },
  }),
  incrementTemplateCloneCount: vi.fn().mockResolvedValue(undefined),
  listCredentials: vi.fn().mockResolvedValue([
    { id: 1, keyName: "OPENAI_API_KEY", service: "openai", description: null, lastUsedAt: null, createdAt: new Date(), updatedAt: new Date() },
  ]),
  upsertCredential: vi.fn().mockResolvedValue({ id: 1 }),
  deleteCredential: vi.fn().mockResolvedValue(undefined),
  listLogs: vi.fn().mockResolvedValue([]),
  listRecentLogs: vi.fn().mockResolvedValue([]),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Workflow Router ──────────────────────────────────────────────

describe("workflow router", () => {
  it("lists workflows for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.workflow.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("name", "Test Workflow");
  });

  it("creates a workflow", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.workflow.create({ name: "New Workflow" });
    expect(result).toHaveProperty("id");
  });

  it("gets a workflow by id", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.workflow.get({ id: 1 });
    expect(result).toHaveProperty("name", "Test Workflow");
  });

  it("updates a workflow", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.workflow.update({ id: 1, name: "Updated" });
    expect(result).toEqual({ success: true });
  });

  it("deletes a workflow", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.workflow.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

// ── Step Router ──────────────────────────────────────────────────

describe("step router", () => {
  it("lists steps for a workflow", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.step.list({ workflowId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a step", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.step.create({
      workflowId: 1,
      agentId: "business-builder",
      label: "Build Business",
    });
    expect(result).toHaveProperty("id");
  });

  it("bulk saves steps", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.step.bulkSave({
      workflowId: 1,
      steps: [
        { agentId: "business-builder", label: "Step 1" },
        { agentId: "execai-coach", label: "Step 2" },
      ],
    });
    expect(result).toEqual({ success: true });
  });
});

// ── Execution Router ─────────────────────────────────────────────

describe("execution router", () => {
  it("lists executions", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.execution.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("starts an execution", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.execution.start({ workflowId: 1 });
    expect(result).toHaveProperty("id");
  });
});

// ── Template Router ──────────────────────────────────────────────

describe("template router", () => {
  it("lists templates (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.template.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("name", "Business Launch");
  });

  it("gets a template by id (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.template.get({ id: 1 });
    expect(result).toHaveProperty("name", "Business Launch");
  });

  it("clones a template into a workflow", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.template.clone({ templateId: 1 });
    expect(result).toHaveProperty("id");
  });
});

// ── Credential Router ────────────────────────────────────────────

describe("credential router", () => {
  it("lists credentials for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.credential.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("keyName", "OPENAI_API_KEY");
  });

  it("saves a credential (upsert)", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.credential.save({
      keyName: "STRIPE_SECRET_KEY",
      value: "sk_test_12345",
      service: "stripe",
    });
    expect(result).toHaveProperty("id");
  });

  it("deletes a credential", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.credential.delete({ id: 1 });
    expect(result).toEqual({ success: true });
  });
});

// ── Log Router ───────────────────────────────────────────────────

describe("log router", () => {
  it("lists logs by execution", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.log.byExecution({ executionId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("lists recent logs", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.log.recent();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Agent Registry Router ───────────────────────────────────────

describe("agentRegistry router", () => {
  it("lists all agents (public, no filter)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agentRegistry.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(20);
    // Each agent should have the expected shape
    const first = result[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("version");
    expect(first).toHaveProperty("description");
    expect(first).toHaveProperty("capabilities");
    expect(first).toHaveProperty("executionMode");
    expect(first).toHaveProperty("outputFormat");
    expect(first).toHaveProperty("modelPreference");
    expect(first).toHaveProperty("category");
    expect(first).toHaveProperty("icon");
    expect(first).toHaveProperty("outputSchemaDescription");
    expect(first).toHaveProperty("chainableFields");
    // Security: systemPrompt should NOT be exposed
    expect(first).not.toHaveProperty("systemPrompt");
  });

  it("filters agents by category", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agentRegistry.list({ category: "strategic" });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((a) => expect(a.category).toBe("strategic"));
  });

  it("filters agents by execution mode", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agentRegistry.list({ executionMode: "llm" });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((a) => expect(a.executionMode).toBe("llm"));
  });

  it("filters agents by capability", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agentRegistry.list({ capability: "strategy" });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((a) => expect(a.capabilities).toContain("strategy"));
  });

  it("searches agents by name", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agentRegistry.list({ search: "synthesis" });
    expect(result.length).toBeGreaterThan(0);
    const found = result.some(
      (a) => a.name.toLowerCase().includes("synthesis") || a.id.toLowerCase().includes("synthesis")
    );
    expect(found).toBe(true);
  });

  it("returns empty array for non-matching search", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agentRegistry.list({ search: "zzz_nonexistent_agent_zzz" });
    expect(result).toEqual([]);
  });

  it("combines category and search filters", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agentRegistry.list({
      category: "strategic",
      search: "synthesis",
    });
    expect(result.length).toBeGreaterThan(0);
    result.forEach((a) => expect(a.category).toBe("strategic"));
  });

  it("gets a single agent by id", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agentRegistry.get({ id: "synthesis-agent" });
    expect(result).toHaveProperty("id", "synthesis-agent");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("version");
    expect(result).toHaveProperty("chainableFields");
    expect(result).not.toHaveProperty("systemPrompt");
  });

  it("throws for non-existent agent id", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.agentRegistry.get({ id: "does-not-exist" })
    ).rejects.toThrow("Agent not found");
  });

  it("returns registry stats", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agentRegistry.stats();
    expect(result).toHaveProperty("totalAgents");
    expect(result.totalAgents).toBeGreaterThanOrEqual(20);
    expect(result).toHaveProperty("categories");
    expect(Array.isArray(result.categories)).toBe(true);
    expect(result).toHaveProperty("capabilities");
    expect(Array.isArray(result.capabilities)).toBe(true);
    expect(result).toHaveProperty("byExecutionMode");
    expect(result.byExecutionMode).toHaveProperty("llm");
    expect(result.byExecutionMode).toHaveProperty("python");
    expect(result.byExecutionMode).toHaveProperty("hybrid");
  });
});
