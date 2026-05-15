/**
 * Atlas Orchestrator — Agent Registry v1
 *
 * Forward-looking agent definition system (designed to remain relevant through 2027+).
 *
 * Design principles:
 *   1. Declarative — agents are data, not code. New agents = new registry entries.
 *   2. Capability-tagged — steps declare what they need, the registry matches.
 *   3. Model-agnostic — each agent can specify preferred model families.
 *   4. Schema-aware — input/output schemas enable validation and context chaining.
 *   5. Versioned — agents carry semver so workflows can pin to known-good versions.
 *
 * The registry is the single source of truth for:
 *   - What agents exist and what they can do
 *   - How to prompt them (system prompt, output format)
 *   - What context they need and what artifacts they produce
 *   - Whether they have a Python implementation or use LLM execution
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type AgentCapability =
  | "strategy"
  | "legal"
  | "finance"
  | "marketing"
  | "devops"
  | "security"
  | "analytics"
  | "content"
  | "communication"
  | "automation"
  | "project-management"
  | "infrastructure"
  | "payment"
  | "crm"
  | "coaching"
  | "content_generation"
  | "seo"
  | "decision_making"
  | "scheduling"
  | "kpi_tracking";

export type ExecutionMode = "python" | "llm" | "hybrid";

export type OutputFormat = "json_object" | "json_schema" | "markdown" | "structured";

export type ModelPreference = "fast" | "balanced" | "deep-reasoning";

export interface AgentOutputSchema {
  /** Human-readable description of what this agent produces */
  description: string;
  /** JSON Schema for the output (used for json_schema response format) */
  jsonSchema?: Record<string, unknown>;
  /** Key fields the next agent in the chain should reference */
  chainableFields?: string[];
}

export interface AgentDefinition {
  /** Unique agent identifier — matches agentId in workflow_steps */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** What this agent does */
  description: string;
  /** Capability tags for matching and filtering */
  capabilities: AgentCapability[];
  /** How this agent executes */
  executionMode: ExecutionMode;
  /** System prompt for LLM execution */
  systemPrompt: string;
  /** Output format preference */
  outputFormat: OutputFormat;
  /** Structured output schema */
  outputSchema: AgentOutputSchema;
  /** What context fields this agent needs from prior steps */
  requiredContext?: string[];
  /** Secrets/credentials this agent needs */
  requiredSecrets?: string[];
  /** Model preference for LLM execution */
  modelPreference: ModelPreference;
  /** Whether this agent's output should be persisted as an artifact */
  persistArtifact: boolean;
  /** Artifact type for storage categorization */
  artifactType?: "report" | "config" | "plan" | "analysis" | "document";
  /** Tags for UI filtering and search */
  tags?: string[];
  /** Category for grouping in the UI */
  category: string;
  /** Icon name from lucide-react */
  icon?: string;
  /** Estimated execution time in seconds */
  estimatedDuration?: number;
  /** Extensible metadata for bridge-specific configuration */
  metadata?: {
    /** Whether this agent uses method dispatch instead of execute() */
    methodDispatch?: boolean;
    /** Available methods for method-dispatch agents */
    methods?: string[];
    /** Source repo/system this agent originates from */
    source?: string;
    /** Default method to invoke if none specified */
    defaultMethod?: string;
  };
}

// ─── Registry ───────────────────────────────────────────────────────────────

const registry: Map<string, AgentDefinition> = new Map();

/**
 * Register an agent definition. Overwrites if the same ID exists.
 */
export function registerAgent(agent: AgentDefinition): void {
  registry.set(agent.id, agent);
}

/**
 * Get an agent definition by ID.
 */
export function getAgent(id: string): AgentDefinition | undefined {
  return registry.get(id);
}

/**
 * List all registered agents.
 */
export function listAgents(): AgentDefinition[] {
  return Array.from(registry.values());
}

/**
 * Find agents by capability.
 */
export function findAgentsByCapability(capability: AgentCapability): AgentDefinition[] {
  return listAgents().filter((a) => a.capabilities.includes(capability));
}

/**
 * Find agents by category.
 */
export function findAgentsByCategory(category: string): AgentDefinition[] {
  return listAgents().filter((a) => a.category === category);
}

/**
 * Get the system prompt for an agent, with optional context injection.
 */
export function getAgentPrompt(
  agentId: string,
  contextSummary?: string
): string {
  const agent = registry.get(agentId);
  if (!agent) {
    return `You are an AI agent. Execute the requested task and return structured results.`;
  }

  let prompt = agent.systemPrompt;

  if (contextSummary && agent.requiredContext?.length) {
    prompt += `\n\n--- Prior Context ---\nThe following context has been accumulated from prior workflow steps. Use it to inform your analysis and ensure continuity:\n\n${contextSummary}`;
  }

  return prompt;
}

/**
 * Check if an agent has a Python implementation.
 */
export function hasPythonAgent(agentId: string): boolean {
  const agent = registry.get(agentId);
  return agent?.executionMode === "python" || agent?.executionMode === "hybrid";
}

/**
 * Get the response format configuration for an agent.
 */
export function getResponseFormat(agentId: string): { type: string; json_schema?: Record<string, unknown> } {
  const agent = registry.get(agentId);
  if (!agent) {
    return { type: "json_object" };
  }

  if (agent.outputFormat === "json_schema" && agent.outputSchema.jsonSchema) {
    return {
      type: "json_schema",
      json_schema: agent.outputSchema.jsonSchema,
    };
  }

  return { type: "json_object" };
}

// ─── Built-in Agent Definitions ─────────────────────────────────────────────

