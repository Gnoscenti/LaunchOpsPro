/**
 * Pipeline — Launch Pipeline with Intake Form + Mission Control View.
 *
 * Flow:
 *   1. User clicks "Launch Pipeline" → sees the intake form
 *   2. User fills in business details and submits
 *   3. Backend creates a multi-step workflow with personalized config
 *   4. Mission Control view shows each agent stage in real-time via SSE
 *   5. Each stage transitions: pending → running → complete with live output
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Rocket,
  Building2,
  Server,
  CreditCard,
  TrendingUp,
  GraduationCap,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Shield,
  FileText,
  Copy,
  Check,
  Download,
  Wand2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntakeFormData {
  businessName: string;
  industry: string;
  targetMarket: string;
  businessModel: string;
  goals: string;
  budgetRange: string;
  timeline: string;
}

interface StageStatus {
  id: string;
  label: string;
  agentId: string;
  description: string;
  icon: React.ReactNode;
  status: "pending" | "running" | "complete" | "failed";
  output: Record<string, unknown> | null;
  startedAt: number | null;
  completedAt: number | null;
  stepId?: number;
}

type PipelineView = "intake" | "running" | "history";

// ─── Pipeline Stage Definitions ──────────────────────────────────────────────

const PIPELINE_STAGES: Omit<StageStatus, "status" | "output" | "startedAt" | "completedAt" | "stepId">[] = [
  {
    id: "formation",
    label: "Business Formation",
    agentId: "formation-advisor",
    description: "Entity type, legal structure, state filing requirements",
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    id: "infrastructure",
    label: "Infrastructure & Tech Stack",
    agentId: "systems-agent",
    description: "Technology stack, tools, domain, hosting recommendations",
    icon: <Server className="w-5 h-5" />,
  },
  {
    id: "payments",
    label: "Payment Processing",
    agentId: "stripe-agent",
    description: "Payment setup, pricing strategy, revenue operations",
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    id: "funding",
    label: "Funding Strategy",
    agentId: "funding-intelligence",
    description: "Funding sources, investor targeting, capital strategy",
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    id: "coaching",
    label: "Executive Coaching",
    agentId: "execai-coach",
    description: "Personalized 90-day action plan, milestones, priorities",
    icon: <GraduationCap className="w-5 h-5" />,
  },
  {
    id: "growth",
    label: "Growth & Marketing",
    agentId: "growth-agent",
    description: "Marketing strategy, growth channels, customer acquisition",
    icon: <BarChart3 className="w-5 h-5" />,
  },
];

// ─── Intake Form Component ───────────────────────────────────────────────────

function IntakeForm({ onSubmit, isSubmitting }: { onSubmit: (data: IntakeFormData) => void; isSubmitting: boolean }) {
  const [form, setForm] = useState<IntakeFormData>({
    businessName: "",
    industry: "",
    targetMarket: "",
    businessModel: "",
    goals: "",
    budgetRange: "",
    timeline: "",
  });

  const update = (field: keyof IntakeFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const canSubmit = form.businessName && form.industry && form.targetMarket && form.businessModel && form.goals;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-3xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[oklch(0.75_0.15_85)] to-[oklch(0.65_0.18_60)] mb-4"
        >
          <Rocket className="w-8 h-8 text-black" />
        </motion.div>
        <h1 className="text-2xl font-bold font-[Sora] text-foreground mb-2">
          Launch Your Business
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Tell us about your business and our AI agents will create a personalized
          launch plan across 6 critical dimensions.
        </p>
      </div>

      {/* Form */}
      <Card className="bg-[oklch(0.14_0.005_250)] border-border">
        <CardContent className="p-6 space-y-5">
          {/* Business Name */}
          <div className="space-y-2">
            <Label htmlFor="businessName" className="text-xs font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground">
              Business Name <span className="text-[oklch(0.75_0.15_85)]">*</span>
            </Label>
            <Input
              id="businessName"
              placeholder="e.g., Gnoscenti AI"
              value={form.businessName}
              onChange={(e) => update("businessName", e.target.value)}
              className="bg-[oklch(0.12_0.005_250)] border-border focus:border-[oklch(0.45_0.12_85)]"
            />
          </div>

          {/* Industry + Business Model Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry" className="text-xs font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground">
                Industry / Sector <span className="text-[oklch(0.75_0.15_85)]">*</span>
              </Label>
              <Input
                id="industry"
                placeholder="e.g., AI/ML, FinTech, HealthTech"
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
                className="bg-[oklch(0.12_0.005_250)] border-border focus:border-[oklch(0.45_0.12_85)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessModel" className="text-xs font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground">
                Business Model <span className="text-[oklch(0.75_0.15_85)]">*</span>
              </Label>
              <Select value={form.businessModel} onValueChange={(v) => update("businessModel", v)}>
                <SelectTrigger className="bg-[oklch(0.12_0.005_250)] border-border focus:border-[oklch(0.45_0.12_85)]">
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saas">SaaS (Software as a Service)</SelectItem>
                  <SelectItem value="services">Professional Services</SelectItem>
                  <SelectItem value="marketplace">Marketplace / Platform</SelectItem>
                  <SelectItem value="ecommerce">E-Commerce</SelectItem>
                  <SelectItem value="subscription">Subscription / Membership</SelectItem>
                  <SelectItem value="freemium">Freemium</SelectItem>
                  <SelectItem value="agency">Agency / Consultancy</SelectItem>
                  <SelectItem value="hardware">Hardware / IoT</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Market */}
          <div className="space-y-2">
            <Label htmlFor="targetMarket" className="text-xs font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground">
              Target Market / Ideal Customer <span className="text-[oklch(0.75_0.15_85)]">*</span>
            </Label>
            <Input
              id="targetMarket"
              placeholder="e.g., Series A startups needing AI integration, SMB founders, enterprise CTOs"
              value={form.targetMarket}
              onChange={(e) => update("targetMarket", e.target.value)}
              className="bg-[oklch(0.12_0.005_250)] border-border focus:border-[oklch(0.45_0.12_85)]"
            />
          </div>

          {/* Goals */}
          <div className="space-y-2">
            <Label htmlFor="goals" className="text-xs font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground">
              Goals / What You Want to Build <span className="text-[oklch(0.75_0.15_85)]">*</span>
            </Label>
            <Textarea
              id="goals"
              placeholder="Describe your vision, what problem you're solving, and what you want to achieve in the first 90 days..."
              value={form.goals}
              onChange={(e) => update("goals", e.target.value)}
              rows={4}
              className="bg-[oklch(0.12_0.005_250)] border-border focus:border-[oklch(0.45_0.12_85)] resize-none"
            />
          </div>

          {/* Budget + Timeline Row (Optional) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budgetRange" className="text-xs font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground">
                Budget Range <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <Select value={form.budgetRange} onValueChange={(v) => update("budgetRange", v)}>
                <SelectTrigger className="bg-[oklch(0.12_0.005_250)] border-border focus:border-[oklch(0.45_0.12_85)]">
                  <SelectValue placeholder="Select range..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bootstrap">Bootstrap ($0 - $5K)</SelectItem>
                  <SelectItem value="seed">Seed ($5K - $50K)</SelectItem>
                  <SelectItem value="pre-seed">Pre-Seed ($50K - $250K)</SelectItem>
                  <SelectItem value="series-a">Series A ($250K - $2M)</SelectItem>
                  <SelectItem value="growth">Growth ($2M+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeline" className="text-xs font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground">
                Timeline <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <Select value={form.timeline} onValueChange={(v) => update("timeline", v)}>
                <SelectTrigger className="bg-[oklch(0.12_0.005_250)] border-border focus:border-[oklch(0.45_0.12_85)]">
                  <SelectValue placeholder="Select timeline..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30-days">30 Days (Sprint)</SelectItem>
                  <SelectItem value="90-days">90 Days (Standard)</SelectItem>
                  <SelectItem value="6-months">6 Months</SelectItem>
                  <SelectItem value="12-months">12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <Button
              onClick={() => onSubmit(form)}
              disabled={!canSubmit || isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-[oklch(0.75_0.15_85)] to-[oklch(0.65_0.18_60)] text-black font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Initializing Pipeline...
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Launch Pipeline
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stage Preview */}
      <div className="mt-6">
        <p className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-widest text-muted-foreground mb-3">
          Pipeline Stages
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {PIPELINE_STAGES.map((stage, i) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className="flex items-center gap-2 p-2 rounded-lg bg-[oklch(0.14_0.005_250)] border border-border"
            >
              <div className="text-muted-foreground">{stage.icon}</div>
              <div>
                <p className="text-[11px] font-medium text-foreground">{stage.label}</p>
                <p className="text-[9px] text-muted-foreground">{stage.description.slice(0, 40)}...</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Mission Control Component ───────────────────────────────────────────────

function MissionControl({
  stages,
  businessName,
  executionId,
  overallProgress,
  isComplete,
  onNewLaunch,
}: {
  stages: StageStatus[];
  businessName: string;
  executionId: number;
  overallProgress: number;
  isComplete: boolean;
  onNewLaunch: () => void;
}) {
  // Local mutation for artifact generation
  const launchPipeline = trpc.agentRegistry.launchPipeline.useMutation();
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  const toggleStage = (id: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-expand running and newly completed stages
  useEffect(() => {
    const running = stages.find((s) => s.status === "running");
    if (running) {
      setExpandedStages((prev) => new Set(prev).add(running.id));
    }
  }, [stages]);

  // Auto-expand completed stages when they finish
  useEffect(() => {
    stages.forEach((s) => {
      if (s.status === "complete" && s.output) {
        setExpandedStages((prev) => new Set(prev).add(s.id));
      }
    });
  }, [stages.map((s) => s.status).join(",")]);

  const getStatusColor = (status: StageStatus["status"]) => {
    switch (status) {
      case "running": return "text-blue-400 border-blue-400/50 bg-blue-400/5";
      case "complete": return "text-emerald-400 border-emerald-400/50 bg-emerald-400/5";
      case "failed": return "text-red-400 border-red-400/50 bg-red-400/5";
      default: return "text-muted-foreground border-border bg-transparent";
    }
  };

  const getStatusIcon = (status: StageStatus["status"]) => {
    switch (status) {
      case "running": return <Loader2 className="w-5 h-5 animate-spin text-blue-400" />;
      case "complete": return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "failed": return <XCircle className="w-5 h-5 text-red-400" />;
      default: return <Clock className="w-5 h-5 text-muted-foreground/50" />;
    }
  };

  // Copy to clipboard helper
  const [copiedStage, setCopiedStage] = useState<string | null>(null);
  const [generatingArtifact, setGeneratingArtifact] = useState<string | null>(null);

  const copyToClipboard = (text: string, stageId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStage(stageId);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedStage(null), 2000);
    });
  };

  const getPlainTextOutput = (output: Record<string, unknown>): string => {
    const { _meta, ...rest } = output;
    const lines: string[] = [];
    const flatten = (obj: unknown, prefix = ""): void => {
      if (typeof obj === "string") {
        lines.push(prefix ? `${prefix}: ${obj}` : obj);
      } else if (Array.isArray(obj)) {
        obj.forEach((item, i) => {
          if (typeof item === "string") {
            lines.push(`${prefix ? prefix + " " : ""}${i + 1}. ${item}`);
          } else {
            flatten(item, `${prefix}[${i + 1}]`);
          }
        });
      } else if (typeof obj === "object" && obj !== null) {
        Object.entries(obj).forEach(([key, val]) => {
          const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          if (typeof val === "string") {
            lines.push(`\n## ${label}\n${val}`);
          } else if (Array.isArray(val)) {
            lines.push(`\n## ${label}`);
            flatten(val, "");
          } else if (typeof val === "object" && val !== null) {
            lines.push(`\n## ${label}`);
            flatten(val, "");
          }
        });
      }
    };
    flatten(rest);
    return lines.join("\n");
  };

  // Action button definitions per stage
  const getActionButtons = (stageId: string): { label: string; icon: React.ReactNode; action: string }[] => {
    const actions: Record<string, { label: string; icon: React.ReactNode; action: string }[]> = {
      formation: [
        { label: "Generate Articles of Incorporation PDF", icon: <FileText className="w-3 h-3" />, action: "articles_pdf" },
        { label: "Generate Operating Agreement", icon: <FileText className="w-3 h-3" />, action: "operating_agreement" },
      ],
      infrastructure: [
        { label: "Generate Project Structure", icon: <Wand2 className="w-3 h-3" />, action: "project_structure" },
        { label: "Generate .env Template", icon: <FileText className="w-3 h-3" />, action: "env_template" },
      ],
      payments: [
        { label: "Generate Stripe Integration Code", icon: <Wand2 className="w-3 h-3" />, action: "stripe_code" },
        { label: "Generate Pricing Page HTML", icon: <FileText className="w-3 h-3" />, action: "pricing_page" },
      ],
      funding: [
        { label: "Generate Pitch Deck Outline", icon: <Wand2 className="w-3 h-3" />, action: "pitch_deck" },
        { label: "Generate Investor Email Sequence", icon: <FileText className="w-3 h-3" />, action: "investor_emails" },
      ],
      coaching: [
        { label: "Generate 30-Day Calendar", icon: <Wand2 className="w-3 h-3" />, action: "calendar_30day" },
        { label: "Generate Weekly Review Template", icon: <FileText className="w-3 h-3" />, action: "weekly_review" },
      ],
      growth: [
        { label: "Generate Landing Page Copy", icon: <Wand2 className="w-3 h-3" />, action: "landing_page" },
        { label: "Generate Social Media Posts", icon: <FileText className="w-3 h-3" />, action: "social_posts" },
      ],
    };
    return actions[stageId] ?? [];
  };

  const handleGenerateArtifact = async (stageId: string, action: string, stageOutput: Record<string, unknown>) => {
    setGeneratingArtifact(`${stageId}-${action}`);
    toast.info("Generating artifact — this may take a moment...");
    try {
      // Use the quickLaunch endpoint with a specialized prompt
      const artifactPrompt = `Based on the following business plan output, generate the specific artifact requested.\n\nBusiness: ${businessName}\nAction requested: ${action}\n\nPrevious output:\n${getPlainTextOutput(stageOutput)}\n\nGenerate the complete, ready-to-use artifact. Be extremely detailed and specific.`;
      const result = await launchPipeline.mutateAsync({
        businessName: businessName,
        industry: "artifact-generation",
        targetMarket: action,
        businessModel: "artifact",
        goals: artifactPrompt,
        budgetRange: undefined,
        timeline: undefined,
      });
      toast.success("Artifact generated! Check the new pipeline run.");
    } catch (err) {
      toast.error("Failed to generate artifact");
    } finally {
      setGeneratingArtifact(null);
    }
  };

  const formatOutput = (output: Record<string, unknown>, stageId: string) => {
    const { _meta, ...displayOutput } = output;
    const meta = _meta as Record<string, unknown> | undefined;
    const summary = displayOutput.summary as string | undefined;
    const recommendations = displayOutput.recommendations as string[] | undefined;
    const actions = displayOutput.actions as string[] | undefined;
    const outputs = displayOutput.outputs as Record<string, unknown> | string | undefined;
    const plainText = getPlainTextOutput(output);
    const actionButtons = getActionButtons(stageId);

    return (
      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        {/* Copy Button */}
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); copyToClipboard(plainText, stageId); }}
          >
            {copiedStage === stageId ? (
              <><Check className="w-3 h-3 mr-1 text-emerald-400" />Copied!</>
            ) : (
              <><Copy className="w-3 h-3 mr-1" />Copy All</>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              const blob = new Blob([plainText], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${stageId}-${businessName.replace(/\s+/g, "-").toLowerCase()}.txt`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Downloaded!");
            }}
          >
            <Download className="w-3 h-3 mr-1" />
            Download
          </Button>
        </div>
        {/* Summary */}
        {summary && (
          <div className="bg-[oklch(0.12_0.005_250)] rounded-lg p-3">
            <p className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-wider text-[oklch(0.75_0.15_85)] mb-1.5">Executive Summary</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
          </div>
        )}
        {/* Actions */}
        {actions && actions.length > 0 && (
          <div>
            <p className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground mb-2">Deliverables & Actions</p>
            <div className="space-y-1.5">
              {(actions as (string | Record<string, unknown>)[]).map((action, i) => (
                <div key={i} className="flex items-start gap-2 bg-[oklch(0.11_0.005_250)] rounded px-3 py-2">
                  <span className="text-[oklch(0.75_0.15_85)] font-bold text-xs mt-0.5">{i + 1}.</span>
                  <span className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {typeof action === "string" ? action : JSON.stringify(action, null, 2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Outputs (code, configs, etc.) */}
        {outputs && typeof outputs === "object" && Object.keys(outputs).length > 0 && (
          <div>
            <p className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground mb-2">Generated Artifacts</p>
            <div className="space-y-2">
              {Object.entries(outputs).map(([key, val]) => (
                <div key={key} className="bg-[oklch(0.08_0.005_250)] rounded-lg p-3 border border-border/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-wider text-[oklch(0.75_0.15_85)]">
                      {key.replace(/_/g, " ")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[9px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        const text = typeof val === "string" ? val : JSON.stringify(val, null, 2);
                        copyToClipboard(text, `${stageId}-${key}`);
                      }}
                    >
                      {copiedStage === `${stageId}-${key}` ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    </Button>
                  </div>
                  <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-[IBM_Plex_Mono] overflow-auto max-h-48 leading-relaxed">
                    {typeof val === "string" ? val : JSON.stringify(val, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
        {outputs && typeof outputs === "string" && (
          <div className="bg-[oklch(0.08_0.005_250)] rounded-lg p-3 border border-border/30">
            <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-[IBM_Plex_Mono] overflow-auto max-h-64 leading-relaxed">
              {outputs}
            </pre>
          </div>
        )}
        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div>
            <p className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground mb-2">Strategic Recommendations</p>
            <div className="space-y-1.5">
              {(recommendations as (string | Record<string, unknown>)[]).map((rec, i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1.5">
                  <Sparkles className="w-3 h-3 text-[oklch(0.75_0.15_85)] mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {typeof rec === "string" ? rec : JSON.stringify(rec)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Fallback for unstructured output */}
        {!summary && !actions && !recommendations && !outputs && (
          <div className="bg-[oklch(0.08_0.005_250)] rounded-lg p-3 border border-border/30">
            <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap font-[IBM_Plex_Mono] overflow-auto max-h-96 leading-relaxed">
              {JSON.stringify(displayOutput, null, 2)}
            </pre>
          </div>
        )}
        {/* Meta info */}
        {meta && (
          <div className="flex items-center gap-3 pt-2 border-t border-border/50">
            <Badge variant="secondary" className="text-[9px]">
              {(meta.model as string) ?? "gpt-4.1-mini"}
            </Badge>
            {meta.latencyMs && (
              <span className="text-[9px] text-muted-foreground font-[IBM_Plex_Mono]">
                {((meta.latencyMs as number) / 1000).toFixed(1)}s
              </span>
            )}
            {meta.tokens && (
              <span className="text-[9px] text-muted-foreground font-[IBM_Plex_Mono]">
                {meta.tokens as number} tokens
              </span>
            )}
          </div>
        )}
        {/* Action Buttons */}
        {actionButtons.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <p className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground mb-2">Generate Artifacts</p>
            <div className="flex flex-wrap gap-2">
              {actionButtons.map((btn) => (
                <Button
                  key={btn.action}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] border-[oklch(0.35_0.10_85)] text-[oklch(0.75_0.15_85)] hover:bg-[oklch(0.75_0.15_85)]/10"
                  disabled={generatingArtifact === `${stageId}-${btn.action}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateArtifact(stageId, btn.action, output);
                  }}
                >
                  {generatingArtifact === `${stageId}-${btn.action}` ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    btn.icon
                  )}
                  <span className="ml-1">{btn.label}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold font-[Sora] text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
              Mission Control
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Launching <span className="text-[oklch(0.75_0.15_85)] font-semibold">{businessName}</span>
              <span className="text-muted-foreground/50 ml-2 font-[IBM_Plex_Mono] text-[10px]">
                EXE-{executionId}
              </span>
            </p>
          </div>
          {isComplete && (
            <Button
              onClick={onNewLaunch}
              variant="outline"
              size="sm"
              className="text-xs border-[oklch(0.45_0.12_85)] text-[oklch(0.75_0.15_85)]"
            >
              <Rocket className="w-3 h-3 mr-1" />
              New Launch
            </Button>
          )}
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground">
              Pipeline Progress
            </span>
            <span className="text-[10px] font-[IBM_Plex_Mono] text-[oklch(0.75_0.15_85)]">
              {Math.round(overallProgress)}%
            </span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>{stages.filter((s) => s.status === "complete").length} of {stages.length} stages complete</span>
            {!isComplete && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Agents working...
              </span>
            )}
            {isComplete && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                Pipeline complete
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stage Cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {stages.map((stage, index) => {
            const isExpanded = expandedStages.has(stage.id);
            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08, duration: 0.3 }}
              >
                <Card
                  className={`transition-all duration-300 cursor-pointer ${getStatusColor(stage.status)} ${
                    stage.status === "running" ? "ring-1 ring-blue-400/30" : ""
                  }`}
                  onClick={() => toggleStage(stage.id)}
                >
                  <CardContent className="p-4">
                    {/* Stage Header */}
                    <div className="flex items-center gap-3">
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {getStatusIcon(stage.status)}
                      </div>

                      {/* Stage Icon */}
                      <div className={`flex-shrink-0 ${stage.status === "pending" ? "opacity-30" : "opacity-100"}`}>
                        {stage.icon}
                      </div>

                      {/* Stage Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-semibold font-[Sora] ${
                            stage.status === "pending" ? "text-muted-foreground/50" : "text-foreground"
                          }`}>
                            {stage.label}
                          </h3>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] ${
                              stage.status === "running"
                                ? "bg-blue-400/20 text-blue-400"
                                : stage.status === "complete"
                                ? "bg-emerald-400/20 text-emerald-400"
                                : stage.status === "failed"
                                ? "bg-red-400/20 text-red-400"
                                : "bg-muted text-muted-foreground/50"
                            }`}
                          >
                            {stage.status === "running" ? "PROCESSING" : stage.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{stage.description}</p>
                      </div>

                      {/* Expand Arrow */}
                      {stage.output && (
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Running Indicator */}
                    {stage.status === "running" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 pt-3 border-t border-blue-400/20"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-blue-400"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] text-blue-400 font-[IBM_Plex_Mono]">
                            Agent analyzing your business details...
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {/* Expanded Output */}
                    <AnimatePresence>
                      {isExpanded && stage.output && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-3 pt-3 border-t border-border/50"
                        >
                          {formatOutput(stage.output, stage.id)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Completion Summary */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6"
        >
          <Card className="bg-gradient-to-r from-emerald-400/10 to-[oklch(0.75_0.15_85)]/10 border-emerald-400/30">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-lg font-bold font-[Sora] text-foreground mb-1">
                Launch Plan Complete
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Your personalized launch plan for <span className="text-[oklch(0.75_0.15_85)] font-semibold">{businessName}</span> is ready.
                Expand each stage above to review the detailed recommendations.
              </p>
              <Button
                onClick={onNewLaunch}
                variant="outline"
                className="border-[oklch(0.45_0.12_85)] text-[oklch(0.75_0.15_85)]"
              >
                <Rocket className="w-4 h-4 mr-2" />
                Launch Another Business
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main Pipeline Page ──────────────────────────────────────────────────────

export default function Pipeline() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<PipelineView>("intake");
  const [stages, setStages] = useState<StageStatus[]>([]);
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // tRPC mutation for launching the full pipeline
  const launchPipeline = trpc.agentRegistry.launchPipeline.useMutation();
  const runExecution = trpc.execution.run.useMutation();

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const connectSSE = useCallback((execId: number) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const baseUrl = window.location.origin;
    const es = new EventSource(`${baseUrl}/api/execute/${execId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "step_start") {
          setStages((prev) =>
            prev.map((s) =>
              s.agentId === data.agentId
                ? { ...s, status: "running" as const, startedAt: Date.now(), stepId: data.stepId }
                : s
            )
          );
        }

        if (data.type === "step_complete") {
          setStages((prev) =>
            prev.map((s) =>
              s.stepId === data.stepId || s.agentId === data.agentId
                ? {
                    ...s,
                    status: "complete" as const,
                    output: data.output ?? null,
                    completedAt: Date.now(),
                  }
                : s
            )
          );
        }

        if (data.type === "step_failed") {
          setStages((prev) =>
            prev.map((s) =>
              s.stepId === data.stepId || s.agentId === data.agentId
                ? { ...s, status: "failed" as const, completedAt: Date.now() }
                : s
            )
          );
        }

        if (data.type === "workflow_complete" || data.type === "workflow_failed") {
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // SSE will auto-reconnect, but if the workflow is done we close
      setTimeout(() => {
        setStages((prev) => {
          const allDone = prev.every((s) => s.status === "complete" || s.status === "failed");
          if (allDone && prev.length > 0) {
            es.close();
          }
          return prev;
        });
      }, 5000);
    };
  }, []);

  const handleSubmit = async (formData: IntakeFormData) => {
    setIsSubmitting(true);
    setBusinessName(formData.businessName);

    // Initialize stages
    const initialStages: StageStatus[] = PIPELINE_STAGES.map((s) => ({
      ...s,
      status: "pending" as const,
      output: null,
      startedAt: null,
      completedAt: null,
    }));
    setStages(initialStages);

    try {
      // Call the new launchPipeline mutation
      const result = await launchPipeline.mutateAsync({
        businessName: formData.businessName,
        industry: formData.industry,
        targetMarket: formData.targetMarket,
        businessModel: formData.businessModel,
        goals: formData.goals,
        budgetRange: formData.budgetRange || undefined,
        timeline: formData.timeline || undefined,
      });

      setExecutionId(result.executionId);
      setView("running");

      // Connect SSE for real-time updates
      connectSSE(result.executionId);

      // Trigger the execution engine
      await runExecution.mutateAsync({ executionId: result.executionId });

      toast.success("Pipeline launched — agents are working on your business plan");
    } catch (err) {
      toast.error(`Launch failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setView("intake");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewLaunch = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setView("intake");
    setStages([]);
    setExecutionId(null);
    setBusinessName("");
  };

  const overallProgress = stages.length > 0
    ? (stages.filter((s) => s.status === "complete").length / stages.length) * 100
    : 0;
  const isComplete = stages.length > 0 && stages.every((s) => s.status === "complete" || s.status === "failed");

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold font-[Sora] text-foreground flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
            Launch Pipeline
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            AI-powered business launch across 6 critical dimensions
          </p>
        </div>
        {view === "running" && !isComplete && (
          <Badge className="bg-blue-400/20 text-blue-400 border-blue-400/30 animate-pulse">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Pipeline Active
          </Badge>
        )}
      </div>

      {/* Content */}
      {view === "intake" && (
        <IntakeForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      )}

      {(view === "running") && executionId && (
        <MissionControl
          stages={stages}
          businessName={businessName}
          executionId={executionId}
          overallProgress={overallProgress}
          isComplete={isComplete}
          onNewLaunch={handleNewLaunch}
        />
      )}
    </div>
  );
}
