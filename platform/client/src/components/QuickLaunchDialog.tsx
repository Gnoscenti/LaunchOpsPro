/**
 * QuickLaunchDialog — Agent-specific input form that collects business context
 * before launching an agent. Fields are dynamically generated based on the
 * agent's category, requiredContext, and execution mode.
 */
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket, Loader2, Info } from "lucide-react";

// ─── Field definitions per agent category ──────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "text" | "textarea" | "select";
  options?: string[];
}

const COMMON_FIELDS: FieldDef[] = [
  { key: "business_name", label: "Business Name", placeholder: "e.g., ExecAI", required: true },
  { key: "domain", label: "Domain", placeholder: "e.g., execai.io" },
];

const CATEGORY_FIELDS: Record<string, FieldDef[]> = {
  strategic: [
    ...COMMON_FIELDS,
    { key: "product_description", label: "Product Description", placeholder: "What does your product do?", type: "textarea" },
    { key: "target_market", label: "Target Market / ICP", placeholder: "e.g., Series A SaaS founders" },
    { key: "current_mrr", label: "Current MRR ($)", placeholder: "e.g., 0 or 5000" },
    { key: "stage", label: "Stage", placeholder: "Select stage", type: "select", options: ["pre-revenue", "pilot", "growth", "scale"] },
  ],
  infrastructure: [
    ...COMMON_FIELDS,
    { key: "server_ip", label: "Server IP / Host", placeholder: "e.g., 192.168.1.100 or app.example.com" },
    { key: "stack", label: "Tech Stack", placeholder: "e.g., Node.js, PostgreSQL, Docker" },
    { key: "cloud_provider", label: "Cloud Provider", placeholder: "e.g., AWS, GCP, DigitalOcean" },
  ],
  legal: [
    ...COMMON_FIELDS,
    { key: "entity_type", label: "Entity Type", placeholder: "Select type", type: "select", options: ["LLC", "C-Corp", "S-Corp", "Sole Proprietorship", "Partnership"] },
    { key: "state", label: "State of Formation", placeholder: "e.g., California, Delaware" },
    { key: "founders", label: "Number of Founders", placeholder: "e.g., 1 or 2" },
  ],
  marketing: [
    ...COMMON_FIELDS,
    { key: "target_audience", label: "Target Audience", placeholder: "Who are you trying to reach?" },
    { key: "channels", label: "Active Channels", placeholder: "e.g., LinkedIn, Twitter, Email" },
    { key: "budget", label: "Monthly Budget ($)", placeholder: "e.g., 500" },
  ],
  payment: [
    ...COMMON_FIELDS,
    { key: "pricing_model", label: "Pricing Model", placeholder: "Select model", type: "select", options: ["subscription", "one-time", "usage-based", "freemium"] },
    { key: "price_point", label: "Price Point ($)", placeholder: "e.g., 49/mo" },
    { key: "currency", label: "Currency", placeholder: "e.g., USD" },
  ],
  content: [
    ...COMMON_FIELDS,
    { key: "content_type", label: "Content Type", placeholder: "Select type", type: "select", options: ["blog", "social", "video", "email", "documentation"] },
    { key: "tone", label: "Brand Voice / Tone", placeholder: "e.g., professional, conversational, bold" },
    { key: "audience", label: "Content Audience", placeholder: "Who reads this content?" },
  ],
  communication: [
    ...COMMON_FIELDS,
    { key: "recipient_type", label: "Recipient Type", placeholder: "e.g., leads, customers, team" },
    { key: "campaign_goal", label: "Campaign Goal", placeholder: "e.g., onboarding, nurture, re-engagement" },
  ],
  analytics: [
    ...COMMON_FIELDS,
    { key: "metrics_focus", label: "Metrics Focus", placeholder: "e.g., MRR, churn, CAC, LTV" },
    { key: "data_sources", label: "Data Sources", placeholder: "e.g., Stripe, Google Analytics, CRM" },
    { key: "reporting_period", label: "Reporting Period", placeholder: "Select period", type: "select", options: ["daily", "weekly", "monthly", "quarterly"] },
  ],
  operations: [
    ...COMMON_FIELDS,
    { key: "team_size", label: "Team Size", placeholder: "e.g., 1 (solo) or 5" },
    { key: "priorities", label: "Current Priorities", placeholder: "e.g., Close pilot, Ship v0.2, Hire first engineer", type: "textarea" },
  ],
  security: [
    ...COMMON_FIELDS,
    { key: "server_ip", label: "Server IP / Host", placeholder: "e.g., 192.168.1.100" },
    { key: "compliance_requirements", label: "Compliance Requirements", placeholder: "e.g., SOC2, HIPAA, GDPR" },
  ],
};

// ─── Method-specific fields for Founder Edition agents ─────────────────────

const METHOD_FIELDS: Record<string, FieldDef[]> = {
  generate_daily_agenda: [
    ...COMMON_FIELDS,
    { key: "priorities", label: "Today's Priorities", placeholder: "What are the top 3 things to accomplish?", type: "textarea", required: true },
  ],
  morning_agenda: [
    ...COMMON_FIELDS,
    { key: "goals", label: "Current Goals", placeholder: "What are you working toward this week?", type: "textarea", required: true },
  ],
  weekly_snapshot: [
    ...COMMON_FIELDS,
    { key: "mrr", label: "Current MRR ($)", placeholder: "e.g., 0" },
    { key: "active_users", label: "Active Users", placeholder: "e.g., 0" },
  ],
  generate_30_day_calendar: [
    ...COMMON_FIELDS,
    { key: "content_pillars", label: "Content Pillars", placeholder: "e.g., AI automation, founder stories, product updates", type: "textarea" },
    { key: "posting_frequency", label: "Posts per Week", placeholder: "e.g., 3" },
  ],
};

