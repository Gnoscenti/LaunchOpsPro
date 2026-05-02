/**
 * Orchestrator — Execution Log & System Observability
 * Wired to real tRPC log data
 */
import { motion } from "framer-motion";
import { Terminal, Filter, Download, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type LogLevel = "info" | "warn" | "error" | "debug" | "all";

const levelColors: Record<string, string> = {
  info: "text-blue-400 bg-blue-400/10",
  warn: "text-amber-400 bg-amber-400/10",
  error: "text-red-400 bg-red-400/10",
  debug: "text-zinc-400 bg-zinc-400/10",
};

export default function Orchestrator() {
  const [filter, setFilter] = useState<LogLevel>("all");
  const levels: LogLevel[] = ["all", "info", "warn", "error", "debug"];

  const { data: logs, isLoading, refetch } = trpc.log.recent.useQuery({ limit: 100 });

  const filtered = filter === "all"
    ? (logs ?? [])
    : (logs ?? []).filter((l) => l.level === filter);

  const handleExport = () => {
    if (!logs || logs.length === 0) {
      toast("No logs to export");
      return;
    }
    const content = logs.map(l => 
      `[${new Date(l.createdAt).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`
    ).join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-logs-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported");
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[Sora] font-bold text-foreground">Execution Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time system observability and audit trail</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-border text-muted-foreground">
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="border-border text-muted-foreground">
            <Download size={14} className="mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-muted-foreground" />
        {levels.map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={`text-[10px] font-[IBM_Plex_Mono] uppercase px-2.5 py-1 rounded-sm transition-colors ${
              filter === level
                ? "bg-[oklch(0.75_0.15_85_/_15%)] text-[oklch(0.75_0.15_85)] border border-[oklch(0.75_0.15_85_/_30%)]"
                : "bg-muted text-muted-foreground border border-transparent hover:border-border"
            }`}
          >
            {level}
          </button>
        ))}
        <span className="ml-auto text-[9px] font-[IBM_Plex_Mono] text-muted-foreground">
          {filtered.length} entries
        </span>
      </div>

      {/* Log Terminal */}
      <Card className="bg-[oklch(0.10_0.005_250)] border-border">
        <CardHeader className="pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-[oklch(0.75_0.15_85)]" />
            <CardTitle className="text-xs font-[IBM_Plex_Mono] text-muted-foreground">atlas.log</CardTitle>
            {isLoading && <Loader2 size={12} className="animate-spin text-[oklch(0.75_0.15_85)]" />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto font-[IBM_Plex_Mono] text-[11px]">
            {filtered.length === 0 && !isLoading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p>No execution logs yet. Run a workflow to generate activity.</p>
              </div>
            )}
            {filtered.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.5) }}
                className="flex gap-3 px-4 py-2 border-b border-border/30 hover:bg-[oklch(0.14_0.005_250)] transition-colors"
              >
                <span className="text-muted-foreground/60 shrink-0 w-20">
                  {new Date(log.createdAt).toLocaleTimeString("en-US", { hour12: false })}
                </span>
                <span className={`shrink-0 uppercase w-12 text-center px-1 py-0.5 rounded-sm text-[9px] ${levelColors[log.level] || ""}`}>
                  {log.level}
                </span>
                <span className="text-foreground/80">{log.message}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