// Standard output schema for operational agents
const standardOutputSchema: AgentOutputSchema = {
  description: "Standard agent output with summary, actions, outputs, and recommendations",
  jsonSchema: {
    name: "step_output",
    strict: true,
    schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Brief summary of accomplishment" },
        actions: { type: "array", items: { type: "string" }, description: "Specific actions taken" },
        outputs: { type: "object", additionalProperties: false, properties: { data: { type: "string", description: "Generated artifacts as JSON string" } }, required: ["data"], description: "Generated artifacts" },
        recommendations: { type: "array", items: { type: "string" }, description: "Next steps" },
      },
      required: ["summary", "actions", "outputs", "recommendations"],
      additionalProperties: false,
    },
  },
  chainableFields: ["summary", "recommendations"],
};

// ─── Strategic Agents (LaunchOps) ───────────────────────────────────────────

registerAgent({
  id: "synthesis-agent",
  name: "Synthesis Agent",
  version: "1.0.0",
  description: "Investor-facing strategic analyst. Creates a seed-investor-ready synthesis in structured JSON.",
  capabilities: ["strategy", "finance", "content"],
  executionMode: "llm",
  modelPreference: "deep-reasoning",
  outputFormat: "json_object",
  persistArtifact: true,
  artifactType: "report",
  category: "strategic",
  icon: "FileText",
  estimatedDuration: 45,
  tags: ["investor", "synthesis", "pitch", "strategy"],
  requiredContext: [],
  requiredSecrets: [],
  outputSchema: {
    description: "Investor-ready synthesis with 12 structured sections",
    chainableFields: [
      "executive_summary",
      "wedge_and_icp",
      "business_model",
      "ninety_day_pilot",
      "differentiation",
    ],
  },
  systemPrompt: `You are the Synthesis Agent — an investor-facing strategic analyst operating in ${new Date().getFullYear()}.

Your job: Create an investor-friendly synthesis that a seed investor could skim in 3 minutes.

You must think forward. The businesses you analyze will operate in a world where:
- AI agents handle 40%+ of routine business operations
- Solo founders can run companies that previously required 10-person teams
- Trust infrastructure (audit logs, proof-of-execution) replaces traditional oversight
- Vertical SaaS is consolidating around AI-native platforms

Output as structured JSON with these sections:
1) executive_summary: array of 5 bullet strings
2) problem: current painful workflow description
3) solution: what ExecAI does + what it does NOT do
4) wedge_and_icp: tight and specific ideal customer profile
5) why_now: market timing rationale (reference current AI agent landscape)
6) differentiation: array of 3-5 differentiator strings
7) business_model: pilot → subscription pathway with specific pricing signals
8) ninety_day_pilot: { success_definition: string, kpis: string[] }
9) trust_stack: audit log + approvals description (on-chain optional later)
10) distribution: include course sidecar strategy if applicable
11) risks_and_mitigations: array of { risk: string, mitigation: string }
12) next_14_days: array of concrete action strings with owners

Constraints:
- Do not claim compliance certifications unless explicitly present in docs.
- Do not present on-chain/tokenization as required for the wedge pilot.
- Ground all claims in observable market data, not hype.
- Price anchors should reflect current SaaS market rates.`,
});

registerAgent({
  id: "seven-pillar-agent",
  name: "7-Pillar Execution Agent",
  version: "1.0.0",
  description: "Strategic execution planner. Generates a 7-pillar plan optimized for closing the first paid pilot.",
  capabilities: ["strategy", "project-management", "marketing"],
  executionMode: "llm",
  modelPreference: "deep-reasoning",
  outputFormat: "json_object",
  persistArtifact: true,
  artifactType: "plan",
  category: "strategic",
  icon: "Layers",
  estimatedDuration: 60,
  tags: ["execution", "pillars", "go-to-market", "strategy"],
  requiredContext: ["executive_summary", "wedge_and_icp", "business_model"],
  requiredSecrets: [],
  outputSchema: {
    description: "7-pillar execution plan with decisions, experiments, deliverables, and KPIs per pillar",
    chainableFields: ["pillars"],
  },
  systemPrompt: `You are the 7-Pillar Execution Agent — a strategic execution planner operating in ${new Date().getFullYear()}.

Using the business context (including any prior agent outputs in the context chain), generate a 7-pillar execution plan that is directly actionable.

Think forward: the execution landscape includes AI-native tools, agent-assisted workflows, and rapid validation cycles. Plans should leverage these realities.

Output as structured JSON with a "pillars" array. For each pillar include:
- pillar_name: string
- decisions: array of 1-3 decision strings (specific, not generic)
- assumptions: array of numbered assumption strings
- validation_experiments: array of { experiment: string, timebox: string, success_criteria: string }
- deliverables: array of exact filenames/artifacts to produce
- kpis: array of { metric: string, leading_indicator: string }
- owner_role: string (founder, eng, sales, etc)
- risks: array of { risk: string, mitigation: string }
- ai_leverage: string (how AI agents accelerate this pillar)

Pillars:
1) Business model selection & validation
2) Market research & niche identification
3) Product/service creation
4) Website & sales funnel development
5) Marketing & traffic generation strategy
6) Automation & systems setup
7) Scaling & optimization

Constraints:
- Optimize for closing 1 paid pilot fast, then converting to subscription.
- Every experiment must have a timebox ≤ 14 days.
- Deliverables must be concrete artifacts, not vague descriptions.
- Reference specific tools and platforms available in the current ecosystem.`,
});

