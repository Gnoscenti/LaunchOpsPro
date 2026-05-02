/**
 * Atlas Orchestrator — Generic Framework Data Model
 * 
 * Atlas is a general-purpose orchestration framework.
 * Workflows, agents, credentials, and file paths are all pluggable.
 * The "business launch" pipeline is just one workflow definition.
 */

// ─── Core Types ─────────────────────────────────────────────────────

export type StepStatus = "complete" | "active" | "pending" | "failed" | "skipped";
export type AgentStatus = "active" | "idle" | "error" | "disabled";
export type SecretType = "api_key" | "oauth_token" | "ssh_key" | "password" | "file_path" | "env_var" | "certificate";
export type LogLevel = "info" | "warn" | "error" | "debug" | "trace";

// ─── Workflow Engine ────────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  agent: string;           // agent id
  dependsOn: string[];     // step ids
  status: StepStatus;
  retries: number;
  maxRetries: number;
  timeout: number;         // seconds
  output?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: "draft" | "running" | "paused" | "complete" | "failed";
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ─── Agent Registry ─────────────────────────────────────────────────

export interface AgentCapability {
  id: string;
  label: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  category: "intelligence" | "infrastructure" | "legal" | "growth" | "operations" | "custom";
  status: AgentStatus;
  capabilities: string[];
  requiredSecrets: string[];  // vault key ids
  epiScore?: number;          // 0-100, optional trust metric
  lastRun?: string;
  totalRuns: number;
  successRate: number;        // 0-100
}

// ─── Credential Vault ───────────────────────────────────────────────

export interface VaultEntry {
  id: string;
  label: string;
  type: SecretType;
  service: string;          // e.g. "OpenAI", "Stripe", "GitHub", "Local FS"
  isSet: boolean;
  lastRotated?: string;
  usedBy: string[];         // agent ids
  masked: string;           // e.g. "sk-...3xF2"
}

// ─── Execution Log ──────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;           // agent or system
  workflow?: string;         // workflow id
  step?: string;            // step id
  message: string;
  metadata?: Record<string, string>;
}

// ─── File System ────────────────────────────────────────────────────

export interface ManagedFile {
  id: string;
  path: string;
  type: "config" | "output" | "template" | "credential" | "log";
  size: string;
  lastModified: string;
  managedBy: string;        // agent id or "system"
}

// ─── Trust & EPI Framework ──────────────────────────────────────────

export interface TrustMetric {
  id: string;
  label: string;
  value: number;
  target: number;
  unit: string;
  status: "healthy" | "warning" | "critical";
}

export interface CertificationLevel {
  level: number;
  name: string;
  status: "complete" | "in-progress" | "pending";
  progress: number;
  description: string;
}

export interface QualitativeIndicator {
  id: string;
  label: string;
  score: number;
  maxScore: number;
}

// ─── Dashboard Metrics ──────────────────────────────────────────────

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: string;
}

// ═══════════════════════════════════════════════════════════════════
// SAMPLE DATA — "Business Launch" workflow as one config
// ═══════════════════════════════════════════════════════════════════

