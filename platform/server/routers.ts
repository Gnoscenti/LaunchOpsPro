import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { listAgents, getAgent, findAgentsByCapability, findAgentsByCategory, getRegistryStats } from "./agentRegistry";
import { getProviderHealth, getRoutingStats, getModelForAgent, getAvailableProviders } from "./llmRouter";
import type { AgentCapability } from "./agentRegistry";
import { ProofGuard } from "./proofguard";
import {
  TIER_CONFIGS,
  type SubscriptionTier,
  getReportQuotaInfo,
  canAccessAgent,
  canUseProofGuard,
  canUseHITL,
  canExportCompliance,
  getUpgradeSuggestion,
  hasReportQuota,
} from "./subscriptionTiers";


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

  /** Auto-seed credentials from environment variables (Stripe, GitHub) */
  seedFromEnv: protectedProcedure.mutation(async ({ ctx }) => {
    const seeded: string[] = [];
    const envCredentials = [
      {
        keyName: "STRIPE_SECRET_KEY",
        envVar: "STRIPE_SECRET_KEY",
        service: "stripe",
        description: "Stripe API secret key for payment processing",
      },
      {
        keyName: "GITHUB_TOKEN",
        envVar: "GITHUB_TOKEN",
        service: "github",
        description: "GitHub personal access token for repository operations",
      },
    ];

    for (const cred of envCredentials) {
      const value = process.env[cred.envVar];
      if (value) {
        const encryptedValue = Buffer.from(value).toString("base64");
        await db.upsertCredential({
          userId: ctx.user.id,
          keyName: cred.keyName,
          encryptedValue,
          service: cred.service,
          description: cred.description,
        });
        seeded.push(cred.keyName);
      }
    }

    return { seeded, count: seeded.length };
  }),

  /** Validate a credential by testing the API connection */
  validate: protectedProcedure
    .input(z.object({ keyName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const creds = await db.listCredentialsWithValues(ctx.user.id);
      const cred = creds.find((c) => c.keyName === input.keyName);
      if (!cred) throw new Error("Credential not found");

      const value = Buffer.from(cred.encryptedValue, "base64").toString("utf-8");

      try {
        if (cred.service === "stripe" || input.keyName.includes("STRIPE")) {
          const res = await fetch("https://api.stripe.com/v1/balance", {
            headers: { Authorization: `Bearer ${value}` },
          });
          return { valid: res.ok, service: "stripe", status: res.status };
        }

        if (cred.service === "github" || input.keyName.includes("GITHUB")) {
          const res = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${value}`, "User-Agent": "LaunchOps" },
          });
          return { valid: res.ok, service: "github", status: res.status };
        }

        return { valid: true, service: "unknown", status: 200 };
      } catch (err) {
        return { valid: false, service: cred.service ?? "unknown", error: String(err) };
      }
    }),
});

// ─── ProofGuard Router ─────────────────────────────────────────────

const proofguardRouter = router({
  stats: protectedProcedure.query(async () => {
    // Merge in-memory stats with persistent DB stats
    const memStats = ProofGuard.getStats();
    const dbStats = await db.getAttestationStats();
    return {
      ...memStats,
      persistent: dbStats,
      totalAllTime: dbStats.total,
    };
  }),

  attestations: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      // Return persistent attestations from DB (survives restarts)
      const limit = input?.limit ?? 100;
      return db.listAttestations(limit);
    }),

  forExecution: protectedProcedure
    .input(z.object({ executionId: z.number() }))
    .query(async ({ input }) => {
      return db.getAttestationsForExecution(input.executionId);
    }),

  pendingHitl: protectedProcedure.query(() => {
    return ProofGuard.listPendingHITL();
  }),

  approveHitl: protectedProcedure
    .input(z.object({ attestationId: z.string(), reason: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      const success = ProofGuard.approveHITL(
        input.attestationId,
        ctx.user.name ?? "owner",
        input.reason
      );
      if (!success) throw new Error("Cannot approve — decision not found or already resolved");
      return { success: true, attestationId: input.attestationId, status: "approved" };
    }),

  rejectHitl: protectedProcedure
    .input(z.object({ attestationId: z.string(), reason: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      const success = ProofGuard.rejectHITL(
        input.attestationId,
        ctx.user.name ?? "owner",
        input.reason
      );
      if (!success) throw new Error("Cannot reject — decision not found or already resolved");
      return { success: true, attestationId: input.attestationId, status: "rejected" };
    }),
});

// ─── Subscription Router ────────────────────────────────────────────────

const subscriptionRouter = router({
  /** Get current user's subscription info + quota */
  current: protectedProcedure.query(async ({ ctx }) => {
    const sub = await db.getUserSubscription(ctx.user.id);
    const tier = (sub?.subscriptionTier ?? 'explorer') as SubscriptionTier;
    const config = TIER_CONFIGS[tier];
    const usage = await db.getReportUsage(ctx.user.id);
    const quota = getReportQuotaInfo(tier, usage.used);

    return {
      tier,
      tierConfig: config,
      quota,
      stripeCustomerId: sub?.stripeCustomerId ?? null,
      stripeSubscriptionId: sub?.stripeSubscriptionId ?? null,
    };
  }),

  /** Get all available tiers for pricing page */
  tiers: publicProcedure.query(() => {
    return Object.values(TIER_CONFIGS);
  }),

  /** Check if user can access a specific feature */
  checkAccess: protectedProcedure
    .input(z.object({
      feature: z.enum(['proofguard', 'hitl', 'compliance-export', 'unlimited-reports', 'all-agents']),
      agentId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const sub = await db.getUserSubscription(ctx.user.id);
      const tier = (sub?.subscriptionTier ?? 'explorer') as SubscriptionTier;

      let allowed = false;
      switch (input.feature) {
        case 'proofguard': allowed = canUseProofGuard(tier); break;
        case 'hitl': allowed = canUseHITL(tier); break;
        case 'compliance-export': allowed = canExportCompliance(tier); break;
        case 'unlimited-reports': allowed = TIER_CONFIGS[tier].reportLimit === -1; break;
        case 'all-agents': allowed = TIER_CONFIGS[tier].agentAccess !== 'basic'; break;
      }

      if (input.agentId) {
        allowed = allowed && canAccessAgent(tier, input.agentId);
      }

      const upgrade = !allowed ? getUpgradeSuggestion(tier, input.feature) : null;

      return { allowed, currentTier: tier, upgrade };
    }),

  /** Check report quota before execution */
  checkQuota: protectedProcedure.query(async ({ ctx }) => {
    const usage = await db.getReportUsage(ctx.user.id);
    const tier = usage.tier as SubscriptionTier;
    const quota = getReportQuotaInfo(tier, usage.used);
    const canRun = hasReportQuota(tier, usage.used);
    const upgrade = !canRun ? getUpgradeSuggestion(tier, 'unlimited reports') : null;

    return { canRun, quota, tier, upgrade };
  }),

  /** Consume a report (called when execution starts) */
  consumeReport: protectedProcedure.mutation(async ({ ctx }) => {
    const usage = await db.getReportUsage(ctx.user.id);
    const tier = usage.tier as SubscriptionTier;

    if (!hasReportQuota(tier, usage.used)) {
      const upgrade = getUpgradeSuggestion(tier, 'unlimited reports');
      return { success: false, reason: 'quota_exhausted', upgrade };
    }

    const newCount = await db.incrementReportCount(ctx.user.id);
    const quota = getReportQuotaInfo(tier, newCount);
    return { success: true, quota };
  }),

  /** Create a Stripe Checkout Session for subscription upgrade */
  createCheckout: protectedProcedure
    .input(z.object({
      tierId: z.enum(['founder', 'governance', 'enterprise']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getStripePriceId, getOrCreateStripeCustomer, stripe } = await import('./stripeProducts');
      const priceId = getStripePriceId(input.tierId);

      // Get or create Stripe customer
      const sub = await db.getUserSubscription(ctx.user.id);
      const stripeCustomerId = await getOrCreateStripeCustomer({
        id: ctx.user.id,
        email: ctx.user.email,
        name: ctx.user.name,
        stripeCustomerId: sub?.stripeCustomerId,
      });

      // Save customer ID if new
      if (!sub?.stripeCustomerId) {
        await db.updateUserStripeCustomerId(ctx.user.id, stripeCustomerId);
      }

      const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/$/, '') || '';

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?canceled=true`,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email || '',
          customer_name: ctx.user.name || '',
          tier_id: input.tierId,
        },
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            user_id: ctx.user.id.toString(),
            tier_id: input.tierId,
          },
        },
      });

      return { checkoutUrl: session.url };
    }),

  /** Create a Stripe Customer Portal session for subscription management */
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const { stripe } = await import('./stripeProducts');
    const sub = await db.getUserSubscription(ctx.user.id);

    if (!sub?.stripeCustomerId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No Stripe customer found. Subscribe to a plan first.',
      });
    }

    const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/$/, '') || '';

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/pricing`,
    });

    return { portalUrl: session.url };
  }),

  /** Get payment history from Stripe */
  paymentHistory: protectedProcedure.query(async ({ ctx }) => {
    const sub = await db.getUserSubscription(ctx.user.id);
    if (!sub?.stripeCustomerId) {
      return { invoices: [] };
    }

    try {
      const { stripe } = await import('./stripeProducts');
      const invoices = await stripe.invoices.list({
        customer: sub.stripeCustomerId,
        limit: 20,
      });

      return {
        invoices: invoices.data.map((inv) => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amountDue: inv.amount_due,
          amountPaid: inv.amount_paid,
          currency: inv.currency,
          created: inv.created * 1000, // convert to ms
          periodStart: inv.period_start ? inv.period_start * 1000 : null,
          periodEnd: inv.period_end ? inv.period_end * 1000 : null,
          hostedInvoiceUrl: inv.hosted_invoice_url,
          invoicePdf: inv.invoice_pdf,
        })),
      };
    } catch (err) {
      console.error('[Subscription] Failed to fetch invoices:', err);
      return { invoices: [] };
    }
  }),

  /** Admin: set a user's tier (for manual upgrades or testing) */
  setTier: adminProcedure
    .input(z.object({
      userId: z.number(),
      tier: z.enum(['explorer', 'founder', 'governance', 'enterprise']),
    }))
    .mutation(async ({ input }) => {
      await db.updateUserTier(input.userId, input.tier);
      return { success: true, userId: input.userId, tier: input.tier };
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
      // Create step execution record for the single step
      const steps = await db.listSteps(workflow.id);
      for (const step of steps) {
        await db.createStepExecution({
          executionId: execution.id,
          stepId: step.id,
          status: "pending",
        });
      }

      return {
        workflowId: workflow.id,
        executionId: execution.id,
        agentName: agent.name,
        message: `Quick launch started for ${agent.name}`,
      };
    }),
  // ─── Launch Pipeline (Intake Form → Multi-Stage Workflow) ─────────────
  launchPipeline: protectedProcedure
    .input(
      z.object({
        businessName: z.string().min(1),
        industry: z.string().min(1),
        targetMarket: z.string().min(1),
        businessModel: z.string().min(1),
        goals: z.string().min(1),
        budgetRange: z.string().optional(),
        timeline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const businessContext = {
        businessName: input.businessName,
        industry: input.industry,
        targetMarket: input.targetMarket,
        businessModel: input.businessModel,
        goals: input.goals,
        budgetRange: input.budgetRange ?? "Not specified",
        timeline: input.timeline ?? "90-days",
      };

      const pipelineStages = [
        {
          agentId: "formation-advisor",
          label: `Business Formation: ${input.businessName}`,
          description: `You are producing SPECIFIC, READY-TO-USE legal formation deliverables for "${input.businessName}" — a ${input.businessModel} business in ${input.industry} targeting ${input.targetMarket}.

