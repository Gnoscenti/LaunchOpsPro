import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { listAgents, getAgent, findAgentsByCapability, findAgentsByCategory, getRegistryStats } from "./agentRegistry";
import { getProviderHealth, getRoutingStats, getModelForAgent, getAvailableProviders } from "./llmRouter";
import type { AgentCapability } from "./agentRegistry";

// ─── Workflow Router ─────────────────────────────────────────────────────

const workflowRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.listWorkflows(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const workflow = await db.getWorkflow(input.id);
      if (!workflow) throw new Error("Workflow not found");
      return workflow;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        version: z.string().optional(),
        templateId: z.number().optional(),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.createWorkflow({
        userId: ctx.user.id,
        name: input.name,
        description: input.description ?? null,
        version: input.version ?? "1.0",
        templateId: input.templateId ?? null,
        metadata: input.metadata ?? null,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
        version: z.string().optional(),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateWorkflow(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteWorkflow(input.id);
      return { success: true };
    }),
});

// ─── Step Router ─────────────────────────────────────────────────────────

const stepRouter = router({
  list: protectedProcedure
    .input(z.object({ workflowId: z.number() }))
    .query(async ({ input }) => {
      return db.listSteps(input.workflowId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        workflowId: z.number(),
        agentId: z.string(),
        label: z.string(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        position: z.any().optional(),
        config: z.any().optional(),
        dependencies: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.createStep({
        workflowId: input.workflowId,
        agentId: input.agentId,
        label: input.label,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
        position: input.position ?? null,
        config: input.config ?? null,
        dependencies: input.dependencies ?? null,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        agentId: z.string().optional(),
        label: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        position: z.any().optional(),
        config: z.any().optional(),
        dependencies: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateStep(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteStep(input.id);
      return { success: true };
    }),

  bulkSave: protectedProcedure
    .input(
      z.object({
        workflowId: z.number(),
        steps: z.array(
          z.object({
            agentId: z.string(),
            label: z.string(),
            description: z.string().optional(),
            sortOrder: z.number().optional(),
            position: z.any().optional(),
            config: z.any().optional(),
            dependencies: z.any().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const stepsWithWorkflowId = input.steps.map((s) => ({
        ...s,
        workflowId: input.workflowId,
        description: s.description ?? null,
        sortOrder: s.sortOrder ?? 0,
        position: s.position ?? null,
        config: s.config ?? null,
        dependencies: s.dependencies ?? null,
      }));
      await db.bulkUpsertSteps(input.workflowId, stepsWithWorkflowId);
      return { success: true };
    }),
});

// ─── Execution Router ────────────────────────────────────────────────────

const executionRouter = router({
  list: protectedProcedure
    .input(z.object({ workflowId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.listExecutions(ctx.user.id, input?.workflowId);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const execution = await db.getExecution(input.id);
      if (!execution) throw new Error("Execution not found");
      return execution;
    }),

  start: protectedProcedure
    .input(z.object({ workflowId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const steps = await db.listSteps(input.workflowId);
      const exec = await db.createExecution({
        workflowId: input.workflowId,
        userId: ctx.user.id,
        status: "running",
        totalSteps: steps.length,
        completedSteps: 0,
        startedAt: new Date(),
      });

      // Create step executions for each step
      for (const step of steps) {
        await db.createStepExecution({
          executionId: exec.id,
          stepId: step.id,
          status: "pending",
        });
      }

      // Log the start
      await db.appendLog({
        executionId: exec.id,
        level: "info",
        message: `Workflow execution started with ${steps.length} steps`,
      });

      return exec;
    }),

  stepExecutions: protectedProcedure
    .input(z.object({ executionId: z.number() }))
    .query(async ({ input }) => {
      return db.listStepExecutions(input.executionId);
    }),

  advanceStep: protectedProcedure
    .input(
      z.object({
        executionId: z.number(),
        stepExecutionId: z.number(),
        status: z.enum(["running", "completed", "failed", "skipped"]),
        output: z.any().optional(),
        errorMessage: z.string().optional(),
        proofHash: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updateData: Record<string, unknown> = { status: input.status };
      if (input.status === "running") updateData.startedAt = new Date();
      if (input.status === "completed" || input.status === "failed") updateData.completedAt = new Date();
      if (input.output) updateData.output = input.output;
      if (input.errorMessage) updateData.errorMessage = input.errorMessage;
      if (input.proofHash) {
        updateData.proofHash = input.proofHash;
        updateData.proofStatus = "verified";
      }

      await db.updateStepExecution(input.stepExecutionId, updateData);

      // Update parent execution progress
      if (input.status === "completed") {
        const execution = await db.getExecution(input.executionId);
        if (execution) {
          const newCompleted = execution.completedSteps + 1;
          const isAllDone = newCompleted >= execution.totalSteps;
          await db.updateExecution(input.executionId, {
            completedSteps: newCompleted,
            ...(isAllDone ? { status: "completed", completedAt: new Date() } : {}),
          });
        }
      }

      if (input.status === "failed") {
        await db.updateExecution(input.executionId, {
          status: "failed",
          errorMessage: input.errorMessage ?? "Step failed",
          completedAt: new Date(),
        });
      }

      // Log the event
      await db.appendLog({
        executionId: input.executionId,
        stepId: input.stepExecutionId,
        level: input.status === "failed" ? "error" : "info",
        message: `Step ${input.status}${input.errorMessage ? `: ${input.errorMessage}` : ""}`,
      });

      return { success: true };
    }),

  /**
   * Trigger the actual workflow execution via the Python bridge + LLM engine.
   * This calls the Express /api/execute/:id/run endpoint internally.
   */
  run: protectedProcedure
    .input(z.object({ executionId: z.number() }))
    .mutation(async ({ input }) => {
      const execution = await db.getExecution(input.executionId);
      if (!execution) throw new Error("Execution not found");

      // Fire the execution engine asynchronously via internal HTTP call
      const port = process.env.PORT || "3000";
      try {
        const resp = await fetch(`http://localhost:${port}/api/execute/${input.executionId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await resp.json() as Record<string, unknown>;
        return { success: true, message: data.message ?? "Execution triggered" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        throw new Error(`Failed to trigger execution: ${msg}`);
      }
    }),

  /**
   * Cancel a running execution — kills the Python process and marks as cancelled.
   */
  cancel: protectedProcedure
    .input(z.object({ executionId: z.number() }))
    .mutation(async ({ input }) => {
      const port = process.env.PORT || "3000";
      try {
        const resp = await fetch(`http://localhost:${port}/api/execute/${input.executionId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await resp.json() as Record<string, unknown>;
        return { success: true, message: data.message ?? "Execution cancelled" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        throw new Error(`Failed to cancel execution: ${msg}`);
      }
    }),
});

// ─── Template Router ─────────────────────────────────────────────────────

const templateRouter = router({
  list: publicProcedure.query(async () => {
    return db.listTemplates();
  }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const template = await db.getTemplate(input.id);
      if (!template) throw new Error("Template not found");
      return template;
    }),

  clone: protectedProcedure
    .input(z.object({ templateId: z.number(), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const template = await db.getTemplate(input.templateId);
      if (!template) throw new Error("Template not found");

      // Create workflow from template
      const workflow = await db.createWorkflow({
        userId: ctx.user.id,
        name: input.name ?? `${template.name} (Copy)`,
        description: template.description,
        templateId: template.id,
        metadata: { clonedFrom: template.name, category: template.category },
      });

      // Create steps from template definition
      const definition = template.definition as { steps?: Array<Record<string, unknown>> } | null;
      if (definition?.steps) {
        const steps = definition.steps.map((s: Record<string, unknown>, i: number) => ({
          workflowId: workflow.id,
          agentId: (s.agentId as string) ?? "unknown",
          label: (s.label as string) ?? `Step ${i + 1}`,
          description: (s.description as string) ?? null,
          sortOrder: i,
          position: (s.position as Record<string, unknown>) ?? { x: 100 + (i % 3) * 280, y: 80 + Math.floor(i / 3) * 160 },
          config: (s.config as Record<string, unknown>) ?? null,
          dependencies: (s.dependencies as number[]) ?? null,
        }));
        await db.bulkUpsertSteps(workflow.id, steps);
      }

      await db.incrementTemplateCloneCount(input.templateId);

      return workflow;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        category: z.string(),
        icon: z.string().optional(),
        complexity: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        definition: z.any(),
        tags: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.createTemplate({
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        icon: input.icon ?? null,
        complexity: input.complexity ?? "intermediate",
        definition: input.definition,
        tags: input.tags ?? null,
      });
    }),
});

// ─── Credential Router ───────────────────────────────────────────────────

const credentialRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.listCredentials(ctx.user.id);
  }),

  save: protectedProcedure
    .input(
      z.object({
        keyName: z.string(),
        value: z.string(),
        service: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Simple base64 encoding for now — in production use proper encryption
      const encryptedValue = Buffer.from(input.value).toString("base64");
      return db.upsertCredential({
        userId: ctx.user.id,
        keyName: input.keyName,
        encryptedValue,
        service: input.service ?? null,
        description: input.description ?? null,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteCredential(input.id);
      return { success: true };
    }),
});

// ─── Agent Registry Router ──────────────────────────────────────────────

const agentRegistryRouter = router({
  /** List all registered agents (optionally filtered) */
  list: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        capability: z.string().optional(),
        executionMode: z.enum(["python", "llm", "hybrid"]).optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(({ input }) => {
      let agents = listAgents();

      if (input?.category) {
        agents = agents.filter((a) => a.category === input.category);
      }
      if (input?.capability) {
        agents = agents.filter((a) =>
          a.capabilities.includes(input.capability as AgentCapability)
        );
      }
      if (input?.executionMode) {
        agents = agents.filter((a) => a.executionMode === input.executionMode);
      }
      if (input?.search) {
        const q = input.search.toLowerCase();
        agents = agents.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q) ||
            a.id.toLowerCase().includes(q) ||
            a.tags?.some((t) => t.toLowerCase().includes(q))
        );
      }

      // Return a frontend-safe shape (strip systemPrompt for security)
      return agents.map((a) => ({
        id: a.id,
        name: a.name,
        version: a.version,
        description: a.description,
        capabilities: a.capabilities,
        executionMode: a.executionMode,
        outputFormat: a.outputFormat,
        modelPreference: a.modelPreference,
        persistArtifact: a.persistArtifact,
        artifactType: a.artifactType ?? null,
        requiredContext: a.requiredContext ?? [],
        requiredSecrets: a.requiredSecrets ?? [],
        tags: a.tags ?? [],
        category: a.category,
        icon: a.icon ?? "Bot",
        estimatedDuration: a.estimatedDuration ?? null,
        outputSchemaDescription: a.outputSchema.description,
        chainableFields: a.outputSchema.chainableFields ?? [],
      }));
    }),

  /** Get a single agent's full detail */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const agent = getAgent(input.id);
      if (!agent) throw new Error("Agent not found");
      return {
        id: agent.id,
        name: agent.name,
        version: agent.version,
        description: agent.description,
        capabilities: agent.capabilities,
        executionMode: agent.executionMode,
        outputFormat: agent.outputFormat,
        modelPreference: agent.modelPreference,
        persistArtifact: agent.persistArtifact,
        artifactType: agent.artifactType ?? null,
        requiredContext: agent.requiredContext ?? [],
        requiredSecrets: agent.requiredSecrets ?? [],
        tags: agent.tags ?? [],
        category: agent.category,
        icon: agent.icon ?? "Bot",
        estimatedDuration: agent.estimatedDuration ?? null,
        outputSchemaDescription: agent.outputSchema.description,
        chainableFields: agent.outputSchema.chainableFields ?? [],
      };
    }),

  /** Get registry-wide statistics */
  stats: publicProcedure.query(() => {
    return getRegistryStats();
  }),

  /** Get LLM provider health and routing stats */
  providerHealth: publicProcedure.query(() => {
    return getProviderHealth();
  }),

  /** Get full routing stats (providers + totals) */
  routingStats: publicProcedure.query(() => {
    return getRoutingStats();
  }),

  /** Get the model that would be used for a specific agent */
  modelForAgent: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(({ input }) => {
      const agent = getAgent(input.agentId);
      return getModelForAgent(agent ?? undefined);
    }),

  /** Quick-launch: create a single-step workflow from an agent and start execution */
  quickLaunch: protectedProcedure
    .input(
      z.object({
        agentId: z.string(),
        label: z.string().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const agent = getAgent(input.agentId);
      if (!agent) throw new Error(`Agent ${input.agentId} not found in registry`);

      // Create a single-step workflow
      const workflow = await db.createWorkflow({
        userId: ctx.user.id,
        name: input.label ?? `Quick Launch: ${agent.name}`,
        description: `Single-step execution of ${agent.name}`,
        version: "1.0",
      });

      // Add the single step
      await db.createStep({
        workflowId: workflow.id,
        agentId: input.agentId,
        label: input.label ?? agent.name,
        description: agent.description,
        sortOrder: 0,
        config: input.config ?? {},
      });

      // Start execution
      const execution = await db.createExecution({
        workflowId: workflow.id,
        userId: ctx.user.id,
        status: "pending",
        totalSteps: 1,
      });

      return {
        workflowId: workflow.id,
        executionId: execution.id,
        agentName: agent.name,
        message: `Quick launch started for ${agent.name}`,
      };
    }),
});

// ─── Dashboard Router ────────────────────────────────────────────────────

const dashboardRouter = router({
  /** Aggregate stats for the command center dashboard */
  stats: protectedProcedure.query(async ({ ctx }) => {
    return db.getDashboardStats(ctx.user.id);
  }),

  /** Execution metrics: success rate, durations, recent executions */
  metrics: protectedProcedure.query(async ({ ctx }) => {
    return db.getExecutionMetrics(ctx.user.id);
  }),

  /** Trust score computation from real credential/execution data */
  trust: protectedProcedure.query(async ({ ctx }) => {
    return db.computeTrustMetrics(ctx.user.id);
  }),

  /** Workflows with step counts and last execution for PilotScope */
  workflowDetails: protectedProcedure.query(async ({ ctx }) => {
    return db.getWorkflowsWithStepCounts(ctx.user.id);
  }),
});

// ─── Log Router ──────────────────────────────────────────────────────────

const logRouter = router({
  byExecution: protectedProcedure
    .input(z.object({ executionId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return db.listLogs(input.executionId, input.limit ?? 100);
    }),

  recent: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.listRecentLogs(input?.limit ?? 50);
    }),
});

// ─── Main App Router ─────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  workflow: workflowRouter,
  step: stepRouter,
  execution: executionRouter,
  template: templateRouter,
  credential: credentialRouter,
  log: logRouter,
  agentRegistry: agentRegistryRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