export const agents: Agent[] = [
  { id: "business-builder", name: "Business Builder", description: "Build spec intake, business model canvas, go-to-market strategy, pricing models", category: "intelligence", status: "active", capabilities: ["business-model", "pricing", "gtm-strategy", "canvas"], requiredSecrets: ["openai-key"], epiScore: 97, totalRuns: 0, successRate: 100 },
  { id: "execai-coach", name: "Strategic Catalyst", description: "Harvard-framework coaching: Porter's Five Forces, Blue Ocean, JTBD, scenario planning", category: "intelligence", status: "active", capabilities: ["coaching", "frameworks", "scenario-planning", "milestone-tracking"], requiredSecrets: ["openai-key"], epiScore: 95, totalRuns: 0, successRate: 100 },
  { id: "funding-intel", name: "Funding Intelligence", description: "VC readiness scoring, grant search, SBIR/STTR eligibility, formation-to-funding optimization", category: "intelligence", status: "active", capabilities: ["vc-analysis", "grant-search", "sbir", "formation-optimizer"], requiredSecrets: ["openai-key"], epiScore: 96, totalRuns: 0, successRate: 100 },
  { id: "paperwork", name: "Paperwork & IP", description: "Legal document generation: Operating Agreement, NDA, IP Assignment, Privacy Policy, Terms of Service", category: "legal", status: "active", capabilities: ["doc-generation", "ip-protection", "trademark", "compliance"], requiredSecrets: ["openai-key"], epiScore: 98, totalRuns: 0, successRate: 100 },
  { id: "documentary", name: "Documentary Tracker", description: "Milestone logging, narrative engine, AI co-creation moment capture for solopreneur documentary", category: "operations", status: "active", capabilities: ["milestone-log", "narrative", "timeline"], requiredSecrets: [], epiScore: 99, totalRuns: 0, successRate: 100 },
  { id: "security", name: "Security Agent", description: "Server hardening, Bitwarden vault, SSH key management, firewall rules, SSL certificates", category: "infrastructure", status: "active", capabilities: ["hardening", "vault", "ssh", "firewall", "ssl"], requiredSecrets: ["server-ssh", "bitwarden-key"], epiScore: 99, totalRuns: 0, successRate: 100 },
  { id: "wordpress", name: "WordPress Agent", description: "WordPress deployment, theme setup, WooCommerce, plugin management, landing pages", category: "infrastructure", status: "idle", capabilities: ["wp-deploy", "woocommerce", "themes", "plugins"], requiredSecrets: ["server-ssh", "wp-admin"], totalRuns: 0, successRate: 100 },
  { id: "stripe-agent", name: "Stripe Agent", description: "Payment processing setup, product catalog, subscription billing, webhook configuration", category: "infrastructure", status: "idle", capabilities: ["payments", "subscriptions", "webhooks", "products"], requiredSecrets: ["stripe-key"], totalRuns: 0, successRate: 100 },
  { id: "mautic", name: "Mautic Agent", description: "Marketing automation, email campaigns, lead scoring, contact segmentation", category: "growth", status: "idle", capabilities: ["email", "campaigns", "lead-scoring", "segmentation"], requiredSecrets: ["mautic-api"], totalRuns: 0, successRate: 100 },
  { id: "analytics", name: "Analytics Agent", description: "Matomo analytics deployment, goal tracking, funnel analysis, custom dashboards", category: "growth", status: "idle", capabilities: ["analytics", "tracking", "funnels", "dashboards"], requiredSecrets: ["server-ssh"], totalRuns: 0, successRate: 100 },
  { id: "repo", name: "Repo Agent", description: "GitHub repository management, CI/CD pipelines, branch protection, automated releases", category: "operations", status: "active", capabilities: ["github", "ci-cd", "releases", "branch-protection"], requiredSecrets: ["github-token"], epiScore: 97, totalRuns: 0, successRate: 100 },
  { id: "growth", name: "Growth Agent", description: "GTM execution, content strategy, SEO optimization, social media automation", category: "growth", status: "idle", capabilities: ["gtm", "seo", "content", "social"], requiredSecrets: ["openai-key"], totalRuns: 0, successRate: 100 },
  { id: "support", name: "Support Agent", description: "Chatwoot deployment, ticket management, knowledge base, customer communication", category: "operations", status: "idle", capabilities: ["tickets", "knowledge-base", "chat"], requiredSecrets: ["server-ssh"], totalRuns: 0, successRate: 100 },
  { id: "project", name: "Project Agent", description: "Taiga project management, sprint planning, issue tracking, team coordination", category: "operations", status: "idle", capabilities: ["sprints", "issues", "planning"], requiredSecrets: ["server-ssh"], totalRuns: 0, successRate: 100 },
  { id: "email-agent", name: "Email Agent", description: "Email deliverability, DKIM/SPF/DMARC, sequence automation, warm-up campaigns", category: "growth", status: "idle", capabilities: ["deliverability", "dkim", "sequences", "warmup"], requiredSecrets: ["server-ssh", "smtp-creds"], totalRuns: 0, successRate: 100 },
  { id: "files", name: "Files Agent", description: "Nextcloud deployment, file sync, shared drives, document management", category: "infrastructure", status: "idle", capabilities: ["file-sync", "storage", "documents"], requiredSecrets: ["server-ssh"], totalRuns: 0, successRate: 100 },
  { id: "web-navigator", name: "Web Navigator", description: "Playwright-based browser automation, form filling, data extraction, screenshot capture", category: "custom", status: "active", capabilities: ["browser", "scraping", "automation", "screenshots"], requiredSecrets: [], epiScore: 94, totalRuns: 0, successRate: 100 },
];

