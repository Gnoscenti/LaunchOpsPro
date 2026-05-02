/**
 * Agent Registry — Full management UI for the 20-agent fleet.
 * Powered by tRPC agentRegistry router (real data, not mocks).
 *
 * Features:
 *   - Stats header with live counts
 *   - Search by name, description, tags
 *   - Filter by category, capability, execution mode
 *   - Grid / list toggle
 *   - Expandable detail panel per agent
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Search,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  Cpu,
  Brain,
  Zap,
  Clock,
  Key,
  Link2,
  FileText,
  Layers,
  Shield,
  CreditCard,
  Mail,
  BarChart,
  TrendingUp,
  GitBranch,
  MessageSquare,
  FolderOpen,
  Film,
  KanbanSquare,
  Server,
  Globe,
  Workflow,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { QuickLaunchDialog } from "@/components/QuickLaunchDialog";
import { Rocket, Activity, AlertCircle, CheckCircle2 } from "lucide-react";

// ─── Icon resolver ──────────────────────────────────────────────────────────

const iconMap: Record<string, React.ElementType> = {
  FileText,
  Layers,
  Shield,
  CreditCard,
  Mail,
  BarChart,
  TrendingUp,
  GitBranch,
  MessageSquare,
  FolderOpen,
  Film,
  KanbanSquare,
  Server,
  Globe,
  Workflow,
  Bot,
  Brain,
  Cpu,
  Sparkles,
};

function AgentIcon({ name, className }: { name: string; className?: string }) {
  const Icon = iconMap[name] || Bot;
  return <Icon className={className} />;
}

// ─── Category / capability color maps ───────────────────────────────────────

const categoryColors: Record<string, string> = {
  strategic: "text-[oklch(0.75_0.15_85)] bg-[oklch(0.75_0.15_85_/_10%)] border-[oklch(0.75_0.15_85_/_25%)]",
  infrastructure: "text-blue-400 bg-blue-400/10 border-blue-400/25",
  legal: "text-purple-400 bg-purple-400/10 border-purple-400/25",
  marketing: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
  operations: "text-amber-400 bg-amber-400/10 border-amber-400/25",
  payment: "text-pink-400 bg-pink-400/10 border-pink-400/25",
  content: "text-cyan-400 bg-cyan-400/10 border-cyan-400/25",
  communication: "text-indigo-400 bg-indigo-400/10 border-indigo-400/25",
  analytics: "text-orange-400 bg-orange-400/10 border-orange-400/25",
  security: "text-red-400 bg-red-400/10 border-red-400/25",
};

const executionModeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  llm: { label: "LLM", color: "text-violet-400 bg-violet-400/10", icon: Brain },
  python: { label: "Python", color: "text-green-400 bg-green-400/10", icon: Cpu },
  hybrid: { label: "Hybrid", color: "text-amber-400 bg-amber-400/10", icon: Zap },
};

const modelPrefConfig: Record<string, { label: string; color: string }> = {
  fast: { label: "Fast", color: "text-green-400" },
  balanced: { label: "Balanced", color: "text-blue-400" },
  "deep-reasoning": { label: "Deep Reasoning", color: "text-purple-400" },
};

// ─── Agent type from tRPC ───────────────────────────────────────────────────

type AgentItem = {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  executionMode: string;
  outputFormat: string;
  modelPreference: string;
  persistArtifact: boolean;
  artifactType: string | null;
  requiredContext: string[];
  requiredSecrets: string[];
  tags: string[];
  category: string;
  icon: string;
  estimatedDuration: number | null;
  outputSchemaDescription: string;
  chainableFields: string[];
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Agents() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [capabilityFilter, setCapabilityFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [launchAgent, setLaunchAgent] = useState<AgentItem | null>(null);

  // tRPC queries
  const { data: allAgents, isLoading } = trpc.agentRegistry.list.useQuery();
  const { data: stats } = trpc.agentRegistry.stats.useQuery();
  const { data: routingStats } = trpc.agentRegistry.routingStats.useQuery();
  const quickLaunch = trpc.agentRegistry.quickLaunch.useMutation();
  const [, navigate] = useLocation();

  // Open the dialog instead of launching directly
  const openLaunchDialog = (agentId: string, _agentName: string) => {
    const agent = allAgents?.find((a) => a.id === agentId);
    if (agent) setLaunchAgent(agent);
  };

  // Called from the dialog with full config
  const handleQuickLaunch = async (agentId: string, agentName: string, config?: Record<string, unknown>) => {
    try {
      const result = await quickLaunch.mutateAsync({ agentId, config: config ?? {} });
      setLaunchAgent(null);
      toast.success(`${agentName} launched — redirecting to workflow editor...`);
      navigate(`/editor?workflow=${result.workflowId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not launch agent");
    }
  };

  // Derive filter options from data
  const categories = useMemo(() => {
    if (!allAgents) return [];
    return Array.from(new Set(allAgents.map((a) => a.category))).sort();
  }, [allAgents]);

  const capabilities = useMemo(() => {
    if (!allAgents) return [];
    return Array.from(new Set(allAgents.flatMap((a) => a.capabilities))).sort();
  }, [allAgents]);

  // Client-side filtering (search + category + capability + mode)
  const filtered = useMemo(() => {
    if (!allAgents) return [];
    return allAgents.filter((a) => {
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (capabilityFilter !== "all" && !a.capabilities.includes(capabilityFilter as never)) return false;
      if (modeFilter !== "all" && a.executionMode !== modeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [allAgents, categoryFilter, capabilityFilter, modeFilter, search]);

  const toggleExpand = (id: string) => {
    setExpandedAgent((prev) => (prev === id ? null : id));
  };

  // ─── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-72 bg-muted rounded" />
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-[Sora] font-bold text-foreground flex items-center gap-2.5">
            <Bot size={24} className="text-[oklch(0.75_0.15_85)]" />
            Agent Registry
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats?.totalAgents ?? 0} agents registered across{" "}
            {stats?.categories.length ?? 0} categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("grid")}
            className={viewMode === "grid" ? "bg-[oklch(0.75_0.15_85_/_10%)] border-[oklch(0.75_0.15_85_/_30%)] text-[oklch(0.75_0.15_85)]" : ""}
          >
            <LayoutGrid size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("list")}
            className={viewMode === "list" ? "bg-[oklch(0.75_0.15_85_/_10%)] border-[oklch(0.75_0.15_85_/_30%)] text-[oklch(0.75_0.15_85)]" : ""}
          >
            <List size={14} />
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Bot size={14} className="text-[oklch(0.75_0.15_85)]" />
                <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">Total</span>
              </div>
              <p className="text-2xl font-[Sora] font-bold text-foreground">{stats.totalAgents}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Brain size={14} className="text-violet-400" />
                <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">LLM</span>
              </div>
              <p className="text-2xl font-[Sora] font-bold text-foreground">{stats.byExecutionMode.llm}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Cpu size={14} className="text-green-400" />
                <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">Python</span>
              </div>
              <p className="text-2xl font-[Sora] font-bold text-foreground">{stats.byExecutionMode.python}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Layers size={14} className="text-amber-400" />
                <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">Categories</span>
              </div>
              <p className="text-2xl font-[Sora] font-bold text-foreground">{stats.categories.length}</p>
            </CardContent>
          </Card>

          {/* LLM Provider Health Cards */}
          {routingStats?.providers.map((provider) => (
            <Card key={provider.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {provider.available ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={14} className="text-zinc-500" />
                  )}
                  <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">
                    {provider.id === "forge" ? "Forge" : "Claude"}
                  </span>
                </div>
                <p className={`text-sm font-[Sora] font-bold ${provider.available ? "text-emerald-400" : "text-zinc-500"}`}>
                  {provider.available ? "Online" : "Offline"}
                </p>
                {provider.totalCalls > 0 && (
                  <p className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground mt-0.5">
                    {provider.totalCalls} calls / {Math.round(provider.avgLatencyMs)}ms avg
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Search + Filters ───────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search agents by name, description, or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[oklch(0.75_0.15_85_/_50%)] transition-colors"
          />
        </div>

        {/* Filter rows */}
        <div className="flex flex-wrap gap-4">
          {/* Category filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">Category</span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`text-[10px] font-[IBM_Plex_Mono] px-2 py-0.5 rounded-sm transition-colors ${
                  categoryFilter === "all"
                    ? "bg-[oklch(0.75_0.15_85_/_15%)] text-[oklch(0.75_0.15_85)] border border-[oklch(0.75_0.15_85_/_30%)]"
                    : "bg-muted text-muted-foreground border border-transparent hover:border-border"
                }`}
              >
                all
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`text-[10px] font-[IBM_Plex_Mono] px-2 py-0.5 rounded-sm transition-colors capitalize ${
                    categoryFilter === cat
                      ? `border ${categoryColors[cat] ?? "text-foreground bg-muted border-border"}`
                      : "bg-muted text-muted-foreground border border-transparent hover:border-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Execution mode filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">Mode</span>
            <div className="flex gap-1">
              <button
                onClick={() => setModeFilter("all")}
                className={`text-[10px] font-[IBM_Plex_Mono] px-2 py-0.5 rounded-sm transition-colors ${
                  modeFilter === "all"
                    ? "bg-[oklch(0.75_0.15_85_/_15%)] text-[oklch(0.75_0.15_85)] border border-[oklch(0.75_0.15_85_/_30%)]"
                    : "bg-muted text-muted-foreground border border-transparent hover:border-border"
                }`}
              >
                all
              </button>
              {(["llm", "python", "hybrid"] as const).map((mode) => {
                const cfg = executionModeConfig[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => setModeFilter(mode)}
                    className={`text-[10px] font-[IBM_Plex_Mono] px-2 py-0.5 rounded-sm transition-colors ${
                      modeFilter === mode
                        ? `${cfg.color} border border-current/25`
                        : "bg-muted text-muted-foreground border border-transparent hover:border-border"
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capability filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">Capability</span>
            <select
              value={capabilityFilter}
              onChange={(e) => setCapabilityFilter(e.target.value)}
              className="text-[10px] font-[IBM_Plex_Mono] px-2 py-1 rounded-sm bg-muted text-muted-foreground border border-border focus:outline-none focus:border-[oklch(0.75_0.15_85_/_50%)]"
            >
              <option value="all">all</option>
              {capabilities.map((cap) => (
                <option key={cap} value={cap}>{cap}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Result count */}
        <p className="text-[10px] font-[IBM_Plex_Mono] text-muted-foreground">
          Showing {filtered.length} of {allAgents?.length ?? 0} agents
        </p>
      </div>

      {/* ── Agent Grid / List ──────────────────────────────────────────── */}
      <div className={
        viewMode === "grid"
          ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          : "flex flex-col gap-3"
      }>
        <AnimatePresence mode="popLayout">
          {filtered.map((agent, i) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={i}
              viewMode={viewMode}
              isExpanded={expandedAgent === agent.id}
              onToggle={() => toggleExpand(agent.id)}
              onQuickLaunch={openLaunchDialog}
              isLaunching={quickLaunch.isPending}
            />
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Bot size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No agents match your filters.</p>
          <button
            onClick={() => { setSearch(""); setCategoryFilter("all"); setCapabilityFilter("all"); setModeFilter("all"); }}
            className="text-xs text-[oklch(0.75_0.15_85)] hover:underline mt-2"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Quick Launch Dialog */}
      <QuickLaunchDialog
        open={!!launchAgent}
        onClose={() => setLaunchAgent(null)}
        agent={launchAgent}
        onLaunch={handleQuickLaunch}
        isLaunching={quickLaunch.isPending}
      />
    </div>
  );
}

// ─── Agent Card Component ─────────────────────────────────────────────────

function AgentCard({
  agent,
  index,
  viewMode,
  isExpanded,
  onToggle,
  onQuickLaunch,
  isLaunching,
}: {
  agent: AgentItem;
  index: number;
  viewMode: "grid" | "list";
  isExpanded: boolean;
  onToggle: () => void;
  onQuickLaunch: (agentId: string, agentName: string) => void;
  isLaunching: boolean;
}) {
  const modeCfg = executionModeConfig[agent.executionMode] ?? executionModeConfig.llm;
  const modelCfg = modelPrefConfig[agent.modelPreference] ?? modelPrefConfig.balanced;
  const catColor = categoryColors[agent.category] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/25";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
    >
      <Card
        className={`bg-card border-border hover:border-[oklch(0.75_0.15_85_/_30%)] transition-all duration-200 cursor-pointer ${
          isExpanded ? "border-[oklch(0.75_0.15_85_/_25%)] glow-gold-sm" : ""
        } ${viewMode === "list" ? "flex-row" : ""}`}
        onClick={onToggle}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-sm ${catColor}`}>
                <AgentIcon name={agent.icon} className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-[Sora] text-foreground leading-tight">
                  {agent.name}
                </CardTitle>
                <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground">
                  v{agent.version}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm border ${catColor}`}>
                {agent.category}
              </span>
              <span className={`text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm ${modeCfg.color}`}>
                {modeCfg.label}
              </span>
              {isExpanded ? (
                <ChevronUp size={14} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={14} className="text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {agent.description}
          </p>

          {/* Capabilities chips */}
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.map((cap) => (
              <span
                key={cap}
                className="text-[8px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground"
              >
                {cap}
              </span>
            ))}
          </div>

          {/* Quick stats row */}
          <div className="flex items-center gap-3 text-[9px] font-[IBM_Plex_Mono] text-muted-foreground">
            {agent.estimatedDuration && (
              <span className="flex items-center gap-1">
                <Clock size={10} /> ~{agent.estimatedDuration}s
              </span>
            )}
            <span className={`flex items-center gap-1 ${modelCfg.color}`}>
              <Sparkles size={10} /> {modelCfg.label}
            </span>
            {agent.persistArtifact && (
              <span className="flex items-center gap-1 text-cyan-400">
                <FileText size={10} /> {agent.artifactType ?? "artifact"}
              </span>
            )}
          </div>

          {/* ── Expanded Detail Panel ────────────────────────────────── */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="pt-3 mt-3 border-t border-border space-y-4">
                  {/* Agent ID */}
                  <div>
                    <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">
                      Agent ID
                    </span>
                    <p className="text-xs font-[IBM_Plex_Mono] text-foreground mt-0.5">
                      {agent.id}
                    </p>
                  </div>

                  {/* Output schema */}
                  <div>
                    <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">
                      Output Schema
                    </span>
                    <p className="text-[11px] text-foreground mt-0.5">
                      {agent.outputSchemaDescription}
                    </p>
                    <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground mt-1 block">
                      Format: {agent.outputFormat}
                    </span>
                  </div>

                  {/* Chainable fields */}
                  {agent.chainableFields.length > 0 && (
                    <div>
                      <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <ArrowRight size={10} /> Chainable Output Fields
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.chainableFields.map((f) => (
                          <span
                            key={f}
                            className="text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Required context */}
                  {agent.requiredContext.length > 0 && (
                    <div>
                      <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Link2 size={10} /> Required Context (from prior steps)
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.requiredContext.map((ctx) => (
                          <span
                            key={ctx}
                            className="text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm bg-blue-400/10 text-blue-400 border border-blue-400/20"
                          >
                            {ctx}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Required secrets */}
                  {agent.requiredSecrets.length > 0 && (
                    <div>
                      <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Key size={10} /> Required Credentials
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.requiredSecrets.map((s) => (
                          <span
                            key={s}
                            className="text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm bg-amber-400/10 text-amber-400 border border-amber-400/20"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {agent.tags.length > 0 && (
                    <div>
                      <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground uppercase tracking-wider">
                        Tags
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Launch Button */}
                  <div className="pt-3 border-t border-border">
                    <Button
                      size="sm"
                      className="w-full bg-[oklch(0.75_0.15_85)] hover:bg-[oklch(0.70_0.15_85)] text-background font-[Sora] text-xs gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickLaunch(agent.id, agent.name);
                      }}
                      disabled={isLaunching}
                    >
                      <Rocket size={12} />
                      {isLaunching ? "Launching..." : "Quick Launch Agent"}
                    </Button>
                  </div>

                  {/* Metadata row */}
                  <div className="flex flex-wrap gap-4 pt-2 border-t border-border text-[9px] font-[IBM_Plex_Mono] text-muted-foreground">
                    <span>Version: <span className="text-foreground">v{agent.version}</span></span>
                    <span>Mode: <span className={modeCfg.color}>{modeCfg.label}</span></span>
                    <span>Model: <span className={modelCfg.color}>{modelCfg.label}</span></span>
                    <span className="flex items-center gap-1">
                      <Activity size={9} /> Provider: <span className="text-foreground">
                        {agent.modelPreference === "deep-reasoning" ? "Claude (preferred)" : "Forge"}
                      </span>
                    </span>
                    {agent.estimatedDuration && (
                      <span>Duration: <span className="text-foreground">~{agent.estimatedDuration}s</span></span>
                    )}
                    {agent.persistArtifact && (
                      <span>Artifact: <span className="text-cyan-400">{agent.artifactType}</span></span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
