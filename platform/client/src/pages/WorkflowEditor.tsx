/**
 * Workflow Editor — Create, edit, and run workflows with persistent storage.
 * Uses tRPC for all CRUD operations and SSE for real-time execution streaming.
 */
import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import WorkflowCanvas from "@/components/WorkflowCanvas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Plus,
  Play,
  Save,
  Loader2,
  Workflow,
  LayoutTemplate,
  Trash2,
  CheckCircle,
  AlertTriangle,
  LogIn,
  Zap,
  Copy,
  Shield,
  FileJson,
  ChevronRight,
  XCircle,
  FileDown,
  Link2,
  Brain,
  Layers,
} from "lucide-react";
import { type WorkflowStep } from "@/lib/atlasData";

type EditorMode = "list" | "edit" | "run";

export default function WorkflowEditor() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const [mode, setMode] = useState<EditorMode>("list");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [sseEvents, setSseEvents] = useState<Array<{ type: string; data: Record<string, unknown> }>>([]);
  const [artifacts, setArtifacts] = useState<Array<{ stepId: number; url: string; type: string; label: string }>>([]);
  const [contextChain, setContextChain] = useState<{ steps: number; tokens: number }>({ steps: 0, tokens: 0 });

  // ─── Queries ─────────────────────────────────────────────────────
  const workflows = trpc.workflow.list.useQuery(undefined, { enabled: isAuthenticated });
  const templates = trpc.template.list.useQuery();
  const selectedWorkflow = trpc.workflow.get.useQuery(
    { id: selectedWorkflowId! },
    { enabled: !!selectedWorkflowId }
  );
  const steps = trpc.step.list.useQuery(
    { workflowId: selectedWorkflowId! },
    { enabled: !!selectedWorkflowId }
  );
  const stepExecutions = trpc.execution.stepExecutions.useQuery(
    { executionId: executionId! },
    { enabled: !!executionId, refetchInterval: mode === "run" ? 2000 : false }
  );

  // ─── Mutations ───────────────────────────────────────────────────
  const createWorkflow = trpc.workflow.create.useMutation({
    onSuccess: (wf) => {
      utils.workflow.list.invalidate();
      setSelectedWorkflowId(wf.id);
      setMode("edit");
      toast.success("Workflow created");
    },
  });
  const deleteWorkflow = trpc.workflow.delete.useMutation({
    onSuccess: () => {
      utils.workflow.list.invalidate();
      setSelectedWorkflowId(null);
      setMode("list");
      toast.success("Workflow deleted");
    },
  });
  const cloneTemplate = trpc.template.clone.useMutation({
    onSuccess: (wf) => {
      utils.workflow.list.invalidate();
      setSelectedWorkflowId(wf.id);
      setShowTemplateDialog(false);
      setMode("edit");
      toast.success("Template cloned into new workflow");
    },
  });
  const bulkSaveSteps = trpc.step.bulkSave.useMutation({
    onSuccess: () => {
      utils.step.list.invalidate();
      toast.success("Workflow saved");
    },
  });
  const runExecution = trpc.execution.run.useMutation({
    onSuccess: () => {
      toast.success("Execution engine triggered — agents running");
    },
    onError: (err) => {
      toast.error(`Failed to trigger engine: ${err.message}`);
    },
  });
  const cancelExecution = trpc.execution.cancel.useMutation({
    onSuccess: () => {
      toast.info("Execution cancelled");
      utils.execution.stepExecutions.invalidate();
      utils.execution.list.invalidate();
    },
    onError: (err) => {
      toast.error(`Cancel failed: ${err.message}`);
    },
  });
  const startExecution = trpc.execution.start.useMutation({
    onSuccess: (exec) => {
      setExecutionId(exec.id);
      setMode("run");
      toast.success("Execution started — connecting to agent bridge...");
      connectSSE(exec.id);
      // Trigger the actual execution engine (Python bridge + LLM)
      runExecution.mutate({ executionId: exec.id });
    },
  });

  // ─── SSE for real-time execution streaming ───────────────────────
  const connectSSE = useCallback((execId: number) => {
    const eventSource = new EventSource(`/api/execute/${execId}/stream`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSseEvents((prev) => [...prev, { type: "message", data }]);

        // Track artifacts
        if (data.type === "artifact_saved" && data.artifactUrl) {
          setArtifacts((prev) => [...prev, {
            stepId: data.stepId as number,
            url: data.artifactUrl as string,
            type: data.artifactType as string ?? "report",
            label: data.message as string ?? "Artifact",
          }]);
        }

        // Track context chain growth
        if (data.type === "context_updated") {
          setContextChain({
            steps: (data.contextSteps as number) ?? 0,
            tokens: (data.contextTokens as number) ?? 0,
          });
        }

        if (data.type === "step_complete" || data.type === "step_failed") {
          utils.execution.stepExecutions.invalidate();
        }
        if (data.type === "workflow_complete" || data.type === "workflow_failed") {
          eventSource.close();
          utils.execution.stepExecutions.invalidate();
          utils.execution.list.invalidate();
        }
      } catch { /* ignore */ }
    };
    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  }, [utils]);

  // ─── Convert DB steps → canvas format ────────────────────────────
  const canvasSteps: WorkflowStep[] = useMemo(() => {
    if (!steps.data) return [];
    return steps.data.map((s) => ({
      id: String(s.id),
      name: s.label,
      description: s.description ?? "",
      agent: s.agentId,
      dependsOn: Array.isArray(s.dependencies) ? (s.dependencies as string[]) : [],
      status: "pending" as const,
      retries: 0,
      maxRetries: (s.config as Record<string, number>)?.maxRetries ?? 3,
      timeout: (s.config as Record<string, number>)?.timeout ?? 300,
    }));
  }, [steps.data]);

  // ─── Canvas save handler ─────────────────────────────────────────
  const handleCanvasSave = useCallback(
    (updatedSteps: WorkflowStep[]) => {
      if (!selectedWorkflowId) return;
      const payload = updatedSteps.map((s, i) => ({
        agentId: s.agent,
        label: s.name,
        description: s.description,
        sortOrder: i,
        config: { maxRetries: s.maxRetries, timeout: s.timeout },
        dependencies: s.dependsOn,
      }));
      bulkSaveSteps.mutate({ workflowId: selectedWorkflowId, steps: payload });
    },
    [selectedWorkflowId, bulkSaveSteps]
  );

  // ─── Loading state ───────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.75_0.15_85)]" />
      </div>
    );
  }

  // ─── Unauthenticated ─────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Workflow className="w-16 h-16 text-[oklch(0.75_0.15_85)] opacity-60" />
        <h2 className="text-2xl font-bold font-[Sora]">Workflow Editor</h2>
        <p className="text-muted-foreground max-w-md text-center">
          Sign in to create, edit, and execute workflows with persistent storage.
        </p>
        <a href={getLoginUrl()}>
          <Button className="bg-[oklch(0.75_0.15_85)] text-black hover:bg-[oklch(0.80_0.15_85)]">
            <LogIn className="w-4 h-4 mr-2" /> Sign In
          </Button>
        </a>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIST MODE — workflow gallery + template library
  // ═══════════════════════════════════════════════════════════════════
  if (mode === "list") {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-[Sora] font-bold text-foreground">Workflow Editor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visual drag-and-drop builder with proof-of-agent verification
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-border">
                  <LayoutTemplate size={14} className="mr-1.5" /> From Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-[Sora]">Clone a Template</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 max-h-[60vh] overflow-y-auto">
                  {templates.isLoading ? (
                    <div className="col-span-2 flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-[oklch(0.75_0.15_85)]" />
                    </div>
                  ) : (
                    (templates.data ?? []).map((t) => (
                      <Card
                        key={t.id}
                        className="bg-background border-border hover:border-[oklch(0.45_0.12_85)] transition-colors cursor-pointer"
                        onClick={() => cloneTemplate.mutate({ templateId: t.id })}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Copy size={14} className="text-[oklch(0.75_0.15_85)]" />
                            <h3 className="font-medium font-[Sora] text-sm">{t.name}</h3>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {t.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{t.complexity}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {t.cloneCount ?? 0} clones
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex gap-2">
              <Input
                placeholder="New workflow name..."
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                className="w-56 bg-background border-border"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newWorkflowName.trim()) {
                    createWorkflow.mutate({ name: newWorkflowName.trim() });
                    setNewWorkflowName("");
                  }
                }}
              />
              <Button
                className="bg-[oklch(0.75_0.15_85)] text-[oklch(0.12_0.005_250)] hover:bg-[oklch(0.80_0.15_85)] font-semibold"
                disabled={!newWorkflowName.trim() || createWorkflow.isPending}
                onClick={() => {
                  createWorkflow.mutate({ name: newWorkflowName.trim() });
                  setNewWorkflowName("");
                }}
              >
                {createWorkflow.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} className="mr-1" />
                )}
                Create
              </Button>
            </div>
          </div>
        </div>

        {/* Proof-of-Agent Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 p-4 rounded-sm bg-[oklch(0.18_0.04_160_/_30%)] border border-[oklch(0.50_0.15_160_/_30%)]"
        >
          <Shield size={20} className="text-[oklch(0.70_0.18_160)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[oklch(0.70_0.18_160)] font-[Sora]">Proof-of-Agent Verification</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Every workflow step produces a cryptographic proof of execution. Nodes transition through
              verification states: <span className="text-muted-foreground/80">Unverified</span> →{" "}
              <span className="text-[oklch(0.75_0.15_85)]">Proving</span> →{" "}
              <span className="text-[oklch(0.70_0.18_160)]">Verified</span>. Failed proofs trigger
              automatic retry with full audit trail.
            </p>
          </div>
        </motion.div>

        {/* Workflow Cards */}
        {workflows.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[oklch(0.75_0.15_85)]" />
          </div>
        ) : (workflows.data ?? []).length === 0 ? (
          <Card className="bg-[oklch(0.14_0.005_250)] border-border border-dashed">
            <CardContent className="p-12 text-center">
              <Workflow className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold font-[Sora] mb-2">No workflows yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Create a blank workflow or clone one of the pre-built templates to get started.
              </p>
              <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
                <LayoutTemplate size={14} className="mr-1.5" /> Browse Templates
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div>
            <h2 className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-widest text-muted-foreground mb-3">
              Your Workflows ({(workflows.data ?? []).length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(workflows.data ?? []).map((wf, i) => (
                <motion.div
                  key={wf.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card
                    className="bg-[oklch(0.14_0.005_250)] border-border hover:border-[oklch(0.45_0.12_85)] transition-all duration-300 cursor-pointer group"
                    onClick={() => {
                      setSelectedWorkflowId(wf.id);
                      setMode("edit");
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileJson size={16} className="text-[oklch(0.75_0.15_85)]" />
                          <h3 className="text-sm font-semibold font-[Sora] text-foreground">{wf.name}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm ${
                            wf.status === "active"
                              ? "bg-[oklch(0.18_0.04_160)] text-[oklch(0.70_0.18_160)]"
                              : wf.status === "archived"
                              ? "bg-[oklch(0.20_0.05_25)] text-[oklch(0.65_0.20_25)]"
                              : "bg-[oklch(0.20_0.005_250)] text-muted-foreground"
                          }`}>
                            {wf.status}
                          </span>
                          <ChevronRight size={14} className="text-muted-foreground group-hover:text-[oklch(0.75_0.15_85)] transition-colors" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {wf.description ?? "No description"}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-[IBM_Plex_Mono] text-muted-foreground">
                          v{wf.version} · {new Date(wf.createdAt).toLocaleDateString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this workflow?")) {
                              deleteWorkflow.mutate({ id: wf.id });
                            }
                          }}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-sm bg-[oklch(0.14_0.005_250)] border border-border">
            <Zap size={16} className="text-[oklch(0.75_0.15_85)]" />
            <div>
              <p className="text-lg font-bold font-[Sora] text-foreground">{(workflows.data ?? []).length}</p>
              <p className="text-[10px] text-muted-foreground">Workflows</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-sm bg-[oklch(0.14_0.005_250)] border border-border">
            <LayoutTemplate size={16} className="text-[oklch(0.75_0.15_85)]" />
            <div>
              <p className="text-lg font-bold font-[Sora] text-foreground">{(templates.data ?? []).length}</p>
              <p className="text-[10px] text-muted-foreground">Templates</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-sm bg-[oklch(0.14_0.005_250)] border border-border">
            <Shield size={16} className="text-[oklch(0.70_0.18_160)]" />
            <div>
              <p className="text-lg font-bold font-[Sora] text-foreground">PoA</p>
              <p className="text-[10px] text-muted-foreground">Proof-of-Agent</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // EDIT / RUN MODE — Canvas editor with execution log
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-[oklch(0.13_0.005_250)] shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setMode("list");
              setSelectedWorkflowId(null);
              setExecutionId(null);
              setSseEvents([]);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <div className="w-px h-5 bg-border" />
          <Zap size={14} className="text-[oklch(0.75_0.15_85)]" />
          <span className="text-sm font-semibold font-[Sora] text-foreground">
            {selectedWorkflow.data?.name ?? "Loading..."}
          </span>
          {selectedWorkflow.data && (
            <span className="text-[9px] font-[IBM_Plex_Mono] px-1.5 py-0.5 rounded-sm bg-[oklch(0.20_0.005_250)] text-muted-foreground">
              v{selectedWorkflow.data.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCanvasSave(canvasSteps)}
                disabled={bulkSaveSteps.isPending}
                className="border-border text-xs"
              >
                {bulkSaveSteps.isPending ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <Save size={12} className="mr-1" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                className="bg-[oklch(0.75_0.15_85)] text-black hover:bg-[oklch(0.80_0.15_85)] text-xs font-semibold"
                disabled={startExecution.isPending || runExecution.isPending || canvasSteps.length === 0}
                onClick={() => {
                  if (selectedWorkflowId) {
                    setSseEvents([]);
                    setArtifacts([]);
                    setContextChain({ steps: 0, tokens: 0 });
                    startExecution.mutate({ workflowId: selectedWorkflowId });
                  }
                }}
              >
                {(startExecution.isPending || runExecution.isPending) ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <Play size={12} className="mr-1" />
                )}
                Run Workflow
              </Button>
            </>
          )}
          {mode === "run" && executionId && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs"
              disabled={cancelExecution.isPending}
              onClick={() => cancelExecution.mutate({ executionId })}
            >
              {cancelExecution.isPending ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : (
                <XCircle size={12} className="mr-1" />
              )}
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        {steps.isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.75_0.15_85)]" />
          </div>
        ) : (
          <WorkflowCanvas
            initialSteps={canvasSteps}
            workflowName={selectedWorkflow.data?.name ?? "Workflow"}
            onSave={handleCanvasSave}
          />
        )}
      </div>

      {/* Execution Log (visible in run mode) */}
      {mode === "run" && (
        <div className="border-t border-border bg-[oklch(0.12_0.005_250)] p-4 max-h-72 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-[oklch(0.75_0.15_85)]" />
              <span className="text-xs font-semibold font-[Sora] text-foreground">Execution Log</span>
            </div>
            <div className="flex items-center gap-3">
              {contextChain.steps > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Brain size={12} className="text-purple-400" />
                  <span>Context: {contextChain.steps} steps, ~{contextChain.tokens} tokens</span>
                </div>
              )}
              {artifacts.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <FileDown size={12} className="text-blue-400" />
                  <span>{artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          </div>

          {/* SSE Events */}
          <div className="space-y-1 font-[IBM_Plex_Mono] text-[11px]">
            {sseEvents.length === 0 ? (
              <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for execution events...
              </div>
            ) : (
              sseEvents.filter(evt => evt.data.type !== "heartbeat").map((evt, i) => (
                <div key={i} className="flex items-start gap-2 py-1 border-b border-border/30 last:border-0">
                  {evt.data.type === "step_complete" ? (
                    <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                  ) : evt.data.type === "step_failed" ? (
                    <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                  ) : evt.data.type === "artifact_saved" ? (
                    <FileDown className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
                  ) : evt.data.type === "context_updated" ? (
                    <Brain className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                  ) : evt.data.type === "step_start" ? (
                    <Layers className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  ) : (
                    <Zap className="w-3 h-3 text-[oklch(0.75_0.15_85)] mt-0.5 shrink-0" />
                  )}
                  <span className="text-foreground/80 flex-1">
                    {(evt.data.message as string) ?? JSON.stringify(evt.data)}
                  </span>
                  {evt.data.type === "artifact_saved" && typeof evt.data.artifactUrl === "string" ? (
                    <a
                      href={evt.data.artifactUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors shrink-0"
                    >
                      <Link2 size={12} />
                    </a>
                  ) : null}
                  {evt.data.type === "step_complete" && typeof evt.data.artifactUrl === "string" ? (
                    <a
                      href={evt.data.artifactUrl as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors shrink-0"
                      title="View artifact"
                    >
                      <FileDown size={12} />
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {/* Artifacts Panel */}
          {artifacts.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground mb-2 font-[IBM_Plex_Mono] uppercase tracking-wider">Generated Artifacts</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {artifacts.map((art, i) => (
                  <a
                    key={i}
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-sm border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
                  >
                    <FileDown size={14} className="text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-foreground truncate">{art.label}</p>
                      <p className="text-[9px] text-muted-foreground">{art.type}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Step Execution Status Grid */}
          {stepExecutions.data && stepExecutions.data.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground mb-2 font-[IBM_Plex_Mono] uppercase tracking-wider">Step Status</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {stepExecutions.data.map((se) => (
                  <div
                    key={se.id}
                    className={`p-2 rounded-sm border text-xs ${
                      se.status === "completed"
                        ? "border-green-500/30 bg-green-500/5"
                        : se.status === "running"
                        ? "border-blue-500/30 bg-blue-500/5"
                        : se.status === "failed"
                        ? "border-red-500/30 bg-red-500/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium font-[IBM_Plex_Mono]">Step #{se.stepId}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] ${
                          se.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : se.status === "running"
                            ? "bg-blue-500/20 text-blue-400"
                            : se.status === "failed"
                            ? "bg-red-500/20 text-red-400"
                            : ""
                        }`}
                      >
                        {se.status}
                      </Badge>
                    </div>
                    {se.proofHash && (
                      <p className="text-[9px] text-muted-foreground mt-1 truncate">
                        Proof: {se.proofHash}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
