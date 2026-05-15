/**
 * LaunchOps Bridge — Export Endpoint for LaunchOpsPro Platform
 *
 * This file should be integrated into the LaunchOpsPro platform/server directory.
 * It adds a new API route that exports execution results as Action Manifests.
 *
 * Integration: Add to platform/server/routes.ts or similar routing file.
 */

import { Hono } from "hono";
import { db } from "../db";
import { executions, workflows, workflowSteps } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Bridge configuration
const BRIDGE_URL = process.env.BRIDGE_URL || "http://localhost:8002";
const BRIDGE_WEBHOOK_URL = `${BRIDGE_URL}/api/bridge/webhook`;

export const bridgeRoutes = new Hono();

/**
 * Agent ID mapping from LaunchOpsPro to Founder Edition
 */
const AGENT_ID_MAP: Record<string, string> = {
  "security-agent": "security-agent",
  "paralegal": "paralegal",
  "paperwork-agent": "paperwork-agent",
  "formation-advisor": "formation-advisor",
  "stripe-agent": "stripe-agent",
  "wordpress-agent": "wordpress-agent",
  "mautic-agent": "mautic-agent",
  "support-agent": "support-agent",
  "files-agent": "files-agent",
  "project-agent": "project-agent",
  "analytics-agent": "analytics-agent",
  "growth-agent": "growth-agent",
  "email-agent": "email-agent",
  "repo-agent": "repo-agent",
  "business-builder": "business-builder",
  "funding-intelligence": "funding-intelligence",
  "execai-coach": "execai-coach",
  "documentary-tracker": "documentary-tracker",
  "content-engine": "content-engine",
  "dynexecutiv": "dynexecutiv",
  "founder-os": "founder-os",
  "metrics-agent": "metrics-agent",
  // New bridge agents
  "compliance-agent": "compliance-agent",
  "brand-identity-agent": "brand-identity-agent",
  "product-mvp-agent": "product-mvp-agent",
  "hiring-agent": "hiring-agent",
  "financial-modeling-agent": "financial-modeling-agent",
  "operations-sop-agent": "operations-sop-agent",
  "ip-patent-agent": "ip-patent-agent",
  "customer-success-agent": "customer-success-agent",
};

/**
 * GET /api/bridge/export/:executionId
 *
 * Generate an Action Manifest from a completed (or in-progress) execution.
 */
bridgeRoutes.get("/export/:executionId", async (c) => {
  const executionId = c.req.param("executionId");

  try {
    // Fetch execution data
    const [execution] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, parseInt(executionId)))
      .limit(1);

    if (!execution) {
      return c.json({ error: "Execution not found" }, 404);
    }

    // Fetch workflow steps
    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, execution.workflowId))
      .orderBy(workflowSteps.sortOrder);

    // Build the Action Manifest
    const manifest = buildManifest(execution, steps);

    return c.json(manifest);
  } catch (error: any) {
    console.error("Export failed:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/bridge/export/:executionId/send
 *
 * Generate a manifest AND send it to the Founder Edition bridge service.
 */
bridgeRoutes.post("/export/:executionId/send", async (c) => {
  const executionId = c.req.param("executionId");

  try {
    const [execution] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, parseInt(executionId)))
      .limit(1);

    if (!execution) {
      return c.json({ error: "Execution not found" }, 404);
    }

    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.workflowId, execution.workflowId))
      .orderBy(workflowSteps.sortOrder);

    const manifest = buildManifest(execution, steps);

    // Send to Founder Edition bridge
    const response = await fetch(BRIDGE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manifest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return c.json(
        { error: `Bridge rejected manifest: ${errorText}` },
        502
      );
    }

    const bridgeResponse = await response.json();

    return c.json({
      status: "sent",
      manifest_id: manifest.manifest_id,
      bridge_response: bridgeResponse,
      actions_count: manifest.actions.length,
    });
  } catch (error: any) {
    console.error("Export+Send failed:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/bridge/callback
 *
 * Receive execution results from Founder Edition.
 * Updates the execution record with results.
 */
bridgeRoutes.post("/callback", async (c) => {
  const body = await c.req.json();

  console.log(
    `[Bridge Callback] Received results for manifest ${body.manifest_id}: status=${body.status}`
  );

  // Store the callback result (could update execution record)
  // For now, log and acknowledge
  return c.json({ status: "received", timestamp: new Date().toISOString() });
});

/**
 * Build an Action Manifest from execution data and workflow steps.
 */
function buildManifest(execution: any, steps: any[]): any {
  const manifestId = randomUUID();
  const callbackUrl = `${process.env.APP_URL || "http://localhost:3000"}/api/bridge/callback`;

  // Extract context chain from execution results
  const results = execution.results
    ? typeof execution.results === "string"
      ? JSON.parse(execution.results)
      : execution.results
    : {};
  const contextChain = results.contextChain || results.context || {};

  // Build actions from steps
  const actions = steps.map((step: any, index: number) => {
    const agentId = AGENT_ID_MAP[step.agentId] || step.agentId;
    const config =
      typeof step.config === "string"
        ? JSON.parse(step.config || "{}")
        : step.config || {};

    return {
      action_id: `action_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      sort_order: step.sortOrder ?? index,
      agent_id: agentId,
      method: config._method || null,
      label: step.label || `Step ${index + 1}`,
      description: step.description || "",
      execution_mode: "hybrid",
      priority: determinePriority(agentId, index, steps.length),
      config: config,
      context: {},
      inputs: step.inputs || {},
      expected_outputs: [],
      dependencies: index > 0 ? [actions[index - 1]?.action_id].filter(Boolean) : [],
      timeout_seconds: 300,
      retry_policy: { max_retries: 2, backoff_seconds: 5 },
    };
  });

  return {
    manifest_id: manifestId,
    version: "1.0.0",
    created_at: new Date().toISOString(),
    source: {
      system: "launchops-pro",
      execution_id: String(execution.id),
      workflow_id: String(execution.workflowId || ""),
      workflow_name: execution.workflowName || "LaunchOps Pipeline",
    },
    business_context: {
      business_name: contextChain.business_name || "Business",
      business_type: contextChain.business_type || "saas",
      industry: contextChain.industry || null,
      goal: contextChain.goal || "Launch business",
      constraints: {},
      accumulated_context: contextChain,
    },
    actions: actions,
    execution_config: {
      mode: "sequential",
      halt_on_failure: true,
      callback_url: callbackUrl,
      timeout_seconds: 3600,
      dry_run: false,
    },
    metadata: {
      user_id: String(execution.userId || ""),
      proof_hashes: execution.proofHashes || [],
      tags: [],
    },
  };
}

function determinePriority(
  agentId: string,
  index: number,
  total: number
): string {
  const critical = ["security-agent", "formation-advisor", "paperwork-agent"];
  const high = ["stripe-agent", "repo-agent", "funding-intelligence"];

  if (critical.includes(agentId)) return "critical";
  if (high.includes(agentId)) return "high";
  if (index < total * 0.3) return "high";
  return "medium";
}

export default bridgeRoutes;