registerAgent({
  id: "systems-agent",
  name: "LaunchOps Systems Agent",
  version: "1.0.0",
  description: "Systems architect for early-stage automation. Designs the minimal stack to close the first paid pilot.",
  capabilities: ["automation", "crm", "infrastructure", "project-management"],
  executionMode: "llm",
  modelPreference: "deep-reasoning",
  outputFormat: "json_object",
  persistArtifact: true,
  artifactType: "config",
  category: "strategic",
  icon: "Settings",
  estimatedDuration: 45,
  tags: ["systems", "automation", "crm", "pipeline", "sprint"],
  requiredContext: ["executive_summary", "pillars", "business_model"],
  requiredSecrets: [],
  outputSchema: {
    description: "Complete systems design: CRM pipeline, automation tasks, dashboards, audit log, stack, and sprint plan",
    chainableFields: ["crm_pipeline", "minimal_stack", "two_week_sprint"],
  },
  systemPrompt: `You are the LaunchOps Systems Agent — a systems architect for early-stage automation, operating in ${new Date().getFullYear()}.

Design the automation + systems required to close the first paid pilot and run it cleanly.

Think forward: modern stacks leverage AI agents for CRM automation, content generation, and pipeline management. Design for a world where the founder has AI co-pilots for every function.

Output as structured JSON with:
- crm_pipeline: array of { stage_name: string, entry_criteria: string, exit_criteria: string, automated_actions: string[] }
- automated_tasks: array of { stage: string, trigger: string, action: string, tool: string }
- dashboards: { sales: string[], pilot_kpi: string[], ai_metrics: string[] }
- audit_log_checklist: array of { item: string, storage_location: string, retention_period: string }
- minimal_stack: array of { tool: string, purpose: string, rationale: string, monthly_cost: string }
- two_week_sprint: array of { day: string, deliverable: string, owner: string, dependencies: string[] }
- integration_map: array of { source: string, destination: string, data_flow: string, method: string }

Constraints:
- Keep it lean — optimize for speed to first paid pilot.
- Total monthly stack cost should be under $200 for the first 90 days.
- Every tool must justify its existence with a specific use case.
- Include AI-native alternatives where they outperform traditional tools.`,
});

// ─── Operational Agents ─────────────────────────────────────────────────────

registerAgent({
  id: "business-builder",
  name: "Business Strategy Agent",
  version: "2.0.0",
  description: "Full-stack business planning: build spec intake, business model canvas, go-to-market, competitive analysis, pricing strategy, operational plan, and KPI dashboard.",
  capabilities: ["strategy", "finance", "analytics"],
  executionMode: "hybrid",
  modelPreference: "balanced",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "analysis",
  category: "business",
  icon: "Building",
  estimatedDuration: 30,
  tags: ["business-model", "canvas", "strategy", "go-to-market", "pricing"],
  outputSchema: {
    description: "Structured business planning output with completeness scoring",
    jsonSchema: {
      name: "step_output",
      strict: true,
      schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Brief summary of accomplishment" },
          actions: { type: "array", items: { type: "string" }, description: "Specific actions taken" },
          outputs: { type: "object", additionalProperties: false, properties: { data: { type: "string", description: "Generated artifacts as JSON string" } }, required: ["data"], description: "Generated artifacts" },
          recommendations: { type: "array", items: { type: "string" }, description: "Next steps" },
        },
        required: ["summary", "actions", "outputs", "recommendations"],
        additionalProperties: false,
      },
    },
    chainableFields: ["build_spec", "completeness", "business_model", "pricing"],
  },
  metadata: {
    methodDispatch: true,
    methods: ["build_spec_intake", "business_model_canvas", "go_to_market", "competitive_analysis", "pricing_strategy", "operational_plan", "kpi_dashboard"],
    source: "launchops-founder-edition",
    defaultMethod: "build_spec_intake",
  },
  systemPrompt:
    "You are a business strategy agent. Analyze the business requirements and produce a structured business model canvas with value proposition, customer segments, revenue streams, and key activities. Think in terms of AI-native business models where solo founders leverage agent workflows.",
});

registerAgent({
  id: "formation-advisor",
  name: "Legal Formation Advisor",
  version: "1.0.0",
  description: "Recommends optimal business entity type, state of incorporation, and key formation steps.",
  capabilities: ["legal"],
  executionMode: "hybrid",
  modelPreference: "balanced",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "legal",
  icon: "Scale",
  estimatedDuration: 25,
  tags: ["legal", "formation", "entity", "incorporation"],
  requiredSecrets: [],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a legal formation advisor. Recommend the optimal business entity type, state of incorporation, and key formation steps. Consider funding qualification requirements, IP protection, and tax optimization for AI-native businesses.",
});

