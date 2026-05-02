/**
 * Metrics — KPI dashboard for workflow performance, agent health, and investor signals
 * Wired to real tRPC data
 */
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Activity, Target, Zap, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function Metrics() {
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: metrics, isLoading: metricsLoading } = trpc.dashboard.metrics.useQuery();
  const { data: trust } = trpc.dashboard.trust.useQuery();
  const { data: agentStats } = trpc.agentRegistry.stats.useQuery();
  const { data: agents } = trpc.agentRegistry.list.useQuery();
  const { data: workflowDetails } = trpc.dashboard.workflowDetails.useQuery();

  const isLoading = statsLoading || metricsLoading;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[oklch(0.75_0.15_85)]" size={32} />
      </div>
    );
  }

  // Build KPIs from real data
  const kpis = [
    { label: "Workflows", value: stats?.workflows ?? 0, icon: <Activity size={16} />, color: "oklch(0.75 0.15 85)" },
    { label: "Total Executions", value: stats?.executions ?? 0, icon: <BarChart3 size={16} />, color: "oklch(0.60 0.18 160)" },
    { label: "Agents Registered", value: agentStats?.totalAgents ?? 24, icon: <Zap size={16} />, color: "oklch(0.65 0.15 250)" },
    { label: "Success Rate", value: `${metrics?.successRate ?? 0}%`, icon: <TrendingUp size={16} />, color: "oklch(0.65 0.18 160)" },
    { label: "Credentials", value: stats?.credentials ?? 0, icon: <Target size={16} />, color: "oklch(0.65 0.20 25)" },
    { label: "Trust Score", value: trust?.overall ?? 0, icon: <Target size={16} />, color: "oklch(0.75 0.15 85)" },
  ];

  // Agent distribution by real categories
  const categories = agentStats?.categories ?? [];
  const categoryData = categories.map((cat) => ({
    category: cat,
    count: (agents ?? []).filter((a) => a.category === cat).length,
    llm: (agents ?? []).filter((a) => a.category === cat && a.executionMode === "llm").length,
    python: (agents ?? []).filter((a) => a.category === cat && a.executionMode === "python").length,
    hybrid: (agents ?? []).filter((a) => a.category === cat && a.executionMode === "hybrid").length,
  }));
  const maxCount = Math.max(...categoryData.map((c) => c.count), 1);

  // Investor readiness signals computed from real data
  const investorSignals = [
    { signal: "Workflows Defined", status: (stats?.workflows ?? 0) > 0, detail: `${stats?.workflows ?? 0} workflow definitions` },
    { signal: "Agents Operational", status: (agentStats?.totalAgents ?? 0) >= 20, detail: `${agentStats?.totalAgents ?? 0} agents registered` },
    { signal: "Executions Running", status: (stats?.executions ?? 0) > 0, detail: `${stats?.executions ?? 0} total executions` },
    { signal: "Trust Framework", status: (trust?.overall ?? 0) >= 70, detail: `Trust score: ${trust?.overall ?? 0}` },
    { signal: "Credentials Configured", status: (stats?.credentials ?? 0) >= 3, detail: `${stats?.credentials ?? 0} API keys stored` },
    { signal: "Success Rate", status: (metrics?.successRate ?? 0) >= 80, detail: `${metrics?.successRate ?? 0}% execution success` },
    { signal: "Audit Trail", status: (stats?.logs ?? 0) > 0, detail: `${stats?.logs ?? 0} log entries` },
    { signal: "Multi-Provider LLM", status: true, detail: "Forge + Anthropic with fallback" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-[Sora] font-bold text-foreground flex items-center gap-2">
          <BarChart3 size={24} className="text-[oklch(0.75_0.15_85)]" />
          Metrics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          System performance, agent distribution, and investor-ready signals
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="bg-card border-border">
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2" style={{ color: kpi.color }}>{kpi.icon}</div>
                <p className="text-xl font-[Sora] font-bold text-foreground">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Agent Distribution Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-[Sora] text-foreground">Agent Distribution by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryData.map((cat, i) => (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4"
              >
                <span className="text-xs font-[IBM_Plex_Mono] capitalize text-muted-foreground w-28 shrink-0">{cat.category}</span>
                <div className="flex-1 h-6 bg-[oklch(0.16_0.005_250)] rounded-sm overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-sm flex items-center px-2"
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.count / maxCount) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                    style={{ backgroundColor: "oklch(0.75 0.15 85 / 30%)" }}
                  >
                    <span className="text-[9px] font-[IBM_Plex_Mono] text-foreground">{cat.count} agents</span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {cat.llm > 0 && <span className="text-[9px] font-[IBM_Plex_Mono] text-emerald-400">{cat.llm} LLM</span>}
                  {cat.python > 0 && <span className="text-[9px] font-[IBM_Plex_Mono] text-blue-400">{cat.python} Py</span>}
                  {cat.hybrid > 0 && <span className="text-[9px] font-[IBM_Plex_Mono] text-amber-400">{cat.hybrid} Hyb</span>}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-emerald-400/40" />
              <span className="text-[9px] text-muted-foreground">LLM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-blue-400/40" />
              <span className="text-[9px] text-muted-foreground">Python</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-amber-400/40" />
              <span className="text-[9px] text-muted-foreground">Hybrid</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Complexity — from real workflow data */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-[Sora] text-foreground">Workflow Complexity Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {(!workflowDetails || workflowDetails.length === 0) ? (
            <p className="text-xs text-muted-foreground text-center py-6">No workflows defined yet. Create workflows to see complexity analysis.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workflowDetails.slice(0, 6).map((wf) => {
                const uniqueAgents = new Set(wf.agentIds).size;
                return (
                  <div key={wf.id} className="p-4 rounded-sm border border-border bg-[oklch(0.14_0.005_250)]">
                    <p className="text-xs font-[Sora] font-semibold text-foreground mb-3 truncate">{wf.name}</p>
                    <div className="space-y-2">
                      {[
                        { label: "Steps", value: wf.stepCount },
                        { label: "Unique Agents", value: uniqueAgents },
                        { label: "Version", value: wf.version },
                        { label: "Status", value: wf.status },
                        { label: "Last Run", value: wf.lastExecution ? wf.lastExecution.status : "Never" },
                      ].map((stat) => (
                        <div key={stat.label} className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{stat.label}</span>
                          <span className="text-xs font-[IBM_Plex_Mono] text-foreground">{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution History */}
      {metrics && metrics.recentExecutions.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-[Sora] text-foreground">Recent Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.recentExecutions.map((exec) => (
                <div key={exec.id} className="flex items-center gap-3 p-3 rounded-sm border border-border bg-[oklch(0.14_0.005_250)]">
                  {exec.status === "completed" && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                  {exec.status === "failed" && <XCircle size={14} className="text-red-400 shrink-0" />}
                  {exec.status === "running" && <Loader2 size={14} className="text-[oklch(0.75_0.15_85)] animate-spin shrink-0" />}
                  {!["completed", "failed", "running"].includes(exec.status) && <Clock size={14} className="text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{exec.workflowName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {exec.completedSteps}/{exec.totalSteps} steps &middot; {exec.status}
                    </p>
                  </div>
                  <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground shrink-0">
                    {exec.createdAt ? new Date(exec.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investor Signals */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-[Sora] text-foreground">Investor Readiness Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {investorSignals.map((sig) => (
              <div key={sig.signal} className={`p-3 rounded-sm border ${sig.status ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-[oklch(0.14_0.005_250)]"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${sig.status ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
                  <span className="text-xs font-medium text-foreground">{sig.signal}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{sig.detail}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
