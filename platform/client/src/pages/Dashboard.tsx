/**
 * Dashboard — Atlas Command Center
 * Wired to real tRPC data from database
 */
import { motion } from "framer-motion";
import {
  GitBranch, Bot, Key, Shield, Play, CheckCircle2,
  ArrowRight, Zap, AlertTriangle, XCircle, Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5 } }),
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: trust, isLoading: trustLoading } = trpc.dashboard.trust.useQuery();
  const { data: logs } = trpc.log.recent.useQuery({ limit: 8 });
  const { data: workflows } = trpc.workflow.list.useQuery();
  const { data: agentStats } = trpc.agentRegistry.stats.useQuery();

  const isLoading = statsLoading || trustLoading;

  // Build metrics from real data
  const dashboardMetrics = stats ? [
    { id: "m-1", label: "Workflows", value: String(stats.workflows), change: `${stats.workflows} defined`, changeType: "neutral" as const, icon: "GitBranch" },
    { id: "m-2", label: "Agents", value: String(agentStats?.totalAgents ?? 24), change: `${agentStats?.byExecutionMode?.llm ?? 8} LLM`, changeType: "positive" as const, icon: "Bot" },
    { id: "m-3", label: "Credentials", value: String(stats.credentials), change: stats.credentials > 0 ? "Configured" : "None set", changeType: stats.credentials > 0 ? "positive" as const : "negative" as const, icon: "Key" },
    { id: "m-4", label: "Trust Score", value: String(trust?.overall ?? 0), change: (trust?.overall ?? 0) >= 80 ? "Healthy" : "Needs attention", changeType: (trust?.overall ?? 0) >= 80 ? "positive" as const : "negative" as const, icon: "Shield" },
    { id: "m-5", label: "Completed", value: String(stats.completed), change: stats.failed > 0 ? `${stats.failed} failed` : "No failures", changeType: stats.failed > 0 ? "negative" as const : "positive" as const, icon: "CheckCircle2" },
    { id: "m-6", label: "Executions", value: String(stats.executions), change: stats.running > 0 ? `${stats.running} running` : "Ready", changeType: stats.running > 0 ? "positive" as const : "neutral" as const, icon: "Play" },
  ] : [];

  const iconMap: Record<string, React.ReactNode> = {
    GitBranch: <GitBranch size={18} />, Bot: <Bot size={18} />, Key: <Key size={18} />,
    Shield: <Shield size={18} />, CheckCircle2: <CheckCircle2 size={18} />, Play: <Play size={18} />,
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[oklch(0.75_0.15_85)]" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-sm border border-border"
        style={{
          backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/95992963/VVszexVYyhZkgVBeKxadSN/atlas-command-center-crFMmSmPeVWfHhzTE4LUAr.webp)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.12_0.005_250_/_92%)] via-[oklch(0.12_0.005_250_/_75%)] to-[oklch(0.12_0.005_250_/_50%)]" />
        <div className="relative z-10 p-8 lg:p-10">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-[oklch(0.75_0.15_85)]" />
            <span className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-[0.2em] text-[oklch(0.75_0.15_85)]">
              Atlas Orchestrator v2.1
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-[Sora] font-bold text-foreground mb-3">
            Command Center
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            AI-powered business orchestration. {stats?.workflows ?? 0} workflows defined, {agentStats?.totalAgents ?? 24} agents registered, {stats?.executions ?? 0} executions tracked.
          </p>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {dashboardMetrics.map((metric, i) => (
          <motion.div key={metric.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
            <Card className="bg-card border-border hover:border-[oklch(0.75_0.15_85_/_30%)] transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">{iconMap[metric.icon] || <Play size={18} />}</span>
                  <span
                    className={`text-[10px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm ${
                      metric.changeType === "positive"
                        ? "text-emerald-400 bg-emerald-400/10"
                        : metric.changeType === "negative"
                        ? "text-red-400 bg-red-400/10"
                        : "text-muted-foreground bg-muted"
                    }`}
                  >
                    {metric.change}
                  </span>
                </div>
                <p className="text-xl font-[Sora] font-bold text-foreground">{metric.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{metric.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Three-column: Workflows + Trust + Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflows */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-[Sora] text-foreground">Workflows</CardTitle>
              <Link href="/pipeline">
                <span className="text-xs text-[oklch(0.75_0.15_85)] hover:underline flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(workflows ?? []).slice(0, 5).map((wf) => (
              <div key={wf.id} className="p-3 rounded-sm border border-border bg-[oklch(0.14_0.005_250)] hover:border-[oklch(0.75_0.15_85_/_20%)] transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-foreground truncate">{wf.name}</p>
                  <span className={`text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm ${
                    wf.status === "draft" ? "text-muted-foreground bg-muted" 
                    : wf.status === "active" ? "text-[oklch(0.75_0.15_85)] bg-[oklch(0.75_0.15_85_/_10%)]"
                    : "text-zinc-400 bg-zinc-400/10"
                  }`}>
                    {wf.status}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">v{wf.version}</p>
              </div>
            ))}
            {(!workflows || workflows.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">No workflows yet. <Link href="/pipeline"><span className="text-[oklch(0.75_0.15_85)] hover:underline">Create one</span></Link></p>
            )}
          </CardContent>
        </Card>

        {/* Trust Score */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-[Sora] text-foreground flex items-center gap-2">
                <Shield size={14} className="text-[oklch(0.75_0.15_85)]" />
                Synthetic Trust
              </CardTitle>
              <Link href="/trust">
                <span className="text-xs text-[oklch(0.75_0.15_85)] hover:underline flex items-center gap-1">
                  Details <ArrowRight size={12} />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {/* Trust Ring */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(0.20 0.005 250)" strokeWidth="6" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(0.75 0.15 85)" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${(trust?.overall ?? 0) * 2.64} ${264 - (trust?.overall ?? 0) * 2.64}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-[Sora] font-bold text-[oklch(0.75_0.15_85)]">{trust?.overall ?? 0}</span>
                  <span className="text-[8px] font-[IBM_Plex_Mono] text-muted-foreground">TRUST</span>
                </div>
              </div>
            </div>
            {/* Cert levels */}
            <div className="space-y-2">
              {(trust?.certifications ?? []).map((cert) => (
                <div key={cert.level} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    cert.status === "complete" ? "bg-emerald-500/20 text-emerald-400"
                    : cert.status === "in-progress" ? "bg-[oklch(0.75_0.15_85_/_20%)] text-[oklch(0.75_0.15_85)]"
                    : "bg-muted text-muted-foreground"
                  }`}>{cert.level}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-foreground">{cert.name}</p>
                      <span className="text-[8px] font-[IBM_Plex_Mono] text-muted-foreground">{cert.progress}%</span>
                    </div>
                    <div className="w-full h-0.5 bg-[oklch(0.20_0.005_250)] rounded-full mt-0.5">
                      <div className="h-full rounded-full" style={{
                        width: `${cert.progress}%`,
                        backgroundColor: cert.status === "complete" ? "oklch(0.65 0.18 160)" : "oklch(0.75 0.15 85)",
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Logs */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-[Sora] text-foreground">System Log</CardTitle>
              <Link href="/orchestrator">
                <span className="text-xs text-[oklch(0.75_0.15_85)] hover:underline flex items-center gap-1">
                  Full log <ArrowRight size={12} />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 font-[IBM_Plex_Mono] text-[10px]">
              {(logs ?? []).slice(0, 8).map((log) => {
                const levelColors: Record<string, string> = {
                  info: "text-blue-400", warn: "text-amber-400", error: "text-red-400",
                  debug: "text-muted-foreground",
                };
                const levelIcons: Record<string, React.ReactNode> = {
                  error: <XCircle size={10} className="text-red-400" />,
                  warn: <AlertTriangle size={10} className="text-amber-400" />,
                };
                return (
                  <div key={log.id} className="flex gap-2 py-1 border-b border-border/50 last:border-0">
                    <span className={`shrink-0 uppercase w-10 ${levelColors[log.level] || "text-muted-foreground"}`}>
                      {log.level}
                    </span>
                    <span className="text-foreground/80 truncate">{log.message}</span>
                  </div>
                );
              })}
              {(!logs || logs.length === 0) && (
                <p className="text-muted-foreground text-center py-4">No execution logs yet. Run a workflow to see activity.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Grid — from real registry */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-[Sora] font-semibold text-foreground">Agent Registry</h2>
          <Link href="/agents">
            <span className="text-xs text-[oklch(0.75_0.15_85)] hover:underline flex items-center gap-1">
              Manage agents <ArrowRight size={12} />
            </span>
          </Link>
        </div>
        <AgentPreviewGrid />
      </div>
    </div>
  );
}

/** Compact agent grid preview — pulls from real registry */
function AgentPreviewGrid() {
  const { data: agents } = trpc.agentRegistry.list.useQuery();
  const displayAgents = (agents ?? []).slice(0, 10);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
      {displayAgents.map((agent, i) => (
        <motion.div key={agent.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
          <div className={`p-3 rounded-sm border transition-colors ${
            agent.executionMode === "llm"
              ? "border-[oklch(0.75_0.15_85_/_20%)] bg-[oklch(0.75_0.15_85_/_5%)]"
              : "border-border bg-[oklch(0.14_0.005_250)]"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <Bot size={14} className={agent.executionMode === "llm" ? "text-[oklch(0.75_0.15_85)]" : "text-muted-foreground"} />
              <span className={`w-1.5 h-1.5 rounded-full ${
                agent.executionMode === "llm" ? "bg-emerald-400" 
                : agent.executionMode === "hybrid" ? "bg-amber-400"
                : "bg-blue-400"
              }`} />
            </div>
            <p className="text-xs font-medium text-foreground truncate">{agent.name}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{agent.category}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