registerAgent({
  id: "paperwork-agent",
  name: "Legal Document Generator",
  version: "1.0.0",
  description: "Drafts key legal documents needed for business formation.",
  capabilities: ["legal"],
  executionMode: "hybrid",
  modelPreference: "balanced",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "legal",
  icon: "FileText",
  estimatedDuration: 30,
  tags: ["legal", "documents", "operating-agreement", "nda"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a legal document generation agent. Draft the key legal documents needed for business formation: Operating Agreement, IP Assignment, NDA template. Include AI-specific clauses for data usage and model output ownership.",
});

registerAgent({
  id: "funding-intelligence",
  name: "Funding Intelligence Agent",
  version: "2.0.0",
  description: "Comprehensive funding analysis: readiness reports, formation optimization, SBIR eligibility, VC readiness checks, and grant search across all non-dilutive and equity avenues.",
  capabilities: ["finance", "strategy", "legal"],
  executionMode: "hybrid",
  modelPreference: "deep-reasoning",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "report",
  category: "finance",
  icon: "DollarSign",
  estimatedDuration: 35,
  tags: ["funding", "grants", "investors", "financing", "sbir", "vc", "formation"],
  requiredContext: ["executive_summary", "business_model"],
  outputSchema: {
    description: "Funding readiness report with eligible avenues, roadmap, formation advice, and immediate actions",
    chainableFields: ["eligible_avenues", "funding_roadmap", "formation_details", "immediate_actions"],
  },
  metadata: {
    methodDispatch: true,
    methods: ["readiness_report", "formation_optimizer", "sbir_eligibility", "vc_readiness", "grant_search"],
    source: "launchops-founder-edition",
    defaultMethod: "readiness_report",
  },
  systemPrompt:
    "You are a funding strategy agent. Analyze the business profile and recommend optimal funding pathways: grants, SBIR/STTR, angel investors, VC, and revenue-based financing. Include AI-specific funding sources and accelerators.",
});

registerAgent({
  id: "execai-coach",
  name: "ExecAI Executive Coach",
  version: "2.0.0",
  description: "Harvard-trained executive coach with strategic review, entity advice, funding planning, IP strategy, decision support, and full coaching sessions using proven frameworks.",
  capabilities: ["coaching", "strategy", "decision_making"],
  executionMode: "hybrid",
  modelPreference: "deep-reasoning",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "analysis",
  category: "coaching",
  icon: "GraduationCap",
  estimatedDuration: 30,
  tags: ["coaching", "strategy", "frameworks", "executive", "ip", "entity"],
  outputSchema: {
    description: "Coaching output with strategic analysis, frameworks applied, and actionable recommendations",
    chainableFields: ["analysis", "frameworks", "recommendations", "next_steps"],
  },
  metadata: {
    methodDispatch: true,
    methods: ["strategic_review", "entity_advice", "funding_plan", "ip_strategy", "ask", "weekly_review", "decision_support", "full_coaching_session"],
    source: "launchops-founder-edition",
    defaultMethod: "strategic_review",
  },
  systemPrompt:
    "You are a Harvard-trained executive coach. Provide strategic coaching on the current business stage using frameworks like Porter's Five Forces, Blue Ocean Strategy, and Jobs-to-be-Done. Adapt frameworks for AI-native business models.",
});

registerAgent({
  id: "security-agent",
  name: "Cybersecurity Agent",
  version: "1.0.0",
  description: "Sets up security infrastructure: SSL, firewall, vault, and audit checklist.",
  capabilities: ["security", "infrastructure"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "config",
  category: "infrastructure",
  icon: "Shield",
  estimatedDuration: 40,
  tags: ["security", "ssl", "firewall", "vault"],
  requiredSecrets: ["SERVER_IP", "SSH_KEY"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a cybersecurity agent. Set up security infrastructure: SSL certificates, firewall rules, Bitwarden vault, and security audit checklist. Include AI-specific security considerations like model access control and data pipeline security.",
});

registerAgent({
  id: "wordpress-agent",
  name: "WordPress Deployment Agent",
  version: "1.0.0",
  description: "Configures WordPress with WooCommerce, essential plugins, and a professional theme.",
  capabilities: ["infrastructure"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "config",
  category: "infrastructure",
  icon: "Globe",
  estimatedDuration: 60,
  tags: ["wordpress", "woocommerce", "website"],
  requiredSecrets: ["WP_ADMIN_PASSWORD", "DB_PASSWORD"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a WordPress deployment agent. Configure WordPress with WooCommerce, essential plugins, and a professional theme. Output the deployment configuration.",
});

registerAgent({
  id: "stripe-agent",
  name: "Payment Processing Agent",
  version: "1.0.0",
  description: "Sets up Stripe integration with products, pricing, and checkout flows.",
  capabilities: ["payment"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "config",
  category: "payment",
  icon: "CreditCard",
  estimatedDuration: 30,
  tags: ["stripe", "payments", "checkout", "subscriptions"],
  requiredSecrets: ["STRIPE_SECRET_KEY"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a payment processing agent. Set up Stripe integration with products, pricing, and checkout flows. Include subscription billing for SaaS models.",
});

registerAgent({
  id: "mautic-agent",
  name: "Marketing Automation Agent",
  version: "1.0.0",
  description: "Configures Mautic for email campaigns, lead scoring, and automated sequences.",
  capabilities: ["marketing", "automation"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: false,
  category: "marketing",
  icon: "Mail",
  estimatedDuration: 35,
  tags: ["mautic", "email", "campaigns", "lead-scoring"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a marketing automation agent. Configure Mautic for email campaigns, lead scoring, and automated sequences.",
});

registerAgent({
  id: "documentary-tracker",
  name: "Documentary Narrative Agent",
  version: "2.0.0",
  description: "Full documentary production system: milestone logging, AI moment capture, narrative generation, chapter creation, timeline reports, and documentary export.",
  capabilities: ["content", "content_generation"],
  executionMode: "hybrid",
  modelPreference: "balanced",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "content",
  icon: "Film",
  estimatedDuration: 20,
  tags: ["documentary", "narrative", "milestone", "timeline", "chapter"],
  requiredContext: ["summary"],
  outputSchema: {
    description: "Documentary entries with milestones, narratives, and timeline data",
    chainableFields: ["milestone", "narrative", "timeline", "chapter"],
  },
  metadata: {
    methodDispatch: true,
    methods: ["log_milestone", "log_ai_moment", "generate_narrative", "generate_chapter", "timeline_report", "export_documentary"],
    source: "launchops-founder-edition",
    defaultMethod: "log_milestone",
  },
  systemPrompt:
    "You are a documentary narrative agent. Log this milestone in the solopreneur journey and generate a narrative entry for the documentary. Capture the human story behind the technical progress.",
});

registerAgent({
  id: "analytics-agent",
  name: "Analytics Agent",
  version: "1.0.0",
  description: "Sets up Matomo analytics tracking, goals, and dashboards.",
  capabilities: ["analytics"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "config",
  category: "analytics",
  icon: "BarChart",
  estimatedDuration: 25,
  tags: ["analytics", "matomo", "tracking", "dashboard"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are an analytics agent. Set up Matomo analytics tracking, configure goals, and create the initial dashboard.",
});

registerAgent({
  id: "growth-agent",
  name: "Growth Strategy Agent",
  version: "1.0.0",
  description: "Develops go-to-market plan with customer acquisition channels and growth metrics.",
  capabilities: ["marketing", "strategy"],
  executionMode: "llm",
  modelPreference: "balanced",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "plan",
  category: "marketing",
  icon: "TrendingUp",
  estimatedDuration: 30,
  tags: ["growth", "go-to-market", "acquisition", "content-strategy"],
  requiredContext: ["wedge_and_icp", "business_model"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a growth strategy agent. Develop a go-to-market plan with customer acquisition channels, content strategy, and growth metrics. Leverage AI-powered distribution channels and community-led growth.",
});

registerAgent({
  id: "project-agent",
  name: "Project Management Agent",
  version: "1.0.0",
  description: "Sets up project tracking with milestones, sprints, and task assignments.",
  capabilities: ["project-management"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "plan",
  category: "operations",
  icon: "KanbanSquare",
  estimatedDuration: 20,
  tags: ["project", "milestones", "sprints", "tasks"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a project management agent. Set up project tracking with milestones, sprints, and task assignments.",
});

registerAgent({
  id: "repo-agent",
  name: "DevOps Agent",
  version: "1.0.0",
  description: "Configures GitHub repository with CI/CD pipeline, branch protection, and automated testing.",
  capabilities: ["devops", "infrastructure"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "config",
  category: "infrastructure",
  icon: "GitBranch",
  estimatedDuration: 30,
  tags: ["github", "ci-cd", "devops", "testing"],
  requiredSecrets: ["GITHUB_TOKEN"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a DevOps agent. Configure GitHub repository with CI/CD pipeline, branch protection, and automated testing.",
});

registerAgent({
  id: "support-agent",
  name: "Customer Support Agent",
  version: "1.0.0",
  description: "Sets up Chatwoot for customer communication with automated responses.",
  capabilities: ["communication"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: false,
  category: "communication",
  icon: "MessageSquare",
  estimatedDuration: 25,
  tags: ["support", "chatwoot", "chat", "automation"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a customer support agent. Set up Chatwoot for customer communication with automated responses and escalation rules.",
});

registerAgent({
  id: "email-agent",
  name: "Email Deliverability Agent",
  version: "1.0.0",
  description: "Configures email infrastructure: SPF, DKIM, DMARC, and warm-up sequences.",
  capabilities: ["communication", "infrastructure"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "config",
  category: "communication",
  icon: "Mail",
  estimatedDuration: 30,
  tags: ["email", "spf", "dkim", "dmarc", "deliverability"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are an email deliverability agent. Configure email infrastructure: SPF, DKIM, DMARC records, and warm-up sequences.",
});

registerAgent({
  id: "files-agent",
  name: "File Management Agent",
  version: "1.0.0",
  description: "Sets up Nextcloud for document storage and collaboration.",
  capabilities: ["infrastructure"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: false,
  category: "infrastructure",
  icon: "FolderOpen",
  estimatedDuration: 25,
  tags: ["files", "nextcloud", "storage", "collaboration"],
  outputSchema: standardOutputSchema,
  systemPrompt:
    "You are a file management agent. Set up Nextcloud for document storage and collaboration.",
});

// ─── Founder Edition Agents (from launchops-founder-edition) ───────────────

registerAgent({
  id: "content-engine",
  name: "Content Engine",
  version: "1.0.0",
  description:
    "Build-in-public content strategist. Generates 30-day content calendars across X, LinkedIn, and YouTube with UTM tracking, post templates, and YouTube Shorts scripts.",
  capabilities: ["content", "marketing", "content_generation", "seo"],
  executionMode: "python",
  modelPreference: "balanced",
  outputFormat: "json_object",
  persistArtifact: true,
  artifactType: "plan",
  category: "content",
  icon: "CalendarDays",
  estimatedDuration: 40,
  tags: ["content-calendar", "build-in-public", "youtube-shorts", "utm", "social-media"],
  requiredContext: ["business_model", "wedge_and_icp"],
  requiredSecrets: ["OPENAI_API_KEY"],
  metadata: {
    methodDispatch: true,
    methods: ["generate_blog", "generate_social", "generate_calendar", "generate_shorts"],
    source: "launchops-founder-edition",
    defaultMethod: "generate_calendar",
  },
  outputSchema: {
    description:
      "30-day content calendar with daily entries including platform, content type, hook, and UTM campaign. Also produces individual post fills and YouTube Shorts scripts.",
    chainableFields: ["content_calendar", "utm_campaigns"],
  },
  systemPrompt: `You are the Content Engine — a build-in-public content strategist operating in ${new Date().getFullYear()}.

Your job: Generate a 30-day content calendar that drives 1,000 new YouTube subscribers/week and 100 new course subscriptions/week.

Content mix per week:
  - 5x Build-in-public posts (daily, Mon-Fri)
  - 2x Proof posts (revenue screenshots, deployment wins)
  - 2x Breakdown posts (how the systems work)
  - 3x YouTube Shorts (Mon, Wed, Fri)
  - 1x LinkedIn long-form (Sunday)

Every post must include a UTM-tagged link back to the course.

Output as structured JSON with:
- content_calendar: array of 30 objects, each with: day, date, content_type, platforms, topic, hook, utm_campaign
- utm_campaigns: array of unique campaign names for tracking
- weekly_themes: array of 4 theme strings (one per week)
- estimated_reach: object with platform-level projections

Think forward: in ${new Date().getFullYear()}, short-form video dominates discovery, AI-generated thumbnails are standard, and founder narratives outperform polished brand content. Design accordingly.`,
});

registerAgent({
  id: "dynexecutiv-agent",
  name: "DynExecutiv Agent",
  version: "1.0.0",
  description:
    "Decision and coordination engine. Pulls live data from Stripe, CRM, and analytics to produce daily agendas, weekly executive briefs, and revenue-first prioritization with risk flags.",
  capabilities: ["strategy", "analytics", "finance", "decision_making"],
  executionMode: "hybrid",
  modelPreference: "deep-reasoning",
  outputFormat: "json_object",
  persistArtifact: true,
  artifactType: "report",
  category: "strategic",
  icon: "BrainCircuit",
  estimatedDuration: 50,
  tags: ["executive-brief", "daily-agenda", "revenue", "decision-engine", "stripe", "crm"],
  requiredContext: ["executive_summary", "pillars", "business_model"],
  requiredSecrets: ["STRIPE_SECRET_KEY", "SUITECRM_API_TOKEN"],
  metadata: {
    methodDispatch: true,
    methods: ["analyze_decision", "daily_brief", "weekly_brief", "prioritize"],
    source: "launchops-founder-edition",
    defaultMethod: "daily_brief",
  },
  outputSchema: {
    description:
      "Daily 'What Matters Now' agenda or weekly executive brief synthesizing Stripe revenue, CRM pipeline, and content metrics into prioritized directives.",
    chainableFields: ["daily_agenda", "weekly_brief", "risk_flags", "revenue_snapshot"],
  },
  systemPrompt: `You are DynExecutiv — the decision and coordination engine for a solo founder operating in ${new Date().getFullYear()}.

You synthesize live data from three sources:
1. Stripe: MRR, active subscriptions, weekly revenue, refunds
2. CRM: pipeline value, open deals, stalled deals, close dates
3. Analytics: visitor counts, conversion rates, content performance

Output as structured JSON with:
- revenue_snapshot: { mrr, weekly_revenue, weekly_refunds, net_weekly, active_subscriptions }
- pipeline_summary: { total_value, open_deals, stalled_count, top_deals: array }
- daily_agenda: { top_3_priorities: array, revenue_action: string, risk_flags: array }
- weekly_brief: { executive_summary: string, wins: array, losses: array, next_week_focus: array }
- directives: array of { action: string, owner: string, deadline: string, priority: "critical" | "high" | "medium" }

Constraints:
- Revenue actions always come first. If MRR < $20k, no new tool adoption.
- Every directive must be specific: name the deal, the dollar amount, the exact next step.
- Flag any deal stalled > 7 days as a risk.
- Think forward: in ${new Date().getFullYear()}, AI agents handle follow-ups, but the founder must still make the strategic calls.`,
});

registerAgent({
  id: "founder-os-agent",
  name: "Founder OS Agent",
  version: "1.0.0",
  description:
    "Daily operating system for solo founders. Produces morning agendas, midday checks, evening reviews, and weekly sprint plans with revenue-first discipline and tool-gate enforcement.",
  capabilities: ["strategy", "project-management", "coaching", "automation", "scheduling"],
  executionMode: "hybrid",
  modelPreference: "balanced",
  outputFormat: "json_object",
  persistArtifact: true,
  artifactType: "plan",
  category: "operations",
  icon: "Compass",
  estimatedDuration: 30,
  tags: ["daily-ops", "morning-agenda", "sprint-plan", "revenue-first", "founder-discipline"],
  requiredContext: ["daily_agenda", "revenue_snapshot"],
  requiredSecrets: [],
  metadata: {
    methodDispatch: true,
    methods: ["daily_briefing", "midday_check", "evening_review", "weekly_sprint"],
    source: "launchops-founder-edition",
    defaultMethod: "daily_briefing",
  },
  outputSchema: {
    description:
      "Daily operating rhythm: morning top-3 revenue moves, midday blocker check, evening review, and weekly sprint plan. Enforces revenue-first discipline and tool-gate rules.",
    chainableFields: ["morning_agenda", "sprint_plan", "tool_gate_status"],
  },
  systemPrompt: `You are Founder OS — a ruthless daily operating system for a solo founder in ${new Date().getFullYear()}.

Core rules:
1. REVENUE RULE: Every day MUST include exactly 1 revenue action (close a deal, send an invoice, publish a paid offering, run a sales call) and 1 proof artifact (screenshot, receipt, analytics snapshot, or customer testimonial) that proves the action happened.
2. TOOL GATE: No new tools, subscriptions, or platforms may be adopted unless current MRR exceeds $20,000/month. Work with what you have.

Output as structured JSON with:
- morning_agenda: { revenue_action: string, growth_action: string, ops_action: string, proof_artifact: string, risk_flags: array, tool_gate_status: "LOCKED" | "OPEN" }
- midday_check: { revenue_action_status: "DONE" | "BLOCKED" | "IN_PROGRESS", current_blocker: string | null, unblock_step: string, afternoon_priority: string }
- evening_review: { revenue_action_completed: boolean, proof_collected: boolean, wins: array, tomorrow_carryover: array, energy_level: "high" | "medium" | "low" }
- sprint_plan: { week_theme: string, daily_plans: array of { day: string, revenue_action: string, growth_action: string }, weekly_kpis: array }

Be specific. Name the deal, the dollar amount, the exact next step. No vague platitudes.`,
});

registerAgent({
  id: "metrics-agent",
  name: "Metrics Enforcement Agent",
  version: "1.0.0",
  description:
    "Ruthless financial auditor. Tracks MRR, conversion funnels (course → launch → executiv), CAC/LTV, deployment time, and enforces the cut rule: if it doesn't increase revenue or reduce cost, cut it.",
  capabilities: ["analytics", "finance", "kpi_tracking"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_object",
  persistArtifact: true,
  artifactType: "analysis",
  category: "analytics",
  icon: "Gauge",
  estimatedDuration: 35,
  tags: ["metrics", "mrr", "cac-ltv", "conversion-funnel", "cost-cutting", "financial-audit"],
  requiredContext: ["revenue_snapshot"],
  requiredSecrets: ["STRIPE_SECRET_KEY"],
  metadata: {
    methodDispatch: true,
    methods: ["collect_metrics", "weekly_snapshot", "funnel_analysis", "tool_audit"],
    source: "launchops-founder-edition",
    defaultMethod: "weekly_snapshot",
  },
  outputSchema: {
    description:
      "Weekly metrics snapshot with MRR trend, conversion funnel, CAC/LTV analysis, tool cost audit, and cut recommendations.",
    chainableFields: ["metrics_snapshot", "cut_recommendations", "funnel_analysis"],
  },
  systemPrompt: `You are the Metrics Enforcement Agent — a ruthless financial auditor for a solo founder in ${new Date().getFullYear()}.

Your rule: If it doesn't increase revenue or reduce cost, cut it.

Output as structured JSON with:
- metrics_snapshot: { mrr: number, mrr_growth_pct: number, active_subs: number, new_subs: number, churned: number, weekly_revenue: number, refunds: number }
- conversion_funnel: { visitors: number, course_signups: number, launch_conversions: number, executiv_conversions: number, funnel_rates: { visitor_to_signup: number, signup_to_launch: number, launch_to_executiv: number } }
- cac_ltv: { cac: number, ltv: number, ltv_cac_ratio: number, payback_months: number, verdict: "healthy" | "warning" | "critical" }
- tool_audit: array of { tool: string, monthly_cost: number, revenue_attribution: number, verdict: "keep" | "cut" | "review", reason: string }
- cut_recommendations: array of { item: string, monthly_savings: number, reason: string, impact: "none" | "low" | "medium" }
- deployment_metrics: { avg_deploy_time_minutes: number, deploys_this_week: number }

Constraints:
- Any tool with $0 revenue attribution and > $50/month cost gets an automatic "cut" verdict.
- LTV/CAC ratio below 3.0 is a warning; below 1.5 is critical.
- Be specific about what to cut and why. No hedging.`,
});

registerAgent({
  id: "paralegal-bot",
  name: "Paralegal Bot",
  version: "1.0.0",
  description:
    "Business formation and compliance automation. Generates checklists, documents, EIN applications, state registration guidance, compliance calendars, and license tracking.",
  capabilities: ["legal", "automation"],
  executionMode: "python",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "legal",
  icon: "Gavel",
  estimatedDuration: 25,
  tags: ["paralegal", "formation", "compliance", "ein", "registration", "licenses"],
  requiredContext: ["business_name", "state", "entity_type"],
  requiredSecrets: [],
  metadata: {
    source: "launchops-founder-edition",
  },
  outputSchema: {
    description: "Formation checklist, document templates, compliance calendar, and cost estimates",
    chainableFields: ["state_requirements", "industry_licenses", "estimated_timeline", "estimated_costs"],
  },
  systemPrompt:
    "You are a paralegal bot specializing in business formation and compliance. Generate checklists, draft documents, track filing deadlines, and provide state-specific registration guidance. Include EIN application steps and industry-specific license requirements.",
});


// ─── New Pipeline Agents (Legal, Brand, Product, Financial, Hiring, Operations) ───
registerAgent({
  id: "legal-compliance",
  name: "Legal & Compliance Agent",
  version: "1.0.0",
  description:
    "Generates Terms of Service, Privacy Policy, DMCA policy, contractor agreements, NDA templates, and compliance documentation.",
  capabilities: ["legal", "document-generation"],
  executionMode: "llm",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "legal",
  icon: "Scale",
  estimatedDuration: 30,
  tags: ["legal", "compliance", "tos", "privacy-policy", "nda", "contracts"],
  requiredContext: ["business_name", "industry", "business_model"],
  requiredSecrets: [],
  metadata: { source: "launchops-founder-edition" },
  outputSchema: {
    description: "Legal documents including ToS, Privacy Policy, NDA, and contractor agreements",
    chainableFields: ["terms_of_service", "privacy_policy", "nda_template", "contractor_agreement"],
  },
  systemPrompt:
    "You are a legal compliance agent specializing in startup legal documentation. Generate complete, ready-to-use legal documents including Terms of Service, Privacy Policy, DMCA policy, contractor agreements, and NDA templates. All documents should be specific to the business described and include proper legal language.",
});

registerAgent({
  id: "brand-identity",
  name: "Brand Identity Agent",
  version: "1.0.0",
  description:
    "Generates brand voice guide, color palette recommendations, logo creative brief, tagline options, and brand positioning statement.",
  capabilities: ["branding", "creative"],
  executionMode: "llm",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "creative",
  icon: "Palette",
  estimatedDuration: 25,
  tags: ["brand", "identity", "voice", "colors", "logo", "tagline", "positioning"],
  requiredContext: ["business_name", "industry", "target_market"],
  requiredSecrets: [],
  metadata: { source: "launchops-founder-edition" },
  outputSchema: {
    description: "Brand identity package with voice guide, colors, logo brief, taglines, and positioning",
    chainableFields: ["brand_voice", "color_palette", "logo_brief", "taglines", "positioning_statement"],
  },
  systemPrompt:
    "You are a brand identity strategist. Generate comprehensive brand identity packages including brand voice guides, color palette recommendations with hex codes, logo creative briefs, tagline options, and brand positioning statements. Be specific and creative, tailored to the business and its target market.",
});

registerAgent({
  id: "product-mvp",
  name: "Product & MVP Agent",
  version: "1.0.0",
  description:
    "Generates feature specifications, user stories, MVP scope definition, wireframe descriptions, and technical requirements.",
  capabilities: ["product", "engineering"],
  executionMode: "llm",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "engineering",
  icon: "Layers",
  estimatedDuration: 30,
  tags: ["product", "mvp", "features", "user-stories", "wireframes", "requirements"],
  requiredContext: ["business_name", "industry", "business_model", "goals"],
  requiredSecrets: [],
  metadata: { source: "launchops-founder-edition" },
  outputSchema: {
    description: "Product specification with features, user stories, MVP scope, wireframes, and tech requirements",
    chainableFields: ["feature_spec", "user_stories", "mvp_scope", "wireframes", "tech_requirements"],
  },
  systemPrompt:
    "You are a product manager and technical architect. Generate detailed product specifications including feature lists with priority levels, user stories in proper format, MVP scope definitions with in/out decisions, wireframe descriptions, and technical requirements documents. Be specific about what to build first and why.",
});

registerAgent({
  id: "financial-modeling",
  name: "Financial Modeling Agent",
  version: "1.0.0",
  description:
    "Generates P&L projections (12-month), unit economics, burn rate analysis, break-even analysis, and pricing sensitivity models.",
  capabilities: ["finance", "analytics"],
  executionMode: "llm",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "finance",
  icon: "Calculator",
  estimatedDuration: 30,
  tags: ["finance", "p&l", "unit-economics", "burn-rate", "break-even", "pricing"],
  requiredContext: ["business_name", "industry", "business_model", "budget_range"],
  requiredSecrets: [],
  metadata: { source: "launchops-founder-edition" },
  outputSchema: {
    description: "Financial models including P&L, unit economics, burn rate, break-even, and pricing sensitivity",
    chainableFields: ["pl_projection", "unit_economics", "burn_rate", "break_even", "pricing_sensitivity"],
  },
  systemPrompt:
    "You are a financial analyst specializing in startup financial modeling. Generate detailed 12-month P&L projections, unit economics calculations, burn rate analysis, break-even analysis, and pricing sensitivity models. Use realistic assumptions based on the industry and business model. Include actual numbers, formulas, and scenarios.",
});

registerAgent({
  id: "hiring-team",
  name: "Hiring & Team Agent",
  version: "1.0.0",
  description:
    "Generates org charts, job descriptions for key roles, contractor briefs, interview questions, and compensation benchmarks.",
  capabilities: ["hr", "recruiting"],
  executionMode: "llm",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "operations",
  icon: "Users",
  estimatedDuration: 25,
  tags: ["hiring", "team", "org-chart", "job-descriptions", "interviews", "compensation"],
  requiredContext: ["business_name", "industry", "budget_range"],
  requiredSecrets: [],
  metadata: { source: "launchops-founder-edition" },
  outputSchema: {
    description: "Hiring package with org chart, job descriptions, contractor briefs, interview questions, and comp benchmarks",
    chainableFields: ["org_chart", "job_descriptions", "contractor_briefs", "interview_questions", "compensation"],
  },
  systemPrompt:
    "You are an HR strategist and recruiting expert. Generate comprehensive hiring packages including org charts with reporting structure, detailed job descriptions for key roles, contractor briefs, behavioral interview questions, and compensation benchmarks based on market data. Be specific about roles, responsibilities, and salary ranges.",
});

registerAgent({
  id: "operations-sops",
  name: "Operations & SOPs Agent",
  version: "1.0.0",
  description:
    "Generates standard operating procedures, workflow diagrams, daily/weekly checklists, and tool stack integration plans.",
  capabilities: ["operations", "automation"],
  executionMode: "llm",
  modelPreference: "fast",
  outputFormat: "json_schema",
  persistArtifact: true,
  artifactType: "document",
  category: "operations",
  icon: "ClipboardList",
  estimatedDuration: 25,
  tags: ["operations", "sops", "workflows", "checklists", "integration", "processes"],
  requiredContext: ["business_name", "industry", "business_model"],
  requiredSecrets: [],
  metadata: { source: "launchops-founder-edition" },
  outputSchema: {
    description: "Operations package with SOPs, workflow diagrams, checklists, and tool integration plans",
    chainableFields: ["sops", "workflow_diagrams", "checklists", "tool_integration_plan"],
  },
  systemPrompt:
    "You are an operations expert specializing in startup process design. Generate detailed standard operating procedures, text-based workflow diagrams, daily and weekly checklists, and tool stack integration plans. Be specific about steps, responsible parties, timelines, and automation opportunities.",
});

// ─── Registry Stats ─────────────────────────────────────────────────────────────────

export function getRegistryStats() {
  const agents = listAgents();
  const categories = new Set(agents.map((a) => a.category));
  const capabilities = new Set(agents.flatMap((a) => a.capabilities));

  return {
    totalAgents: agents.length,
    categories: Array.from(categories),
    capabilities: Array.from(capabilities),
    byExecutionMode: {
      python: agents.filter((a) => a.executionMode === "python").length,
      llm: agents.filter((a) => a.executionMode === "llm").length,
      hybrid: agents.filter((a) => a.executionMode === "hybrid").length,
    },
    byCategory: Object.fromEntries(
      Array.from(categories).map((cat) => [
        cat,
        agents.filter((a) => a.category === cat).length,
      ])
    ),
  };
}
