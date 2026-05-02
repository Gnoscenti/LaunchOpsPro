import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Atlas Orchestrator Tables ───────────────────────────────────────────

/**
 * Workflow definitions — the blueprint for an orchestration pipeline.
 * Each workflow is a named, versioned collection of steps.
 */
export const workflows = mysqlTable("workflows", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  version: varchar("version", { length: 32 }).default("1.0").notNull(),
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft").notNull(),
  /** Whether this workflow was cloned from a template */
  templateId: int("templateId"),
  /** JSON metadata: tags, category, icon, color, etc. */
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

/**
 * Workflow steps — individual nodes in the workflow graph.
 * Each step maps to an agent and has position data for the canvas.
 */
export const workflowSteps = mysqlTable("workflow_steps", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: int("workflowId").notNull(),
  /** Agent identifier (e.g., "business-builder", "paperwork-agent") */
  agentId: varchar("agentId", { length: 128 }).notNull(),
  /** Display label on the canvas */
  label: varchar("label", { length: 255 }).notNull(),
  /** Step description */
  description: text("description"),
  /** Execution order within the workflow */
  sortOrder: int("sortOrder").default(0).notNull(),
  /** Canvas position: { x, y } */
  position: json("position"),
  /** Step configuration: timeout, retries, params, etc. */
  config: json("config"),
  /** IDs of steps this step depends on (JSON array of step IDs) */
  dependencies: json("dependencies"),
  /** Proof-of-agent verification status */
  proofStatus: mysqlEnum("proofStatus", ["unverified", "proving", "verified", "failed"])
    .default("unverified")
    .notNull(),
  /** Proof hash — cryptographic proof of execution */
  proofHash: varchar("proofHash", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = typeof workflowSteps.$inferInsert;

/**
 * Workflow executions — a run of a workflow.
 * Tracks overall status, timing, and results.
 */
export const executions = mysqlTable("executions", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: int("workflowId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"])
    .default("pending")
    .notNull(),
  /** Which step is currently executing */
  currentStepId: int("currentStepId"),
  /** Total steps in this execution */
  totalSteps: int("totalSteps").default(0).notNull(),
  /** Steps completed so far */
  completedSteps: int("completedSteps").default(0).notNull(),
  /** Execution results summary */
  results: json("results"),
  /** Error details if failed */
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Execution = typeof executions.$inferSelect;
export type InsertExecution = typeof executions.$inferInsert;

/**
 * Step executions — individual step run within a workflow execution.
 * Tracks per-step status, output, timing, and proof verification.
 */
export const stepExecutions = mysqlTable("step_executions", {
  id: int("id").autoincrement().primaryKey(),
  executionId: int("executionId").notNull(),
  stepId: int("stepId").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"])
    .default("pending")
    .notNull(),
  /** Agent output */
  output: json("output"),
  /** Error details if failed */
  errorMessage: text("errorMessage"),
  /** Proof-of-agent verification */
  proofStatus: mysqlEnum("proofStatus", ["unverified", "proving", "verified", "failed"])
    .default("unverified")
    .notNull(),
  proofHash: varchar("proofHash", { length: 128 }),
  /** Retry count */
  retryCount: int("retryCount").default(0).notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StepExecution = typeof stepExecutions.$inferSelect;
export type InsertStepExecution = typeof stepExecutions.$inferInsert;

/**
 * Workflow templates — pre-built workflow blueprints that users can clone.
 * Templates are system-level (no userId) and immutable.
 */
export const workflowTemplates = mysqlTable("workflow_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }).notNull(),
  /** Icon name from lucide-react */
  icon: varchar("icon", { length: 64 }),
  /** Difficulty/complexity level */
  complexity: mysqlEnum("complexity", ["beginner", "intermediate", "advanced"]).default("intermediate").notNull(),
  /** Template definition: steps, connections, default configs */
  definition: json("definition"),
  /** Tags for filtering */
  tags: json("tags"),
  /** How many times this template has been cloned */
  cloneCount: int("cloneCount").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = typeof workflowTemplates.$inferInsert;

/**
 * Credential vault — encrypted key-value store for API keys, tokens, and secrets.
 * Credentials are scoped to a user and referenced by agents during execution.
 */
export const credentials = mysqlTable("credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Unique key name (e.g., "OPENAI_API_KEY", "STRIPE_SECRET") */
  keyName: varchar("keyName", { length: 128 }).notNull(),
  /** Encrypted value (encrypted at application layer before storage) */
  encryptedValue: text("encryptedValue").notNull(),
  /** Service this credential belongs to (e.g., "openai", "stripe", "github") */
  service: varchar("service", { length: 64 }),
  /** Human-readable description */
  description: text("description"),
  /** Last time this credential was used */
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Credential = typeof credentials.$inferSelect;
export type InsertCredential = typeof credentials.$inferInsert;

/**
 * Execution log — append-only audit trail for all orchestration events.
 * Every agent action, state transition, and system event is logged here.
 */
export const executionLogs = mysqlTable("execution_logs", {
  id: int("id").autoincrement().primaryKey(),
  executionId: int("executionId"),
  stepId: int("stepId"),
  level: mysqlEnum("level", ["debug", "info", "warn", "error"]).default("info").notNull(),
  /** Log message */
  message: text("message").notNull(),
  /** Structured metadata */
  metadata: json("metadata"),
  /** Timestamp of the event (milliseconds since epoch for precision) */
  eventTime: timestamp("eventTime").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExecutionLog = typeof executionLogs.$inferSelect;
export type InsertExecutionLog = typeof executionLogs.$inferInsert;

/**
 * ProofGuard attestations — immutable audit trail for every governance decision.
 * Every agent execution is attested with a CQS score, risk tier, and verdict.
 * HITL decisions are recorded with approver identity and reasoning.
 * This table is append-only and serves as legal/compliance evidence.
 */
export const proofguardAttestations = mysqlTable("proofguard_attestations", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique attestation identifier (att_xxxx) */
  attestationId: varchar("attestationId", { length: 64 }).notNull().unique(),
  /** Link to the execution */
  executionId: int("executionId"),
  /** Link to the step */
  stepId: int("stepId"),
  /** Agent that was attested */
  agentId: varchar("agentId", { length: 128 }).notNull(),
  /** Agent display label */
  agentLabel: varchar("agentLabel", { length: 255 }),
  /** Confidence-Quality Score (0-100) */
  cqsScore: int("cqsScore").notNull(),
  /** Risk tier classification */
  riskTier: mysqlEnum("riskTier", ["low", "medium", "high", "critical"]).notNull(),
  /** Governance verdict */
  status: mysqlEnum("status", ["APPROVED", "BLOCKED", "REQUIRES_HITL", "REJECTED"]).notNull(),
  /** Human-readable reason for the verdict */
  reason: text("reason").notNull(),
  /** Whether any guardrails were triggered */
  flagged: boolean("flagged").default(false).notNull(),
  /** JSON array of triggered guardrail IDs (e.g., ["GR-001", "GR-003"]) */
  guardrailsTriggered: json("guardrailsTriggered"),
  /** Execution result summary (populated after agent completes) */
  executionSuccess: boolean("executionSuccess"),
  executionCompletedAt: timestamp("executionCompletedAt"),
  resultSummary: text("resultSummary"),
  /** HITL decision fields (populated only when status = REQUIRES_HITL) */
  hitlDecision: mysqlEnum("hitlDecision", ["pending", "approved", "rejected"]),
  hitlDecidedBy: varchar("hitlDecidedBy", { length: 255 }),
  hitlDecidedAt: timestamp("hitlDecidedAt"),
  hitlReason: text("hitlReason"),
  /** Proof hash of the attested output */
  proofHash: varchar("proofHash", { length: 128 }),
  /** Timestamp of attestation (milliseconds since epoch for precision) */
  attestedAt: timestamp("attestedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProofguardAttestation = typeof proofguardAttestations.$inferSelect;
export type InsertProofguardAttestation = typeof proofguardAttestations.$inferInsert;
