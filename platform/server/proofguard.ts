/**
 * ProofGuard Governance Middleware — TypeScript Implementation
 *
 * Mirrors the Python ProofGuardMiddleware contract from LaunchOpsPro/core/proofguard.py
 * but runs natively in the Node.js execution engine.
 *
 * Flow:
 *   agent.propose → proofguard.attestAction() → [HITL if required] → agent.execute
 *
 * Design decisions:
 *   - Fail-closed: if attestation fails, action is BLOCKED (no fail-open escape hatch)
 *   - CQS scoring is computed locally based on agent risk profile + context
 *   - HITL decisions are stored in-memory with DB persistence for audit
 *   - SSE events emitted for real-time governance visibility
 *
 * Status constants match the Python middleware exactly:
 *   APPROVED | BLOCKED | REJECTED | REQUIRES_HITL
 */

import crypto from "crypto";
import * as db from "./db";

// ─── Types ────────────────────────────────────────────────────────────────

export type ProofGuardStatus = "APPROVED" | "BLOCKED" | "REJECTED" | "REQUIRES_HITL";

export interface AttestationRequest {
  agentId: string;
  agentName: string;
  pipelineStage: string;
  action: string;
  actionJson: Record<string, unknown>;
  riskTier: "low" | "medium" | "high" | "critical";
  imdaPillar?: string;
  enforceHitl?: boolean;
}

export interface AttestationResult {
  status: ProofGuardStatus;
  cqsScore: number;
  attestationId: string;
  flagged: boolean;
  guardrailsTriggered: string[];
  reason: string;
  riskTier: string;
  timestamp: number;
}

export interface HITLDecision {
  attestationId: string;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  reason?: string;
  decidedAt?: number;
  createdAt: number;
}

// ─── Risk Scoring Matrix ──────────────────────────────────────────────────

/**
 * CQS (Cognitive Quality Score) computation based on:
 *   - Agent risk tier (low=90, medium=70, high=50, critical=30 base)
 *   - Context completeness bonus (+0-10)
 *   - Credential coverage bonus (+0-10)
 *   - Prior execution success rate bonus (+0-10)
 */
const RISK_BASE_SCORES: Record<string, number> = {
  low: 90,
  medium: 70,
  high: 50,
  critical: 30,
};

// Agents that handle money, legal, or infrastructure get elevated scrutiny
const HIGH_RISK_AGENTS = new Set([
  "stripe-integration",
  "formation-advisor",
  "paperwork-ip",
  "security-hardening",
  "funding-intelligence",
  "paralegal-bot",
]);

// Agents that require HITL by default (payments, legal formation)
const HITL_REQUIRED_AGENTS = new Set([
  "stripe-integration",
  "formation-advisor",
  "paralegal-bot",
]);

// IMDA Model Governance Framework pillars
const IMDA_PILLARS = [
  "Internal Governance",
  "Determining AI Decision",
  "Operations Management",
  "Stakeholder Interaction & Communication",
] as const;

// Guardrail rules
interface GuardrailRule {
  id: string;
  name: string;
  check: (req: AttestationRequest) => boolean;
  severity: "warn" | "block";
}

const GUARDRAIL_RULES: GuardrailRule[] = [
  {
    id: "GR-001",
    name: "Financial action without credentials",
    check: (req) =>
      req.agentId === "stripe-integration" &&
      (!req.actionJson.credentials || Object.keys(req.actionJson.credentials as Record<string, unknown>).length === 0),
    severity: "warn",
  },
  {
    id: "GR-002",
    name: "Critical risk tier requires HITL",
    check: (req) => req.riskTier === "critical",
    severity: "block",
  },
  {
    id: "GR-003",
    name: "Legal/formation action flagged for review",
    check: (req) =>
      ["formation-advisor", "paperwork-ip", "paralegal-bot"].includes(req.agentId),
    severity: "warn",
  },
  {
    id: "GR-004",
    name: "Infrastructure modification requires audit",
    check: (req) =>
      ["security-hardening", "repo-scaffolding", "wordpress-setup"].includes(req.agentId),
    severity: "warn",
  },
];

// ─── In-Memory Attestation Store ──────────────────────────────────────────

const attestations = new Map<string, AttestationResult>();
const hitlDecisions = new Map<string, HITLDecision>();

// ─── ProofGuard Middleware ────────────────────────────────────────────────

export class ProofGuard {
  private hitlEnabled: boolean;
  private hitlTimeout: number;
  private pollInterval: number;

