/**
 * PilotScope — Generate pilot scope documents for any Atlas workflow
 * Wired to real tRPC workflow data
 */
import { motion } from "framer-motion";
import { FileText, Target, BarChart3, Clock, AlertTriangle, CheckSquare, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function PilotScope() {
  const { data: workflowDetails, isLoading } = trpc.dashboard.workflowDetails.useQuery();
  const { data: metrics } = trpc.dashboard.metrics.useQuery();
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const pilotConfig = {
    duration: "2 weeks",
    objective: "Validate workflow execution, measure cycle time reduction, and identify failure modes",
    successMetrics: [
      { metric: "Workflow Completion Rate", target: ">95%", current: metrics ? `${metrics.successRate}%` : "—" },
      { metric: "Average Step Execution Time", target: "<5 min", current: metrics?.avgDurationMs ? `${Math.round(metrics.avgDurationMs / 60000)}m` : "—" },
      { metric: "Error Rate", target: "<2%", current: metrics ? `${100 - metrics.successRate}%` : "—" },
      { metric: "Steps Completed", target: ">100", current: metrics ? String(metrics.totalStepsExecuted) : "—" },
      { metric: "Total Executions", target: ">10", current: stats ? String(stats.executions) : "—" },
    ],
    phases: [
      { day: "1-2", activity: "Environment setup, credential configuration, agent validation", status: "pending" },
      { day: "3-5", activity: "Execute workflow in dry-run mode, log all agent outputs", status: "pending" },
      { day: "6-8", activity: "Live execution with human-in-the-loop checkpoints", status: "pending" },
      { day: "9-11", activity: "Full autonomous execution, monitor error rates and SLAs", status: "pending" },
      { day: "12-14", activity: "Analysis, reporting, exit criteria evaluation", status: "pending" },
    ],
    risks: [
      "API rate limits may throttle agent execution during peak hours",
      "LLM output quality variance on legal document generation",
      "SSH key rotation during pilot could interrupt infrastructure agents",
      "External service downtime (Stripe, GitHub) outside our control",
    ],
    exitCriteria: [
      "All success metrics met or exceeded",
      "Zero critical failures in final 48 hours",
      "All generated documents pass manual review",
      "Audit log completeness verified",
    ],
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[Sora] font-bold text-foreground flex items-center gap-2">
            <FileText size={24} className="text-[oklch(0.75_0.15_85)]" />
            Pilot Scope
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and track pilot scope for any Atlas workflow
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-[oklch(0.75_0.15_85_/_30%)] text-[oklch(0.75_0.15_85)]"
          onClick={() => toast("Export to PDF coming soon")}
        >
          Export Scope Doc
        </Button>
      </div>

      {/* Workflow Selector */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-[Sora] text-foreground">Select Workflow for Pilot</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[oklch(0.75_0.15_85)]" size={20} /></div>
          ) : (!workflowDetails || workflowDetails.length === 0) ? (
            <p className="text-xs text-muted-foreground text-center py-6">No workflows defined yet. Create workflows to generate pilot scope.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {workflowDetails.map((wf) => (
                <button
                  key={wf.id}
                  className="p-3 rounded-sm border border-border bg-[oklch(0.14_0.005_250)] hover:border-[oklch(0.75_0.15_85_/_30%)] transition-colors text-left"
                >
                  <p className="text-xs font-medium text-foreground">{wf.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{wf.stepCount} steps &middot; v{wf.version}</p>
                  {wf.lastExecution && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">Last run: {wf.lastExecution.status}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Objective + Duration */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-[Sora] text-foreground flex items-center gap-2">
              <Target size={14} className="text-[oklch(0.75_0.15_85)]" />
              Pilot Objective
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-sm border border-border bg-[oklch(0.14_0.005_250)] mb-4">
              <p className="text-xs text-foreground leading-relaxed">{pilotConfig.objective}</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Duration:</span>
              <span className="text-xs font-[Sora] font-semibold text-foreground">{pilotConfig.duration}</span>
            </div>
          </CardContent>
        </Card>

        {/* Success Metrics */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-[Sora] text-foreground flex items-center gap-2">
              <BarChart3 size={14} className="text-[oklch(0.75_0.15_85)]" />
              Success Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pilotConfig.successMetrics.map((sm) => (
                <div key={sm.metric} className="flex items-center justify-between p-2.5 rounded-sm border border-border bg-[oklch(0.14_0.005_250)]">
                  <span className="text-xs text-foreground">{sm.metric}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-[IBM_Plex_Mono] text-[oklch(0.75_0.15_85)]">{sm.target}</span>
                    <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground">{sm.current}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Day-by-Day Plan */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-[Sora] text-foreground">Execution Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pilotConfig.phases.map((phase, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4 p-3 rounded-sm border border-border bg-[oklch(0.14_0.005_250)]"
              >
                <span className="text-xs font-[IBM_Plex_Mono] text-[oklch(0.75_0.15_85)] w-12 shrink-0">D{phase.day}</span>
                <span className="text-xs text-foreground flex-1">{phase.activity}</span>
                <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground px-1.5 py-0.5 rounded-sm bg-muted">{phase.status}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risks */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-[Sora] text-foreground flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400" />
              Risks & Assumptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pilotConfig.risks.map((risk, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-sm border border-amber-500/10 bg-amber-500/5">
                  <AlertTriangle size={10} className="text-amber-400 mt-0.5 shrink-0" />
                  <span className="text-[11px] text-foreground">{risk}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exit Criteria */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-[Sora] text-foreground flex items-center gap-2">
              <CheckSquare size={14} className="text-emerald-400" />
              Exit Criteria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pilotConfig.exitCriteria.map((criteria, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-sm border border-emerald-500/10 bg-emerald-500/5">
                  <CheckSquare size={10} className="text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-[11px] text-foreground">{criteria}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