PRODUCE THESE EXACT DELIVERABLES:
1. ARTICLES OF INCORPORATION — Write the actual draft text with all required clauses (company name, purpose, registered agent placeholder, authorized shares, incorporator info). Format it as a ready-to-file document.
2. ENTITY RECOMMENDATION — Explain exactly WHY you chose this entity type for their specific situation (${input.businessModel} in ${input.industry}).
3. FILING CHECKLIST — Step-by-step with exact URLs (e.g., https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx for Delaware name search). Include exact costs.
4. EIN APPLICATION STEPS — Exact IRS URL (https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online), what to select at each step.
5. OPERATING AGREEMENT TEMPLATE — Write a complete single-member LLC operating agreement OR corporate bylaws template with blanks for their specific details.
6. IMMEDIATE NEXT ACTIONS — Numbered list of exactly what to do TODAY, with time estimates.

Business goals: ${input.goals}
Budget: ${input.budgetRange ?? "lean/bootstrap"}
Timeline: ${input.timeline ?? "90 days"}

Be EXTREMELY specific. Include actual URLs, actual dollar amounts, actual document text. No generic advice.`,
          sortOrder: 0,
        },
        {
          agentId: "systems-agent",
          label: `Infrastructure & Tech Stack: ${input.businessName}`,
          description: `You are producing SPECIFIC, READY-TO-EXECUTE infrastructure deliverables for "${input.businessName}" — a ${input.businessModel} in ${input.industry}.