  constructor(options?: {
    hitlEnabled?: boolean;
    hitlTimeout?: number;
    pollInterval?: number;
  }) {
    this.hitlEnabled = options?.hitlEnabled ?? 
      (process.env.ENABLE_HUMAN_APPROVAL?.toLowerCase() === "true");
    this.hitlTimeout = options?.hitlTimeout ?? 
      parseInt(process.env.PROOFGUARD_HITL_TIMEOUT ?? "3600");
    this.pollInterval = options?.pollInterval ?? 
      parseInt(process.env.PROOFGUARD_POLL_INTERVAL ?? "5");
  }

  /**
   * Attest an agent action before execution.
   * Returns CQS score, status, and any triggered guardrails.
   */
  async attestAction(request: AttestationRequest): Promise<AttestationResult> {
    const attestationId = `att_${crypto.randomBytes(8).toString("hex")}`;
    const timestamp = Date.now();

    // Compute CQS score
    const cqsScore = this.computeCQS(request);

    // Run guardrail checks
    const triggeredRules = GUARDRAIL_RULES.filter((rule) => rule.check(request));
    const guardrailsTriggered = triggeredRules.map((r) => r.id);
    const hasBlockingRule = triggeredRules.some((r) => r.severity === "block");

    // Determine status
    let status: ProofGuardStatus;
    let reason: string;

    if (hasBlockingRule) {
      status = "BLOCKED";
      reason = `Blocked by guardrail(s): ${triggeredRules.filter((r) => r.severity === "block").map((r) => r.name).join(", ")}`;
    } else if (
      this.hitlEnabled ||
      request.enforceHitl ||
      HITL_REQUIRED_AGENTS.has(request.agentId) ||
      cqsScore < 40
    ) {
      status = "REQUIRES_HITL";
      reason = HITL_REQUIRED_AGENTS.has(request.agentId)
        ? `Agent ${request.agentName} requires human approval for ${request.riskTier}-risk actions`
        : cqsScore < 40
          ? `CQS score ${cqsScore} below threshold (40) — human review required`
          : "Human approval enforced by policy";
    } else if (cqsScore >= 70) {
      status = "APPROVED";
      reason = `CQS ${cqsScore} — auto-approved (threshold: 70)`;
    } else {
      // Score 40-69: approved with warnings
      status = "APPROVED";
      reason = `CQS ${cqsScore} — approved with advisory${guardrailsTriggered.length > 0 ? ` (${guardrailsTriggered.length} guardrail(s) flagged)` : ""}`;
    }

    const flagged = guardrailsTriggered.length > 0 || cqsScore < 60;

    const result: AttestationResult = {
      status,
      cqsScore,
      attestationId,
      flagged,
      guardrailsTriggered,
      reason,
      riskTier: request.riskTier,
      timestamp,
    };

    // Store attestation in-memory
    attestations.set(attestationId, result);

    // Persist to database (immutable audit trail)
    db.persistAttestation({
      attestationId,
      executionId: (request.actionJson.executionId as number) ?? null,
      stepId: (request.actionJson.stepId as number) ?? null,
      agentId: request.agentId,
      agentLabel: request.agentName,
      cqsScore,
      riskTier: request.riskTier,
      status,
      reason,
      flagged,
      guardrailsTriggered: guardrailsTriggered.length > 0 ? guardrailsTriggered : null,
      hitlDecision: status === "REQUIRES_HITL" ? "pending" : null,
    });

    // If HITL required, create a pending decision
    if (status === "REQUIRES_HITL") {
      hitlDecisions.set(attestationId, {
        attestationId,
        status: "pending",
        createdAt: timestamp,
      });
    }

    console.log(
      `[ProofGuard] attestation=${attestationId} agent=${request.agentId} status=${status} cqs=${cqsScore} flagged=${flagged}`
    );

    return result;
  }

  /**
   * Wait for a HITL decision (polling-based).
   * Returns true if approved, throws if rejected or timed out.
   */
  async waitForHITL(attestationId: string): Promise<boolean> {
    const startTime = Date.now();
    const timeoutMs = this.hitlTimeout * 1000;

    while (Date.now() - startTime < timeoutMs) {
      const decision = hitlDecisions.get(attestationId);
      if (!decision) throw new Error(`No HITL decision found for ${attestationId}`);

      if (decision.status === "approved") {
        console.log(`[ProofGuard] HITL approved: ${attestationId}`);
        return true;
      }
      if (decision.status === "rejected") {
        throw new Error(
          `HITL rejected: ${decision.reason ?? "Human operator rejected this execution intent"}`
        );
      }

      // Still pending — wait
      await new Promise((resolve) => setTimeout(resolve, this.pollInterval * 1000));
    }

    throw new Error(`HITL timeout after ${this.hitlTimeout}s for attestation ${attestationId}`);
  }