// ─── Determine which fields to show ────────────────────────────────────────

function getFieldsForAgent(agent: {
  id: string;
  category: string;
  requiredContext: string[];
  executionMode: string;
}, method?: string): FieldDef[] {
  // If a specific method is selected and has dedicated fields, use those
  if (method && METHOD_FIELDS[method]) {
    return METHOD_FIELDS[method];
  }

  // Use category-based fields
  const categoryFields = CATEGORY_FIELDS[agent.category] ?? COMMON_FIELDS;

  // Add any requiredContext fields that aren't already covered
  const existingKeys = new Set(categoryFields.map((f) => f.key));
  const extraFields: FieldDef[] = agent.requiredContext
    .filter((ctx) => !existingKeys.has(ctx))
    .map((ctx) => ({
      key: ctx,
      label: ctx.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      placeholder: `Enter ${ctx.replace(/_/g, " ")}`,
    }));

  return [...categoryFields, ...extraFields];
}

// ─── Founder Edition methods per agent ─────────────────────────────────────

const AGENT_METHODS: Record<string, { value: string; label: string }[]> = {
  "content-engine": [
    { value: "generate_30_day_calendar", label: "Generate 30-Day Calendar" },
    { value: "generate_post", label: "Generate Post" },
    { value: "generate_youtube_short_script", label: "Generate YouTube Short Script" },
  ],
  "dynexecutiv-agent": [
    { value: "generate_daily_agenda", label: "Generate Daily Agenda" },
    { value: "generate_weekly_brief", label: "Generate Weekly Brief" },
  ],
  "founder-os-agent": [
    { value: "morning_agenda", label: "Morning Agenda" },
    { value: "midday_check", label: "Midday Check" },
    { value: "evening_review", label: "Evening Review" },
    { value: "weekly_sprint_plan", label: "Weekly Sprint Plan" },
  ],
  "metrics-agent": [
    { value: "weekly_snapshot", label: "Weekly Snapshot" },
    { value: "calculate_conversion_funnel", label: "Conversion Funnel" },
    { value: "cac_ltv_analysis", label: "CAC/LTV Analysis" },
    { value: "evaluate_and_cut", label: "Evaluate & Cut" },
  ],
};

// ─── Component ─────────────────────────────────────────────────────────────

interface QuickLaunchDialogProps {
  open: boolean;
  onClose: () => void;
  agent: {
    id: string;
    name: string;
    category: string;
    requiredContext: string[];
    executionMode: string;
    description: string;
  } | null;
  onLaunch: (agentId: string, agentName: string, config: Record<string, unknown>) => void;
  isLaunching: boolean;
}

export function QuickLaunchDialog({ open, onClose, agent, onLaunch, isLaunching }: QuickLaunchDialogProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedMethod, setSelectedMethod] = useState<string>("");

  // Reset form when agent changes
  useEffect(() => {
    if (agent) {
      setFormData({});
      const methods = AGENT_METHODS[agent.id];
      setSelectedMethod(methods?.[0]?.value ?? "");
    }
  }, [agent?.id]);

  if (!agent) return null;

  const methods = AGENT_METHODS[agent.id];
  const fields = getFieldsForAgent(agent, selectedMethod || undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: Record<string, unknown> = { ...formData };
    if (selectedMethod) {
      config._method = selectedMethod;
    }
    onLaunch(agent.id, agent.name, config);
  };

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-[Sora] text-lg flex items-center gap-2">
            <Rocket size={18} className="text-[oklch(0.75_0.15_85)]" />
            Launch: {agent.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-[IBM_Plex_Mono]">
            {agent.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Method selector for Founder Edition agents */}
          {methods && methods.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-[IBM_Plex_Mono] text-muted-foreground">
                Method
              </Label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.75_0.15_85)]"
              >
                {methods.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic fields */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs font-[IBM_Plex_Mono] text-muted-foreground flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-[oklch(0.75_0.15_85)]">*</span>}
                </Label>
                {field.type === "textarea" ? (
                  <textarea
                    value={formData[field.key] ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.75_0.15_85)] resize-none"
                  />
                ) : field.type === "select" && field.options ? (
                  <select
                    value={formData[field.key] ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    required={field.required}
                    className="w-full h-9 px-3 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-[oklch(0.75_0.15_85)]"
                  >
                    <option value="">{field.placeholder}</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={formData[field.key] ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="h-9 text-sm bg-background border-border focus-visible:ring-[oklch(0.75_0.15_85)]"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/30 border border-border">
            <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground font-[IBM_Plex_Mono] leading-relaxed">
              This context will be passed to the agent as its execution environment.
              Required fields must be filled. Optional fields improve output quality.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="font-[Sora] text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLaunching}
              className="bg-[oklch(0.75_0.15_85)] hover:bg-[oklch(0.70_0.15_85)] text-background font-[Sora] text-xs gap-2"
            >
              {isLaunching ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Rocket size={12} />
                  Execute Agent
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
