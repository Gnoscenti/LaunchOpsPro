/**
 * Runbook — Operations runbook viewer for Atlas workflows
 * Triggers, pre-checks, step-by-step actions, retries, circuit breakers, observability
 */
import { motion } from "framer-motion";
import { BookOpen, Play, RefreshCw, ShieldAlert, Eye, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const runbookSections = [
  {
    title: "Triggers & Inputs",
    icon: <Play size={14} className="text-[oklch(0.75_0.15_85)]" />,
    items: [
      "CLI command: `python launchops.py launch`",
      "Build Spec JSON file or interactive intake",
      "Environment variables loaded from .env",
      "Credential vault decrypted and validated",
    ],
  },
  {
    title: "Pre-Checks",
    icon: <CheckCircle size={14} className="text-emerald-400" />,
    items: [
      "Verify all required secrets are configured in vault",
      "Test LLM API connectivity (OpenAI / Anthropic)",
      "Validate SSH connectivity to target servers (if infra workflow)",
      "Check disk space for output directory",
      "Verify Docker daemon is running (if deployment workflow)",
    ],
  },
  {
    title: "Retry & Backoff Strategy",
    icon: <RefreshCw size={14} className="text-blue-400" />,
    items: [
      "Default: 2 retries per step with exponential backoff (2s, 8s, 32s)",
      "LLM calls: 3 retries with jitter to avoid rate limit storms",
      "SSH operations: 3 retries with 10s fixed delay",
      "Idempotency: all agents check for existing outputs before re-executing",
    ],
  },
  {
    title: "Circuit Breaker Rules",
    icon: <ShieldAlert size={14} className="text-red-400" />,
    items: [
      "If 3 consecutive steps fail: pause workflow, notify via log",
      "If LLM returns empty or malformed output: flag and skip to next step",
      "If SSH connection fails 3x: mark all infra agents as unavailable",
      "If vault decryption fails: halt all execution immediately",
      "Manual override: `python launchops.py resume --from <step_id>`",
    ],
  },
  {
    title: "Observability",
    icon: <Eye size={14} className="text-purple-400" />,
    items: [
      "Structured JSON logs: ~/.atlas/audit.log",
      "Per-step timing: start, end, duration logged to context",
      "Agent output artifacts saved to ~/launchops-output/<workflow_id>/",
      "Documentary tracker captures all milestones automatically",
      "Real-time status: `python launchops.py status`",
    ],
  },
  {
    title: "Rollback Procedures",
    icon: <AlertCircle size={14} className="text-amber-400" />,
    items: [
      "Each step output is versioned — rollback to any previous step state",
      "Infrastructure: deploy.sh supports `--rollback` flag",
      "Legal documents: regenerate from cached Build Spec (no re-intake needed)",
      "Database: no destructive operations — all writes are append-only",
      "Git: all code changes committed atomically per workflow execution",
    ],
  },
];

export default function Runbook() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-[Sora] font-bold text-foreground flex items-center gap-2">
          <BookOpen size={24} className="text-[oklch(0.75_0.15_85)]" />
          Operations Runbook
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Standard operating procedures for Atlas workflow execution
        </p>
      </div>

      {/* Runbook Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {runbookSections.map((section, si) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.08 }}
          >
            <Card className="bg-card border-border h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-[Sora] text-foreground flex items-center gap-2">
                  {section.icon}
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-sm border border-border/50 bg-[oklch(0.14_0.005_250)]">
                      <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-[11px] text-foreground font-[IBM_Plex_Mono] leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Reference */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-[Sora] text-foreground">Quick Reference Commands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-[oklch(0.10_0.005_250)] rounded-sm p-4 font-[IBM_Plex_Mono] text-[11px] space-y-1">
            {[
              { cmd: "python launchops.py launch", desc: "Execute full pipeline" },
              { cmd: "python launchops.py status", desc: "Check system health" },
              { cmd: "python launchops.py coach", desc: "Start ExecAI coaching session" },
              { cmd: "python launchops.py paperwork", desc: "Generate legal documents" },
              { cmd: "python launchops.py formation", desc: "Run formation optimizer" },
              { cmd: "python launchops.py resume --from <step>", desc: "Resume from specific step" },
              { cmd: "./deploy.sh --domain <domain>", desc: "Deploy Docker stack" },
              { cmd: "./deploy.sh --rollback", desc: "Rollback last deployment" },
            ].map((ref) => (
              <div key={ref.cmd} className="flex items-center gap-4">
                <span className="text-[oklch(0.75_0.15_85)] shrink-0">$</span>
                <span className="text-emerald-400 shrink-0 w-80">{ref.cmd}</span>
                <span className="text-muted-foreground"># {ref.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