PRODUCE THESE EXACT DELIVERABLES:
1. TECH STACK DECISION MATRIX — Table with: Tool | Purpose | Monthly Cost | Setup Time | Why This Over Alternatives. Keep total under $200/mo for first 90 days.
2. EXACT SETUP COMMANDS — Terminal commands to run. Example format:
   \`\`\`bash
   # Set up project
   npx create-next-app@latest ${input.businessName.toLowerCase().replace(/\s+/g, '-')} --typescript --tailwind
   cd ${input.businessName.toLowerCase().replace(/\s+/g, '-')}
   npm install stripe @auth/nextjs prisma
   \`\`\`
3. DOMAIN & HOSTING SETUP — Specific domain name suggestions (check format: ${input.businessName.toLowerCase().replace(/\s+/g, '')}.com, .ai, .io), exact hosting provider with pricing, DNS setup steps.
4. CRM PIPELINE CONFIGURATION — Exact stages, automation rules, and email templates for their target market (${input.targetMarket}).
5. PROJECT STRUCTURE — Actual file/folder structure they should create:
   \`\`\`
   ${input.businessName.toLowerCase().replace(/\s+/g, '-')}/
   ├── src/
   │   ├── app/
   │   ├── components/
   │   ├── lib/
   │   └── ...
   \`\`\`
6. ENVIRONMENT VARIABLES TEMPLATE — .env.example with all required keys listed.
7. TWO-WEEK SPRINT PLAN — Day-by-day with specific deliverables and time estimates.

Target market: ${input.targetMarket}
Goals: ${input.goals}
Budget: ${input.budgetRange ?? "lean/bootstrap"}

Be EXTREMELY specific. Actual commands, actual URLs, actual config files. No generic advice.`,
          sortOrder: 1,
        },
        {
          agentId: "stripe-agent",
          label: `Payment Processing: ${input.businessName}`,
          description: `You are producing SPECIFIC, READY-TO-USE payment processing deliverables for "${input.businessName}" — a ${input.businessModel} targeting ${input.targetMarket}.

PRODUCE THESE EXACT DELIVERABLES:
1. PRICING TABLE — Exact tiers with names, prices, and features. Format:
   | Tier | Monthly Price | Annual Price | Features |
   Design pricing specifically for ${input.targetMarket} in ${input.industry}.

2. STRIPE SETUP STEPS — Exact sequence:
   - Go to https://dashboard.stripe.com/register
   - Create products via API or dashboard (provide exact product JSON)
   - Set up checkout sessions

3. STRIPE INTEGRATION CODE — Ready-to-paste code snippets:
   \`\`\`typescript
   // Create checkout session
   const session = await stripe.checkout.sessions.create({
     line_items: [{ price: 'price_xxx', quantity: 1 }],
     mode: 'subscription',
     success_url: 'https://yoursite.com/success',
     cancel_url: 'https://yoursite.com/cancel',
   });
   \`\`\`

4. REVENUE MODEL — Monthly projections for months 1-12 based on their business model (${input.businessModel}) and target market.

5. PAYMENT FLOW DIAGRAM — Text-based flow: Customer → Checkout → Payment → Fulfillment → Recurring

6. WEBHOOK SETUP — Exact webhook events to listen for and handler code.

7. PRICING PSYCHOLOGY — Why these specific price points work for ${input.targetMarket}.

Goals: ${input.goals}
Budget: ${input.budgetRange ?? "lean/bootstrap"}

Include actual code, actual Stripe API calls, actual pricing numbers. No generic advice.`,
          sortOrder: 2,
        },
        {
          agentId: "funding-intelligence",
          label: `Funding Strategy: ${input.businessName}`,
          description: `You are producing SPECIFIC, READY-TO-USE funding deliverables for "${input.businessName}" — a ${input.businessModel} in ${input.industry}.

PRODUCE THESE EXACT DELIVERABLES:
1. PITCH DECK OUTLINE — Exact slides with content for each:
   Slide 1: Title — "${input.businessName}: [tagline]"
   Slide 2: Problem — [specific problem for ${input.targetMarket}]
   Slide 3: Solution — [your specific solution]
   Slide 4: Market Size — [TAM/SAM/SOM with actual numbers for ${input.industry}]
   Slide 5: Business Model — [revenue streams]
   Slide 6: Traction — [milestones to hit]
   Slide 7: Team — [what to highlight]
   Slide 8: Ask — [specific amount and use of funds]

2. INVESTOR EMAIL TEMPLATE — Ready-to-send cold outreach email:
   Subject line, body, and follow-up sequence (3 emails).

3. FUNDING ROADMAP — Timeline with specific milestones:
   Month 1-3: [specific actions]
   Month 4-6: [specific actions]
   Month 7-12: [specific actions]

4. GRANT OPPORTUNITIES — Specific grants with:
   - Name, URL, deadline, amount, eligibility requirements
   - Focus on AI/tech grants, SBIR/STTR if applicable

5. INVESTOR TARGET LIST — Types of investors for ${input.industry} ${input.businessModel}:
   - Angel investors: where to find them (specific platforms)
   - VCs: what stage, what they look for
   - Accelerators: specific programs with application URLs and deadlines

6. FINANCIAL PROJECTIONS — 12-month P&L projection with assumptions.

Goals: ${input.goals}
Budget: ${input.budgetRange ?? "Not specified"}

Include actual numbers, actual URLs, actual email text. No generic advice.`,
          sortOrder: 3,
        },
        {
          agentId: "execai-coach",
          label: `Executive Coaching: ${input.businessName}`,
          description: `You are producing a SPECIFIC, DAY-BY-DAY action plan for the founder of "${input.businessName}" — a ${input.businessModel} in ${input.industry} targeting ${input.targetMarket}.

PRODUCE THESE EXACT DELIVERABLES:
1. 30-DAY CALENDAR — Specific tasks for EACH DAY:
   Day 1: [exact task with time estimate, e.g., "Register LLC on Delaware Division of Corporations website (45 min)"]
   Day 2: [exact task]
   Day 3: [exact task]
   ... through Day 30

2. WEEKLY MILESTONES — What must be DONE (not started) by end of each week:
   Week 1: Entity formed, bank account opened, domain registered
   Week 2: MVP wireframes complete, first 10 prospects identified
   Week 3: Landing page live, outreach to first 20 prospects
   Week 4: First pilot customer signed, payment processing live

3. DECISION FRAMEWORK — For the top 3 decisions they face RIGHT NOW:
   Decision 1: [specific to their situation]
   - Option A: [pros, cons, recommendation]
   - Option B: [pros, cons, recommendation]
   - Recommended: [with reasoning]

4. ACCOUNTABILITY METRICS — Exact KPIs to track weekly:
   - [Metric]: [Target] by [Date]
   - [Metric]: [Target] by [Date]

5. FOUNDER ENERGY MANAGEMENT — Specific daily routine:
   - Morning: [exact routine]
   - Work blocks: [specific time allocation]
   - Evening: [wind-down routine]

6. RISK REGISTER — Top 5 risks with mitigation:
   Risk 1: [specific risk] → Mitigation: [specific action]

Goals: ${input.goals}
Timeline: ${input.timeline ?? "90 days"}

Be EXTREMELY specific. Actual dates, actual tasks, actual time estimates. No generic advice.`,
          sortOrder: 4,
        },
        {
          agentId: "growth-agent",
          label: `Growth & Marketing: ${input.businessName}`,
          description: `You are producing SPECIFIC, READY-TO-USE marketing deliverables for "${input.businessName}" — a ${input.businessModel} in ${input.industry} targeting ${input.targetMarket}.

PRODUCE THESE EXACT DELIVERABLES:
1. LANDING PAGE COPY — Complete, ready-to-paste landing page:
   - Hero headline and subheadline
   - 3 benefit sections with headlines and body copy
   - Social proof section
   - CTA button text and surrounding copy
   - FAQ section (5 questions)

2. SOCIAL MEDIA CONTENT — 10 ready-to-post pieces:
   Post 1: [Platform] — "[exact post text]"
   Post 2: [Platform] — "[exact post text]"
   ... through Post 10
   Include mix of LinkedIn, Twitter/X, and relevant platforms for ${input.targetMarket}.

3. EMAIL SEQUENCES — 5-email welcome/nurture sequence:
   Email 1 (Day 0): Subject: "[subject]" — Body: "[full email text]"
   Email 2 (Day 2): Subject: "[subject]" — Body: "[full email text]"
   ... through Email 5

4. CONTENT CALENDAR — 4-week content plan:
   Week 1: [specific topics, formats, platforms, posting times]
   Week 2: [specific topics, formats, platforms, posting times]
   Week 3: [specific topics, formats, platforms, posting times]
   Week 4: [specific topics, formats, platforms, posting times]

5. GROWTH CHANNELS RANKED — Top 5 channels for ${input.targetMarket}:
   Channel 1: [name] — Expected CAC: $X — Expected conversion: X% — Setup steps: [1, 2, 3]

6. LAUNCH ANNOUNCEMENT — Ready-to-send press release / Product Hunt launch text.

7. SEO KEYWORDS — 20 target keywords with search volume estimates and content ideas.

Goals: ${input.goals}
Budget: ${input.budgetRange ?? "lean/bootstrap"}

Write ACTUAL copy, ACTUAL posts, ACTUAL emails. No placeholders or generic advice.`,
          sortOrder: 5,
        },
      ];

      const workflow = await db.createWorkflow({
        userId: ctx.user.id,
        name: `Launch: ${input.businessName}`,
        description: `Full business launch pipeline for ${input.businessName} — ${input.industry} / ${input.businessModel}`,
        version: "1.0",
      });

      for (const stage of pipelineStages) {
        await db.createStep({
          workflowId: workflow.id,
          agentId: stage.agentId,
          label: stage.label,
          description: stage.description,
          sortOrder: stage.sortOrder,
          config: businessContext,
        });
      }

      const execution = await db.createExecution({
        workflowId: workflow.id,
        userId: ctx.user.id,
        status: "pending",
        totalSteps: pipelineStages.length,
      });

      const steps = await db.listSteps(workflow.id);
      for (const step of steps) {
        await db.createStepExecution({
          executionId: execution.id,
          stepId: step.id,
          status: "pending",
        });
      }

      return {
        workflowId: workflow.id,
        executionId: execution.id,
        stages: pipelineStages.length,
        message: `Pipeline created for ${input.businessName} with ${pipelineStages.length} stages`,
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

// ─── Naming Contest Router ──────────────────────────────────────────────

import crypto from "crypto";

const contestRouter = router({
  /** Create a new naming contest */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      candidates: z.array(z.object({
        id: z.string(),
        name: z.string(),
        tagline: z.string().optional(),
        scores: z.record(z.string(), z.number()).optional(),
      })).min(2).max(10),
      closesAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const shareId = crypto.randomBytes(12).toString("base64url");
      const result = await db.createNamingContest({
        userId: ctx.user.id,
        shareId,
        title: input.title,
        description: input.description ?? null,
        candidates: input.candidates,
        closesAt: input.closesAt ?? null,
      });
      return { id: result.id, shareId };
    }),

  /** List user's contests */
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.listContests(ctx.user.id);
  }),

  /** Get contest by shareId (public — no auth required) */
  getByShareId: publicProcedure
    .input(z.object({ shareId: z.string() }))
    .query(async ({ input }) => {
      const contest = await db.getContestByShareId(input.shareId);
      if (!contest) throw new Error("Contest not found");

      // Increment views
      await db.incrementContestViews(contest.id);

      // Get vote results
      const results = await db.getContestResults(contest.id);
      const comments = await db.getContestComments(contest.id);

      return {
        ...contest,
        results,
        comments,
      };
    }),

  /** Cast a vote (public — fingerprint-based dedup) */
  vote: publicProcedure
    .input(z.object({
      shareId: z.string(),
      candidateId: z.string(),
      voterName: z.string().optional(),
      comment: z.string().optional(),
      fingerprint: z.string(),
    }))
    .mutation(async ({ input }) => {
      const contest = await db.getContestByShareId(input.shareId);
      if (!contest) throw new Error("Contest not found");
      if (contest.status !== "active") throw new Error("Contest is closed");

      const result = await db.castVote({
        contestId: contest.id,
        candidateId: input.candidateId,
        voterFingerprint: input.fingerprint,
        voterName: input.voterName ?? null,
        comment: input.comment ?? null,
      });

      if (result.duplicate) {
        return { success: false, reason: "already_voted" };
      }

      // Get updated results
      const results = await db.getContestResults(contest.id);
      return { success: true, results };
    }),

  /** Close a contest (owner only) */
  close: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const contest = await db.getContest(input.id);
      if (!contest) throw new Error("Contest not found");
      if (contest.userId !== ctx.user.id) throw new Error("Not authorized");
      await db.closeContest(input.id);
      return { success: true };
    }),

  /** Get results for a contest (owner only) */
  results: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const contest = await db.getContest(input.id);
      if (!contest) throw new Error("Contest not found");
      if (contest.userId !== ctx.user.id) throw new Error("Not authorized");

      const results = await db.getContestResults(contest.id);
      const comments = await db.getContestComments(contest.id);

      return {
        contest,
        results,
        comments,
      };
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
  proofguard: proofguardRouter,
  subscription: subscriptionRouter,
  contest: contestRouter,
});

export type AppRouter = typeof appRouter;
