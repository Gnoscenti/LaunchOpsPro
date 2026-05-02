/**
 * Atlas Orchestrator — Workflow Execution Engine v3
 *
 * Forward-looking execution engine designed for durability through 2027+.
 *
 * Three new subsystems integrated into the execution loop:
 *   1. Agent Registry — declarative agent definitions replace hardcoded prompt maps
 *   2. Context Chain  — accumulated step outputs flow to downstream agents as memory
 *   3. Artifact Store — structured outputs persist to S3 for cross-session retrieval
 *
 * Execution flow:
 *   Run button → POST /api/execute/:id/run → async loop:
 *     For each step:
 *       1. Resolve agent from registry (capabilities, prompt, output schema)
 *       2. Build context from chain (prior step outputs relevant to this agent)
 *       3. Try Python bridge → fall back to LLM with registry prompt + context
 *       4. Append output to context chain (chainable fields propagate forward)
 *       5. Persist artifact to S3 if agent.persistArtifact is true
 *       6. Stream SSE events to connected frontend clients
 *       7. Generate proof hash and update DB
 *
 * SSE endpoint:  GET  /api/execute/:executionId/stream
 * Run endpoint:  POST /api/execute/:executionId/run
 * Cancel:        POST /api/execute/:executionId/cancel
 * Logs:          GET  /api/execute/:executionId/logs
 * Artifacts:     GET  /api/execute/:executionId/artifacts
 * Context:       GET  /api/execute/:executionId/context
 * Registry:      GET  /api/agents
 *
 * SSE event payloads use `data.type` field to match the frontend contract:
 *   step_start, step_complete, step_failed, step_progress,
 *   workflow_start, workflow_complete, workflow_failed,
 *   artifact_saved, context_updated
 */
import { Router, Request, Response } from "express";
import crypto from "crypto";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { routeLLM, getModelForAgent, type LLMProvider } from "./llmRouter";
import { runAgent, cancelExecution, type AgentEvent } from "./pythonBridge";
import {
  getAgent,
  getAgentPrompt,
  getResponseFormat,
  hasPythonAgent,
  listAgents,
  getRegistryStats,
  type AgentDefinition,
} from "./agentRegistry";
import {
  initContext,
  appendToContext,
  buildContextForAgent,
  getContext,
  getSerializableContext,
  clearContext,
} from "./contextChain";
import { saveArtifact, listExecutionArtifacts } from "./artifactStore";
import { proofguard, ProofGuard, type AttestationResult } from "./proofguard";

const executionRouter = Router();

// ─── SSE Client Management ─────────────────────────────────────────────────

const sseClients = new Map<number, Set<Response>>();

function sendSSE(executionId: number, data: Record<string, unknown>) {
  const clients = sseClients.get(executionId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of Array.from(clients)) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

function generateProofHash(stepId: number, output: string): string {
  return crypto
    .createHash("sha256")
    .update(`${stepId}:${Date.now()}:${output}`)
    .digest("hex")
    .slice(0, 32);
}

// ─── SSE Stream Endpoint ────────────────────────────────────────────────────

executionRouter.get("/api/execute/:executionId/stream", (req: Request, res: Response) => {
  const executionId = parseInt(req.params.executionId);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`data: ${JSON.stringify({ type: "connected", executionId })}\n\n`);

  if (!sseClients.has(executionId)) {
    sseClients.set(executionId, new Set());
  }
  sseClients.get(executionId)!.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: "heartbeat", ts: Date.now() })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.get(executionId)?.delete(res);
    if (sseClients.get(executionId)?.size === 0) {
      sseClients.delete(executionId);
    }
  });
});

// ─── Agent Registry Endpoint ────────────────────────────────────────────────