  /**
   * Record execution result for audit trail.
   */
  recordExecution(
    attestationId: string,
    result: Record<string, unknown>,
    success: boolean,
    proofHash?: string
  ): void {
    const attestation = attestations.get(attestationId);
    if (attestation) {
      ((attestation as unknown) as Record<string, unknown>).executionResult = {
        success,
        completedAt: Date.now(),
        resultSummary: result.summary ?? "No summary",
        proofHash,
      };
    }

    // Persist execution result + proof hash to DB
    const summary = typeof result.summary === "string" ? result.summary : JSON.stringify(result).slice(0, 500);
    db.updateAttestationResult(attestationId, success, summary, proofHash);
  }

  /**
   * Compute CQS (Cognitive Quality Score) for an attestation request.
   */
  private computeCQS(request: AttestationRequest): number {
    let score = RISK_BASE_SCORES[request.riskTier] ?? 70;

    // Adjust for high-risk agents
    if (HIGH_RISK_AGENTS.has(request.agentId)) {
      score -= 15;
    }

    // Context completeness bonus
    const contextKeys = Object.keys(request.actionJson);
    if (contextKeys.length > 3) score += 5;
    if (contextKeys.length > 6) score += 5;

    // Credential presence bonus
    if (request.actionJson.credentials && 
        Object.keys(request.actionJson.credentials as Record<string, unknown>).length > 0) {
      score += 10;
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
  }

  // ─── Static accessors for Express routes ────────────────────────────────

  static getAttestation(attestationId: string): AttestationResult | undefined {
    return attestations.get(attestationId);
  }

  static getHITLDecision(attestationId: string): HITLDecision | undefined {
    return hitlDecisions.get(attestationId);
  }

  static approveHITL(attestationId: string, decidedBy?: string, reason?: string): boolean {
    const decision = hitlDecisions.get(attestationId);
    if (!decision || decision.status !== "pending") return false;

    decision.status = "approved";
    decision.decidedBy = decidedBy ?? "owner";
    decision.reason = reason ?? "Approved by human operator";
    decision.decidedAt = Date.now();

    // Also update the attestation status
    const attestation = attestations.get(attestationId);
    if (attestation) {
      attestation.status = "APPROVED";
      attestation.reason = `HITL approved by ${decision.decidedBy}: ${decision.reason}`;
    }

    // Persist HITL decision to DB
    db.updateAttestationHITL(attestationId, "approved", decision.decidedBy!, decision.reason);

    console.log(`[ProofGuard] HITL decision: APPROVED for ${attestationId} by ${decision.decidedBy}`);
    return true;
  }

  static rejectHITL(attestationId: string, decidedBy?: string, reason?: string): boolean {
    const decision = hitlDecisions.get(attestationId);
    if (!decision || decision.status !== "pending") return false;

    decision.status = "rejected";
    decision.decidedBy = decidedBy ?? "owner";
    decision.reason = reason ?? "Rejected by human operator";
    decision.decidedAt = Date.now();

    const attestation = attestations.get(attestationId);
    if (attestation) {
      attestation.status = "REJECTED";
      attestation.reason = `HITL rejected by ${decision.decidedBy}: ${decision.reason}`;
    }

    // Persist HITL decision to DB
    db.updateAttestationHITL(attestationId, "rejected", decision.decidedBy!, decision.reason);

    console.log(`[ProofGuard] HITL decision: REJECTED for ${attestationId} by ${decision.decidedBy}`);
    return true;
  }

  static listPendingHITL(): HITLDecision[] {
    return Array.from(hitlDecisions.values()).filter((d) => d.status === "pending");
  }

  static listAllAttestations(): AttestationResult[] {
    return Array.from(attestations.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  static getStats(): {
    total: number;
    approved: number;
    blocked: number;
    rejected: number;
    pendingHitl: number;
    avgCqs: number;
  } {
    const all = Array.from(attestations.values());
    const approved = all.filter((a) => a.status === "APPROVED").length;
    const blocked = all.filter((a) => a.status === "BLOCKED").length;
    const rejected = all.filter((a) => a.status === "REJECTED").length;
    const pendingHitl = all.filter((a) => a.status === "REQUIRES_HITL").length;
    const avgCqs = all.length > 0 ? Math.round(all.reduce((s, a) => s + a.cqsScore, 0) / all.length) : 0;

    return { total: all.length, approved, blocked, rejected, pendingHitl, avgCqs };
  }
}

// ─── Default singleton ────────────────────────────────────────────────────

export const proofguard = new ProofGuard();