export const vaultEntries: VaultEntry[] = [
  { id: "openai-key", label: "OpenAI API Key", type: "api_key", service: "OpenAI", isSet: true, lastRotated: "2026-03-20", usedBy: ["business-builder", "execai-coach", "funding-intel", "paperwork", "growth"], masked: "sk-...3xF2" },
  { id: "anthropic-key", label: "Anthropic API Key", type: "api_key", service: "Anthropic", isSet: true, lastRotated: "2026-03-18", usedBy: ["paperwork", "execai-coach"], masked: "sk-ant-...9kL1" },
  { id: "stripe-key", label: "Stripe Secret Key", type: "api_key", service: "Stripe", isSet: false, usedBy: ["stripe-agent"], masked: "—" },
  { id: "github-token", label: "GitHub PAT", type: "oauth_token", service: "GitHub", isSet: true, lastRotated: "2026-03-15", usedBy: ["repo"], masked: "ghp_...xR4m" },
  { id: "server-ssh", label: "Production SSH Key", type: "ssh_key", service: "VPS", isSet: false, usedBy: ["security", "wordpress", "analytics", "support", "project", "email-agent", "files"], masked: "—" },
  { id: "bitwarden-key", label: "Bitwarden API Key", type: "api_key", service: "Bitwarden", isSet: false, usedBy: ["security"], masked: "—" },
  { id: "wp-admin", label: "WordPress Admin", type: "password", service: "WordPress", isSet: false, usedBy: ["wordpress"], masked: "—" },
  { id: "mautic-api", label: "Mautic API Key", type: "api_key", service: "Mautic", isSet: false, usedBy: ["mautic"], masked: "—" },
  { id: "smtp-creds", label: "SMTP Credentials", type: "password", service: "Email", isSet: false, usedBy: ["email-agent"], masked: "—" },
  { id: "project-dir", label: "Project Root", type: "file_path", service: "Local FS", isSet: true, usedBy: ["documentary", "repo"], masked: "~/launchops-founder-edition" },
  { id: "output-dir", label: "Output Directory", type: "file_path", service: "Local FS", isSet: true, usedBy: ["paperwork", "documentary", "business-builder"], masked: "~/launchops-output" },
  { id: "env-file", label: ".env File Path", type: "file_path", service: "Local FS", isSet: true, usedBy: ["security"], masked: "~/.env" },
];

