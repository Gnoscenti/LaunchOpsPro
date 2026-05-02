/**
 * Atlas Orchestrator — Context Chain v1
 *
 * The Context Chain is the memory system for workflow executions.
 * As each step completes, its output is accumulated into a growing context
 * object that downstream agents can reference. This creates intelligent
 * continuity — the Synthesis Agent's output feeds the 7-Pillar Agent,
 * which feeds the Systems Agent, creating a coherent strategic pipeline.
 *
 * Design principles:
 *   1. Append-only — context grows monotonically during an execution
 *   2. Selective — agents declare which fields they need via requiredContext
 *   3. Summarizable — large contexts get compressed into summaries for LLM windows
 *   4. Persistent — context snapshots are stored in the DB for cross-session retrieval
 *   5. Chainable — each agent's output declares which fields are available downstream
 */

import { getAgent } from "./agentRegistry";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StepOutput {
  stepId: number;
  agentId: string;
  label: string;
  output: Record<string, unknown>;
  completedAt: number; // Unix timestamp ms
}

export interface ContextSnapshot {
  executionId: number;
  /** All step outputs accumulated so far, in execution order */
  steps: StepOutput[];
  /** Flattened key-value map of all chainable fields from all steps */
  chainableContext: Record<string, unknown>;
  /** Human-readable summary of the accumulated context */
  summary: string;
  /** Total token estimate for the context (rough heuristic) */
  estimatedTokens: number;
}

// ─── In-memory context store (per execution) ────────────────────────────────

const contextStore = new Map<number, ContextSnapshot>();

/**
 * Initialize a fresh context chain for an execution.
 */
export function initContext(executionId: number): ContextSnapshot {
  const snapshot: ContextSnapshot = {
    executionId,
    steps: [],
    chainableContext: {},
    summary: "",
    estimatedTokens: 0,
  };
  contextStore.set(executionId, snapshot);
  return snapshot;
}

/**
 * Append a completed step's output to the context chain.
 * Extracts chainable fields based on the agent's registry definition.
 */
export function appendToContext(
  executionId: number,
  stepOutput: StepOutput
): ContextSnapshot {
  let snapshot = contextStore.get(executionId);
  if (!snapshot) {
    snapshot = initContext(executionId);
  }

  // Add the step output
  snapshot.steps.push(stepOutput);

  // Extract chainable fields from the agent's output
  const agentDef = getAgent(stepOutput.agentId);
  const chainableFields = agentDef?.outputSchema?.chainableFields ?? [];

  for (const field of chainableFields) {
    if (field in stepOutput.output) {
      // Namespace by agentId to avoid collisions
      snapshot.chainableContext[`${stepOutput.agentId}.${field}`] = stepOutput.output[field];
      // Also store without namespace for convenience (last-write-wins)
      snapshot.chainableContext[field] = stepOutput.output[field];
    }
  }

  // For agents without explicit chainable fields, extract summary and recommendations
  if (chainableFields.length === 0) {
    if ("summary" in stepOutput.output) {
      snapshot.chainableContext[`${stepOutput.agentId}.summary`] = stepOutput.output.summary;
    }
    if ("recommendations" in stepOutput.output) {
      snapshot.chainableContext[`${stepOutput.agentId}.recommendations`] = stepOutput.output.recommendations;
    }
  }

  // Rebuild the summary
  snapshot.summary = buildContextSummary(snapshot);
  snapshot.estimatedTokens = estimateTokens(snapshot.summary);

  return snapshot;
}

/**
 * Get the current context snapshot for an execution.
 */
export function getContext(executionId: number): ContextSnapshot | undefined {
  return contextStore.get(executionId);
}

/**
 * Build a context summary string suitable for injection into an LLM prompt.
 * Respects the agent's requiredContext to only include relevant fields.
 */
export function buildContextForAgent(
  executionId: number,
  agentId: string
): string {
  const snapshot = contextStore.get(executionId);
  if (!snapshot || snapshot.steps.length === 0) {
    return "";
  }

  const agentDef = getAgent(agentId);
  const requiredFields = agentDef?.requiredContext ?? [];

  // If the agent has no specific requirements, give it the full summary
  if (requiredFields.length === 0) {
    return snapshot.summary;
  }

  // Build a targeted context with only the fields this agent needs
  const relevantContext: Record<string, unknown> = {};
  for (const field of requiredFields) {
    if (field in snapshot.chainableContext) {
      relevantContext[field] = snapshot.chainableContext[field];
    }
  }

  if (Object.keys(relevantContext).length === 0) {
    return snapshot.summary;
  }

  const parts: string[] = [];
  parts.push("## Accumulated Context from Prior Steps\n");

  for (const [key, value] of Object.entries(relevantContext)) {
    if (typeof value === "string") {
      parts.push(`### ${formatFieldName(key)}\n${value}\n`);
    } else if (Array.isArray(value)) {
      parts.push(`### ${formatFieldName(key)}`);
      for (const item of value) {
        if (typeof item === "string") {
          parts.push(`- ${item}`);
        } else {
          parts.push(`- ${JSON.stringify(item)}`);
        }
      }
      parts.push("");
    } else if (typeof value === "object" && value !== null) {
      parts.push(`### ${formatFieldName(key)}\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`);
    }
  }

  return parts.join("\n");
}

/**
 * Clean up the context store for a completed/cancelled execution.
 */
export function clearContext(executionId: number): void {
  contextStore.delete(executionId);
}

/**
 * Get the serializable context data for DB persistence.
 */
export function getSerializableContext(executionId: number): Record<string, unknown> | null {
  const snapshot = contextStore.get(executionId);
  if (!snapshot) return null;

  return {
    steps: snapshot.steps.map((s) => ({
      stepId: s.stepId,
      agentId: s.agentId,
      label: s.label,
      completedAt: s.completedAt,
      // Store a compact version of the output (first 2000 chars of JSON)
      outputPreview: JSON.stringify(s.output).slice(0, 2000),
    })),
    chainableContext: snapshot.chainableContext,
    summary: snapshot.summary,
    estimatedTokens: snapshot.estimatedTokens,
  };
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function buildContextSummary(snapshot: ContextSnapshot): string {
  if (snapshot.steps.length === 0) return "";

  const parts: string[] = [];
  parts.push(`# Workflow Execution Context (${snapshot.steps.length} steps completed)\n`);

  for (const step of snapshot.steps) {
    parts.push(`## ${step.label} (${step.agentId})`);

    // Extract the most useful summary fields
    const output = step.output;
    if ("summary" in output && typeof output.summary === "string") {
      parts.push(output.summary);
    }
    if ("executive_summary" in output && Array.isArray(output.executive_summary)) {
      parts.push("Key points:");
      for (const point of output.executive_summary) {
        parts.push(`- ${point}`);
      }
    }
    if ("recommendations" in output && Array.isArray(output.recommendations)) {
      parts.push("Recommendations:");
      for (const rec of output.recommendations) {
        parts.push(`- ${rec}`);
      }
    }
    parts.push("");
  }

  return parts.join("\n");
}

function formatFieldName(field: string): string {
  return field
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function estimateTokens(text: string): number {
  // Rough heuristic: ~4 characters per token
  return Math.ceil(text.length / 4);
}