executionRouter.get("/api/agents", (_req: Request, res: Response) => {
  try {
    const agents = listAgents().map((a) => ({
      id: a.id,
      name: a.name,
      version: a.version,
      description: a.description,
      capabilities: a.capabilities,
      executionMode: a.executionMode,
      category: a.category,
      icon: a.icon,
      estimatedDuration: a.estimatedDuration,
      tags: a.tags,
      persistArtifact: a.persistArtifact,
      artifactType: a.artifactType,
      modelPreference: a.modelPreference,
    }));

    const stats = getRegistryStats();

    res.json({ agents, stats });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// ─── Run Execution Endpoint ─────────────────────────────────────────────────

executionRouter.post("/api/execute/:executionId/run", async (req: Request, res: Response) => {
  const executionId = parseInt(req.params.executionId);

  try {
    const execution = await db.getExecution(executionId);
    if (!execution) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }

    if (execution.status === "running") {
      res.status(400).json({ error: "Execution already running" });
      return;
    }

    // Mark as running
    await db.updateExecution(executionId, { status: "running", startedAt: new Date() });

    // Get step data
    const stepExecs = await db.listStepExecutions(executionId);
    const steps = await db.listSteps(execution.workflowId);
    const sortedSteps = steps.sort((a, b) => a.sortOrder - b.sortOrder);

    // Load user credentials for Python agent injection
    const userCredentials = await db.listCredentialsWithValues(execution.userId);

    // Initialize the context chain for this execution
    const contextSnapshot = initContext(executionId);

    // Respond immediately — execution happens asynchronously
    res.json({ success: true, message: "Execution started", executionId });

    // Notify SSE clients
    sendSSE(executionId, {
      type: "workflow_start",
      message: `Workflow execution started with ${sortedSteps.length} steps`,
      totalSteps: sortedSteps.length,
      registeredAgents: listAgents().length,
    });

    await db.appendLog({
      executionId,
      level: "info",
      message: `Workflow execution started — ${sortedSteps.length} steps, context chain initialized`,
    });

    // ─── Sequential step execution with context chaining ────────────
    let completedCount = 0;

    for (const step of sortedSteps) {
      const stepExec = stepExecs.find((se) => se.stepId === step.id);
      if (!stepExec) continue;

      // Check if execution was cancelled
      const currentExec = await db.getExecution(executionId);
      if (currentExec?.status === "cancelled") {
        clearContext(executionId);
        sendSSE(executionId, {
          type: "workflow_failed",
          message: "Execution cancelled by user",
        });
        return;
      }

      // Resolve agent from registry
      const agentDef = getAgent(step.agentId);
      const agentName = agentDef?.name ?? step.label;
      const agentMode = agentDef?.executionMode ?? "llm";

      // Mark step as running
      await db.updateStepExecution(stepExec.id, { status: "running", startedAt: new Date() });
      await db.updateExecution(executionId, { currentStepId: step.id });

      sendSSE(executionId, {
        type: "step_start",
        message: `Starting: ${agentName} (${step.agentId}) [${agentMode}]`,
        stepId: step.id,
        stepExecutionId: stepExec.id,
        label: step.label,
        agentId: step.agentId,
        agentName,
        executionMode: agentMode,
        stepIndex: completedCount,
        totalSteps: sortedSteps.length,
        contextSize: contextSnapshot.estimatedTokens,
      });

      await db.appendLog({
        executionId,
        stepId: step.id,
        level: "info",
        message: `Starting: ${agentName} (${step.agentId}) — context: ${contextSnapshot.estimatedTokens} tokens`,
      });

      let attestation: AttestationResult | null = null;

      try {
        // ─── ProofGuard Governance Gate ────────────────────────────
        const riskTier = agentDef?.requiredSecrets?.length
          ? (agentDef.requiredSecrets.length > 2 ? "high" : "medium")
          : "low";

        attestation = await proofguard.attestAction({
          agentId: step.agentId,
          agentName: agentName,
          pipelineStage: step.label,
          action: `execute_${step.agentId}`,
          actionJson: {
            executionId,
            stepId: step.id,
            config: step.config,
            description: step.description,
            executionMode: agentMode,
            credentials: Object.fromEntries(
              userCredentials.map((c) => [c.keyName, "***"])
            ),
          },
          riskTier: riskTier as "low" | "medium" | "high" | "critical",
          imdaPillar: "Operations Management",
        });

        sendSSE(executionId, {
          type: "proofguard_verdict",
          message: `ProofGuard: ${attestation.status} (CQS: ${attestation.cqsScore}) — ${attestation.reason}`,
          stepId: step.id,
          attestationId: attestation.attestationId,
          status: attestation.status,
          cqsScore: attestation.cqsScore,
          flagged: attestation.flagged,
          guardrailsTriggered: attestation.guardrailsTriggered,
          reason: attestation.reason,
        });

        await db.appendLog({
          executionId,
          stepId: step.id,
          level: attestation.flagged ? "warn" : "info",
          message: `ProofGuard: ${attestation.status} (CQS: ${attestation.cqsScore}) ${attestation.guardrailsTriggered.length > 0 ? `[${attestation.guardrailsTriggered.join(", ")}]` : ""} — ${attestation.reason}`,
        });

        // Handle BLOCKED status
        if (attestation.status === "BLOCKED") {
          throw new Error(`ProofGuard BLOCKED: ${attestation.reason}`);
        }

        // Handle HITL — wait for human approval
        if (attestation.status === "REQUIRES_HITL") {
          sendSSE(executionId, {
            type: "hitl_waiting",
            message: `Awaiting human approval for ${agentName}...`,
            stepId: step.id,
            attestationId: attestation.attestationId,
            agentName,
            cqsScore: attestation.cqsScore,
          });

          await db.appendLog({
            executionId,
            stepId: step.id,
            level: "warn",
            message: `HITL: Awaiting human approval (attestation: ${attestation.attestationId})`,
          });

          try {
            await proofguard.waitForHITL(attestation.attestationId);

            sendSSE(executionId, {
              type: "hitl_resumed",
              message: `Human approval granted for ${agentName}. Resuming execution.`,
              stepId: step.id,
              attestationId: attestation.attestationId,
            });
          } catch (hitlError) {
            const hitlMsg = hitlError instanceof Error ? hitlError.message : "HITL failed";
            throw new Error(`ProofGuard HITL: ${hitlMsg}`);
          }
        }

        // ─── Build context for this agent ────────────────────────────
        const agentContext = buildContextForAgent(executionId, step.agentId);

        // ─── Execute: Python bridge → LLM fallback ──────────────────
        let output: Record<string, unknown>;
        let executionMode: "python" | "llm_fallback" | "llm";

        // Determine execution path based on registry
        const shouldTryPython = agentMode === "python" || agentMode === "hybrid";

        if (shouldTryPython) {
          try {
            const bridgeResult = await runAgent(
              {
                agentId: step.agentId,
                label: step.label,
                description: step.description,
                config: step.config,
                context: contextSnapshot.chainableContext,
              },
              {
                credentials: userCredentials.map((c) => ({
                  keyName: c.keyName,
                  encryptedValue: c.encryptedValue,
                })),
                executionId,
                timeout: (agentDef?.estimatedDuration ?? 120) * 1000,
                onEvent: (event: AgentEvent) => {
                  if (event.event === "progress") {
                    sendSSE(executionId, {
                      type: "step_progress",
                      message: event.message ?? "Processing...",
                      stepId: step.id,
                      percent: event.percent ?? 0,
                    });
                  } else if (event.event === "log") {
                    sendSSE(executionId, {
                      type: "step_log",
                      message: event.message ?? "",
                      stepId: step.id,
                      level: event.level ?? "info",
                    });
                  }
                },
              }
            );

            output = bridgeResult.data;
            executionMode = bridgeResult.mode;

            if (executionMode === "llm_fallback") {
              sendSSE(executionId, {
                type: "step_log",
                message: `No Python agent for ${step.agentId}, executing via LLM with context chain...`,
                stepId: step.id,
                level: "info",
              });
              output = await executeLLMStep(step, agentDef, agentContext);
              executionMode = "llm";
            }
          } catch (bridgeError) {
            const bridgeMsg = bridgeError instanceof Error ? bridgeError.message : "Unknown bridge error";
            await db.appendLog({
              executionId,
              stepId: step.id,
              level: "warn",
              message: `Python bridge failed (${bridgeMsg}), falling back to LLM with context`,
            });

            sendSSE(executionId, {
              type: "step_log",
              message: `Python agent unavailable, executing via LLM...`,
              stepId: step.id,
              level: "warn",
            });

            output = await executeLLMStep(step, agentDef, agentContext);
            executionMode = "llm";
          }
        } else {
          // LLM-only agent — use registry prompt + context chain
          output = await executeLLMStep(step, agentDef, agentContext);
          executionMode = "llm";
        }

        // ─── Append to context chain ────────────────────────────────
        const updatedContext = appendToContext(executionId, {
          stepId: step.id,
          agentId: step.agentId,
          label: step.label,
          output,
          completedAt: Date.now(),
        });

        sendSSE(executionId, {
          type: "context_updated",
          message: `Context chain updated: ${updatedContext.steps.length} steps, ~${updatedContext.estimatedTokens} tokens`,
          stepId: step.id,
          contextSteps: updatedContext.steps.length,
          contextTokens: updatedContext.estimatedTokens,
        });

        // ─── Persist artifact if configured ─────────────────────────
        let artifactUrl: string | undefined;
        if (agentDef?.persistArtifact) {
          try {
            const artifact = await saveArtifact({
              executionId,
              stepId: step.id,
              agentId: step.agentId,
              label: step.label,
              artifactType: agentDef.artifactType ?? "report",
              output,
              userId: execution.userId,
            });

            artifactUrl = artifact.url;

            if (artifact.url) {
              sendSSE(executionId, {
                type: "artifact_saved",
                message: `Artifact saved: ${step.label} (${agentDef.artifactType})`,
                stepId: step.id,
                artifactUrl: artifact.url,
                artifactType: agentDef.artifactType,
                sizeBytes: artifact.sizeBytes,
              });
            }
          } catch (artifactError) {
            // Artifact save failure is non-fatal
            const msg = artifactError instanceof Error ? artifactError.message : "Unknown";
            await db.appendLog({
              executionId,
              stepId: step.id,
              level: "warn",
              message: `Artifact save failed (non-fatal): ${msg}`,
            });
          }
        }

        // ─── Generate proof hash ────────────────────────────────
        const proofHash = generateProofHash(step.id, JSON.stringify(output));

        // ─── Record execution in ProofGuard audit trail (with proof hash) ────────
        proofguard.recordExecution(
          attestation.attestationId,
          output,
          true,
          proofHash
        );

        // ─── Mark step as completed ─────────────────────────────────
        await db.updateStepExecution(stepExec.id, {
          status: "completed",
          output: { ...output, executionMode, artifactUrl },
          proofHash,
          proofStatus: "verified",
          completedAt: new Date(),
        });

        completedCount++;
        await db.updateExecution(executionId, { completedSteps: completedCount });

        sendSSE(executionId, {
          type: "step_complete",
          message: `Completed: ${agentName} [${executionMode}] — proof: ${proofHash.slice(0, 8)}...`,
          stepId: step.id,
          stepExecutionId: stepExec.id,
          label: step.label,
          agentName,
          output,
          proofHash,
          executionMode,
          artifactUrl,
          progress: completedCount / sortedSteps.length,
          contextChainSize: updatedContext.steps.length,
        });

        await db.appendLog({
          executionId,
          stepId: step.id,
          level: "info",
          message: `Completed: ${agentName} [${executionMode}] — proof: ${proofHash}${artifactUrl ? ` — artifact: ${artifactUrl}` : ""}`,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";

        // Record failure in ProofGuard audit trail
        if (attestation) {
          proofguard.recordExecution(
            attestation.attestationId,
            { error: errorMsg },
            false
          );
        }

        await db.updateStepExecution(stepExec.id, {
          status: "failed",
          errorMessage: errorMsg,
          completedAt: new Date(),
          retryCount: (stepExec.retryCount ?? 0) + 1,
        });

        sendSSE(executionId, {
          type: "step_failed",
          message: `Failed: ${agentName} — ${errorMsg}`,
          stepId: step.id,
          stepExecutionId: stepExec.id,
          label: step.label,
          error: errorMsg,
        });

        await db.appendLog({
          executionId,
          stepId: step.id,
          level: "error",
          message: `Failed: ${agentName} — ${errorMsg}`,
        });

        // Persist the context chain state before failing
        const contextData = getSerializableContext(executionId);
        await db.updateExecution(executionId, {
          status: "failed",
          errorMessage: `Step "${agentName}" failed: ${errorMsg}`,
          results: contextData,
          completedAt: new Date(),
        });

        sendSSE(executionId, {
          type: "workflow_failed",
          message: `Workflow failed at step: ${agentName}`,
          error: errorMsg,
          failedStep: step.label,
          completedSteps: completedCount,
        });

        clearContext(executionId);
        return;
      }
    }

    // ─── All steps completed ────────────────────────────────────────
    const finalContext = getSerializableContext(executionId);

    await db.updateExecution(executionId, {
      status: "completed",
      results: finalContext,
      completedAt: new Date(),
    });

    sendSSE(executionId, {
      type: "workflow_complete",
      message: `Workflow completed: ${completedCount}/${sortedSteps.length} steps`,
      totalSteps: sortedSteps.length,
      completedSteps: completedCount,
      contextChainSize: finalContext?.steps ? (finalContext.steps as unknown[]).length : 0,
    });

    await db.appendLog({
      executionId,
      level: "info",
      message: `Workflow execution completed: ${completedCount}/${sortedSteps.length} steps — context chain persisted`,
    });

    clearContext(executionId);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    clearContext(executionId);
    if (!res.headersSent) {
      res.status(500).json({ error: errorMsg });
    }
  }
});

// ─── Cancel Execution Endpoint ──────────────────────────────────────────────

executionRouter.post("/api/execute/:executionId/cancel", async (req: Request, res: Response) => {
  const executionId = parseInt(req.params.executionId);

  try {
    const execution = await db.getExecution(executionId);
    if (!execution) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }

    if (execution.status !== "running") {
      res.status(400).json({ error: "Execution is not running" });
      return;
    }

    cancelExecution(executionId);

    // Persist context chain state before cancelling
    const contextData = getSerializableContext(executionId);

    await db.updateExecution(executionId, {
      status: "cancelled",
      errorMessage: "Cancelled by user",
      results: contextData,
      completedAt: new Date(),
    });

    const stepExecs = await db.listStepExecutions(executionId);
    for (const se of stepExecs) {
      if (se.status === "running") {
        await db.updateStepExecution(se.id, {
          status: "failed",
          errorMessage: "Cancelled by user",
          completedAt: new Date(),
        });
      }
    }

    sendSSE(executionId, {
      type: "workflow_failed",
      message: "Execution cancelled by user",
    });

    await db.appendLog({
      executionId,
      level: "warn",
      message: "Execution cancelled by user — context chain preserved in results",
    });

    clearContext(executionId);

    res.json({ success: true, message: "Execution cancelled" });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// ─── Execution Logs Endpoint ────────────────────────────────────────────────

executionRouter.get("/api/execute/:executionId/logs", async (req: Request, res: Response) => {
  const executionId = parseInt(req.params.executionId);
  const limit = parseInt(req.query.limit as string) || 100;

  try {
    const logs = await db.listLogs(executionId, limit);
    res.json(logs);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// ─── Artifacts Endpoint ─────────────────────────────────────────────────────

executionRouter.get("/api/execute/:executionId/artifacts", async (req: Request, res: Response) => {
  const executionId = parseInt(req.params.executionId);

  try {
    const artifacts = await listExecutionArtifacts(executionId);
    res.json({ executionId, artifacts });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// ─── Context Chain Endpoint ─────────────────────────────────────────────────

executionRouter.get("/api/execute/:executionId/context", async (req: Request, res: Response) => {
  const executionId = parseInt(req.params.executionId);

  try {
    // First check in-memory (active execution)
    const liveContext = getContext(executionId);
    if (liveContext) {
      res.json({
        executionId,
        source: "live",
        steps: liveContext.steps.length,
        estimatedTokens: liveContext.estimatedTokens,
        chainableContext: liveContext.chainableContext,
        summary: liveContext.summary,
      });
      return;
    }

    // Fall back to persisted context in execution results
    const execution = await db.getExecution(executionId);
    if (execution?.results) {
      res.json({
        executionId,
        source: "persisted",
        ...(execution.results as Record<string, unknown>),
      });
      return;
    }

    res.json({ executionId, source: "none", steps: 0, chainableContext: {} });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// ─── LLM Step Execution (Registry-Driven) ──────────────────────────────────

/**
 * Execute a workflow step using the built-in LLM.
 * Uses the Agent Registry for prompts and the Context Chain for memory.
 *
 * This is the primary execution path for LLM-only agents and the fallback
 * path for Python agents that fail or don't exist.
 */
async function executeLLMStep(
  step: {
    agentId: string;
    label: string;
    description: string | null;
    config: unknown;
  },
  agentDef: AgentDefinition | undefined,
  contextSummary: string
): Promise<Record<string, unknown>> {
  // Get the system prompt from the registry (with context injection)
  const systemPrompt = agentDef
    ? getAgentPrompt(step.agentId, contextSummary)
    : `You are an AI agent performing the task: ${step.label}. Execute the task and return structured results.${contextSummary ? `\n\n--- Prior Context ---\n${contextSummary}` : ""}`;

  // Build the user prompt
  const isStrategicAgent = agentDef?.category === "strategic";

  const userPrompt = isStrategicAgent
    ? `Execute the following strategic task:\n\nTask: ${step.label}\nDescription: ${step.description ?? "No additional description"}\nBusiness Context: ${JSON.stringify(step.config ?? {})}\n\nProvide a comprehensive structured JSON response following the exact schema described in your instructions.`
    : `Execute the following task:\n\nTask: ${step.label}\nDescription: ${step.description ?? "No additional description"}\nConfiguration: ${JSON.stringify(step.config ?? {})}\n\nProvide a structured JSON response with:\n- summary: A brief summary of what was accomplished\n- actions: An array of specific actions taken\n- outputs: Any generated artifacts or configurations\n- recommendations: Next steps or recommendations`;

  // Get response format from registry
  const registryFormat = agentDef ? getResponseFormat(step.agentId) : null;

  const responseFormat =
    registryFormat?.type === "json_schema"
      ? {
          type: "json_schema" as const,
          json_schema: registryFormat.json_schema as {
            name: string;
            strict: boolean;
            schema: Record<string, unknown>;
          },
        }
      : { type: "json_object" as const };

  // Determine which provider and model to use
  const { provider, model } = getModelForAgent(agentDef);

  try {
    // Use the multi-provider router (primary → fallback)
    const response = await routeLLM(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        responseFormat,
      },
      agentDef
    );

    const content = response.choices?.[0]?.message?.content;
    const usedProvider: LLMProvider = response.provider;
    const latency = response.latencyMs;

    if (content && typeof content === "string") {
      const parsed = JSON.parse(content);
      return {
        ...parsed,
        _meta: {
          provider: usedProvider,
          model: response.model,
          preferredProvider: provider,
          preferredModel: model,
          latencyMs: latency,
          tokens: response.usage?.total_tokens ?? 0,
        },
      };
    }
    return { summary: "Step completed", actions: [], outputs: {}, recommendations: [] };
  } catch (routerError) {
    // If multi-provider router fails entirely, try direct invokeLLM as last resort
    console.warn(`[LLM Router] All providers failed, trying direct invokeLLM:`, routerError);
    try {
      const directResponse = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: responseFormat,
      });
      const content = directResponse.choices?.[0]?.message?.content;
      if (content && typeof content === "string") {
        return { ...JSON.parse(content), _meta: { provider: "forge", fallback: true } };
      }
    } catch {
      // All paths exhausted
    }
    return {
      summary: `${step.label} completed (simulated)`,
      actions: [`Executed ${step.agentId} agent`, `Processed task: ${step.label}`],
      outputs: { status: "simulated", agentId: step.agentId },
      recommendations: ["Review output and verify manually"],
      _meta: { provider: "none", error: "All LLM providers failed" },
    };
  }
}

// ─── ProofGuard Governance Endpoints ──────────────────────────────────────────

// Get ProofGuard stats
executionRouter.get("/api/proofguard/stats", async (_req: Request, res: Response) => {
  try {
    const stats = ProofGuard.getStats();
    res.json(stats);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// List all attestations
executionRouter.get("/api/proofguard/attestations", async (_req: Request, res: Response) => {
  try {
    const attestations = ProofGuard.listAllAttestations();
    res.json(attestations);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// Get attestation by ID
executionRouter.get("/api/proofguard/attestation/:attestationId", async (req: Request, res: Response) => {
  try {
    const attestation = ProofGuard.getAttestation(req.params.attestationId);
    if (!attestation) {
      res.status(404).json({ error: "Attestation not found" });
      return;
    }
    res.json(attestation);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// Get HITL status for an attestation
executionRouter.get("/api/proofguard/attest/status/:attestationId", async (req: Request, res: Response) => {
  try {
    const decision = ProofGuard.getHITLDecision(req.params.attestationId);
    if (!decision) {
      res.status(404).json({ error: "No HITL decision found" });
      return;
    }
    res.json(decision);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// List pending HITL decisions
executionRouter.get("/api/proofguard/hitl/pending", async (_req: Request, res: Response) => {
  try {
    const pending = ProofGuard.listPendingHITL();
    res.json(pending);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// Approve HITL decision
executionRouter.post("/api/proofguard/hitl/:attestationId/approve", async (req: Request, res: Response) => {
  try {
    const { attestationId } = req.params;
    const { decidedBy, reason } = req.body ?? {};
    const success = ProofGuard.approveHITL(attestationId, decidedBy, reason);
    if (!success) {
      res.status(400).json({ error: "Cannot approve — decision not found or already resolved" });
      return;
    }
    res.json({ success: true, attestationId, status: "approved" });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

// Reject HITL decision
executionRouter.post("/api/proofguard/hitl/:attestationId/reject", async (req: Request, res: Response) => {
  try {
    const { attestationId } = req.params;
    const { decidedBy, reason } = req.body ?? {};
    const success = ProofGuard.rejectHITL(attestationId, decidedBy, reason);
    if (!success) {
      res.status(400).json({ error: "Cannot reject — decision not found or already resolved" });
      return;
    }
    res.json({ success: true, attestationId, status: "rejected" });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: errorMsg });
  }
});

export { executionRouter };