export const workflows: Workflow[] = [
  {
    id: "business-launch",
    name: "Business Launch Pipeline",
    description: "20-stage automated sequence from formation to revenue. Configurable for any business type.",
    version: "2.1",
    status: "draft",
    tags: ["launch", "formation", "solopreneur"],
    createdAt: "2026-03-24",
    updatedAt: "2026-03-24",
    steps: [
      { id: "s1", name: "Build Spec Intake", description: "Capture business definition, market, and founder goals", agent: "business-builder", dependsOn: [], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s2", name: "Entity Structure Analysis", description: "Recommend LLC/C-Corp/S-Corp based on funding goals", agent: "funding-intel", dependsOn: ["s1"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s3", name: "Formation Filing", description: "Generate Articles of Organization / Incorporation", agent: "paperwork", dependsOn: ["s2"], status: "pending", retries: 0, maxRetries: 2, timeout: 600 },
      { id: "s4", name: "Operating Agreement", description: "Draft single-member or multi-member operating agreement", agent: "paperwork", dependsOn: ["s3"], status: "pending", retries: 0, maxRetries: 2, timeout: 600 },
      { id: "s5", name: "IP Assignment", description: "Transfer pre-formation IP to entity with assignment agreement", agent: "paperwork", dependsOn: ["s3"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s6", name: "Trademark Search", description: "Check USPTO TESS for conflicts on business name and products", agent: "paperwork", dependsOn: ["s1"], status: "pending", retries: 0, maxRetries: 3, timeout: 120 },
      { id: "s7", name: "Funding Roadmap", description: "Map all eligible funding: VC, grants, SBIR, angel, crowdfunding", agent: "funding-intel", dependsOn: ["s2"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s8", name: "Business Model Canvas", description: "Generate full BMC with value prop, channels, revenue streams", agent: "business-builder", dependsOn: ["s1"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s9", name: "Go-to-Market Strategy", description: "Define launch strategy, pricing, positioning, channels", agent: "business-builder", dependsOn: ["s8"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s10", name: "Server Provisioning", description: "Provision and harden production server", agent: "security", dependsOn: ["s3"], status: "pending", retries: 0, maxRetries: 3, timeout: 900 },
      { id: "s11", name: "WordPress Deploy", description: "Install WordPress, theme, WooCommerce, essential plugins", agent: "wordpress", dependsOn: ["s10"], status: "pending", retries: 0, maxRetries: 3, timeout: 600 },
      { id: "s12", name: "Stripe Integration", description: "Configure payment processing, products, and webhooks", agent: "stripe-agent", dependsOn: ["s11"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s13", name: "Email Infrastructure", description: "Configure DKIM, SPF, DMARC, and transactional email", agent: "email-agent", dependsOn: ["s10"], status: "pending", retries: 0, maxRetries: 3, timeout: 600 },
      { id: "s14", name: "Analytics Setup", description: "Deploy Matomo, configure goals and funnels", agent: "analytics", dependsOn: ["s11"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s15", name: "Marketing Automation", description: "Configure Mautic campaigns, lead scoring, segments", agent: "mautic", dependsOn: ["s13"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s16", name: "CI/CD Pipeline", description: "Set up GitHub Actions, branch protection, automated deploys", agent: "repo", dependsOn: ["s10"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s17", name: "Support System", description: "Deploy Chatwoot, configure channels and knowledge base", agent: "support", dependsOn: ["s11"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s18", name: "90-Day Ops Plan", description: "Generate weekly milestones, KPIs, and coaching schedule", agent: "execai-coach", dependsOn: ["s9"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s19", name: "Growth Playbook", description: "Content calendar, SEO strategy, social media automation", agent: "growth", dependsOn: ["s9", "s14"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "s20", name: "Launch Milestone", description: "Log documentary milestone, generate launch narrative", agent: "documentary", dependsOn: ["s11", "s12", "s18"], status: "pending", retries: 0, maxRetries: 1, timeout: 120 },
    ],
  },
  {
    id: "infra-only",
    name: "Infrastructure Deployment",
    description: "Server provisioning, hardening, and service stack deployment. No business logic.",
    version: "1.0",
    status: "draft",
    tags: ["infrastructure", "devops"],
    createdAt: "2026-03-24",
    updatedAt: "2026-03-24",
    steps: [
      { id: "i1", name: "Server Provisioning", description: "Provision and harden VPS", agent: "security", dependsOn: [], status: "pending", retries: 0, maxRetries: 3, timeout: 900 },
      { id: "i2", name: "WordPress Stack", description: "Deploy WordPress + WooCommerce", agent: "wordpress", dependsOn: ["i1"], status: "pending", retries: 0, maxRetries: 3, timeout: 600 },
      { id: "i3", name: "Email Stack", description: "DKIM/SPF/DMARC + transactional", agent: "email-agent", dependsOn: ["i1"], status: "pending", retries: 0, maxRetries: 3, timeout: 600 },
      { id: "i4", name: "Analytics Stack", description: "Matomo + goals", agent: "analytics", dependsOn: ["i2"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "i5", name: "CI/CD", description: "GitHub Actions pipeline", agent: "repo", dependsOn: ["i1"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
    ],
  },
  {
    id: "legal-docs",
    name: "Legal Document Suite",
    description: "Generate all formation and IP protection documents for a new entity.",
    version: "1.0",
    status: "draft",
    tags: ["legal", "ip", "formation"],
    createdAt: "2026-03-24",
    updatedAt: "2026-03-24",
    steps: [
      { id: "l1", name: "Entity Analysis", description: "Determine optimal entity type", agent: "funding-intel", dependsOn: [], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "l2", name: "Articles of Organization", description: "Generate formation documents", agent: "paperwork", dependsOn: ["l1"], status: "pending", retries: 0, maxRetries: 2, timeout: 600 },
      { id: "l3", name: "Operating Agreement", description: "Draft operating agreement", agent: "paperwork", dependsOn: ["l2"], status: "pending", retries: 0, maxRetries: 2, timeout: 600 },
      { id: "l4", name: "IP Assignment", description: "Founder-to-entity IP transfer", agent: "paperwork", dependsOn: ["l2"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "l5", name: "NDA Template", description: "Generate mutual NDA", agent: "paperwork", dependsOn: [], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "l6", name: "Privacy Policy", description: "CCPA/GDPR compliant privacy policy", agent: "paperwork", dependsOn: ["l1"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
      { id: "l7", name: "Terms of Service", description: "Generate terms of service", agent: "paperwork", dependsOn: ["l1"], status: "pending", retries: 0, maxRetries: 2, timeout: 300 },
    ],
  },
];

export const sampleLogs: LogEntry[] = [
  { id: "log-1", timestamp: "2026-03-24T22:00:00Z", level: "info", source: "system", message: "Atlas Orchestrator v2.1 initialized" },
  { id: "log-2", timestamp: "2026-03-24T22:00:01Z", level: "info", source: "system", message: "17 agents registered in agent registry" },
  { id: "log-3", timestamp: "2026-03-24T22:00:02Z", level: "info", source: "system", message: "Credential vault loaded: 4/12 secrets configured" },
  { id: "log-4", timestamp: "2026-03-24T22:00:03Z", level: "info", source: "system", message: "3 workflow definitions loaded" },
  { id: "log-5", timestamp: "2026-03-24T22:00:04Z", level: "warn", source: "security", message: "Production SSH key not configured — infrastructure agents will be unavailable" },
  { id: "log-6", timestamp: "2026-03-24T22:00:05Z", level: "warn", source: "stripe-agent", message: "Stripe API key not set — payment processing unavailable" },
  { id: "log-7", timestamp: "2026-03-24T22:00:06Z", level: "info", source: "business-builder", message: "Agent ready. LLM provider: OpenAI (gpt-4o)" },
  { id: "log-8", timestamp: "2026-03-24T22:00:07Z", level: "info", source: "execai-coach", message: "Strategic Catalyst persona loaded. Harvard frameworks: 6 active" },
  { id: "log-9", timestamp: "2026-03-24T22:00:08Z", level: "info", source: "funding-intel", message: "Funding matrix initialized: VC, grants, SBIR/STTR, angel, crowdfunding" },
  { id: "log-10", timestamp: "2026-03-24T22:00:09Z", level: "debug", source: "web-navigator", message: "Playwright browser pool: 0 active, 3 max concurrent" },
  { id: "log-11", timestamp: "2026-03-24T22:00:10Z", level: "info", source: "system", message: "EPI trust scoring enabled. Current composite: 96.4" },
  { id: "log-12", timestamp: "2026-03-24T22:00:11Z", level: "info", source: "system", message: "System ready. Awaiting workflow execution command." },
];

export const managedFiles: ManagedFile[] = [
  { id: "f1", path: "~/launchops-founder-edition/.env", type: "config", size: "2.1 KB", lastModified: "2026-03-24", managedBy: "system" },
  { id: "f2", path: "~/launchops-founder-edition/launchops.py", type: "config", size: "12.4 KB", lastModified: "2026-03-24", managedBy: "system" },
  { id: "f3", path: "~/launchops-output/", type: "output", size: "—", lastModified: "—", managedBy: "system" },
  { id: "f4", path: "~/launchops-founder-edition/workflows/", type: "template", size: "8.2 KB", lastModified: "2026-03-24", managedBy: "system" },
  { id: "f5", path: "~/launchops-founder-edition/docker-compose.yml", type: "config", size: "3.8 KB", lastModified: "2026-03-24", managedBy: "security" },
  { id: "f6", path: "~/launchops-founder-edition/deploy.sh", type: "config", size: "44 KB", lastModified: "2026-03-24", managedBy: "security" },
  { id: "f7", path: "~/.atlas/credentials.enc", type: "credential", size: "1.2 KB", lastModified: "2026-03-24", managedBy: "system" },
  { id: "f8", path: "~/.atlas/audit.log", type: "log", size: "0 KB", lastModified: "2026-03-24", managedBy: "system" },
];

// ─── Trust & EPI Data ───────────────────────────────────────────────

export const trustMetrics: TrustMetric[] = [
  { id: "epi-compliance", label: "EPI Compliance Rate", value: 97.2, target: 95, unit: "%", status: "healthy" },
  { id: "thought-log", label: "Thought Log Completeness", value: 100, target: 100, unit: "%", status: "healthy" },
  { id: "guardian-veto", label: "Guardian Veto Rate", value: 1.2, target: 5, unit: "%", status: "healthy" },
  { id: "incident-response", label: "Incident Response Time", value: 12, target: 24, unit: "h", status: "healthy" },
  { id: "stakeholder-sat", label: "Stakeholder Satisfaction", value: 85, target: 80, unit: "%", status: "healthy" },
];

export const certificationLevels: CertificationLevel[] = [
  { level: 1, name: "Mathematical Verification", status: "complete", progress: 100, description: "EPI derivation, unit tests >95% coverage, formal proofs" },
  { level: 2, name: "Smart Contract Audit", status: "in-progress", progress: 60, description: "Ethereum + Solana contracts. Pending: external audit" },
  { level: 3, name: "AI Agent Certification", status: "complete", progress: 90, description: "EPI validation, Trust Stack logging, red team framework" },
  { level: 4, name: "Operational Transparency", status: "complete", progress: 85, description: "Trust dashboard, real-time EPI, Guardian oversight" },
  { level: 5, name: "Regulatory Compliance", status: "in-progress", progress: 40, description: "Wyoming DAO LLC. Pending: legal review" },
];

export const qualitativeIndicators: QualitativeIndicator[] = [
  { id: "transparency", label: "Transparency", score: 92, maxScore: 100 },
  { id: "predictability", label: "Predictability", score: 88, maxScore: 100 },
  { id: "accountability", label: "Accountability", score: 95, maxScore: 100 },
  { id: "fairness", label: "Fairness", score: 90, maxScore: 100 },
  { id: "resilience", label: "Resilience", score: 85, maxScore: 100 },
];

// ─── Dashboard Summary ──────────────────────────────────────────────

export const dashboardMetrics: DashboardMetric[] = [
  { id: "m-1", label: "Workflows", value: String(workflows.length), change: "3 defined", changeType: "neutral", icon: "GitBranch" },
  { id: "m-2", label: "Agents", value: String(agents.length), change: `${agents.filter(a => a.status === "active").length} active`, changeType: "positive", icon: "Bot" },
  { id: "m-3", label: "Vault Keys", value: `${vaultEntries.filter(v => v.isSet).length}/${vaultEntries.length}`, change: `${vaultEntries.filter(v => !v.isSet).length} missing`, changeType: vaultEntries.filter(v => !v.isSet).length > 0 ? "negative" : "positive", icon: "Key" },
  { id: "m-4", label: "Trust Score", value: "96.4", change: "Healthy", changeType: "positive", icon: "Shield" },
  { id: "m-5", label: "Files Managed", value: String(managedFiles.length), change: "Synced", changeType: "positive", icon: "FolderOpen" },
  { id: "m-6", label: "Executions", value: "0", change: "Ready", changeType: "neutral", icon: "Play" },
];

export const positioningStatement = "A general-purpose AI orchestration framework. Define workflows, register agents, manage credentials, and execute — for any use case.";
