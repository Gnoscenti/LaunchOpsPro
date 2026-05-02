/**
 * Pipeline — Workflow listing with execution status and template library.
 * Uses tRPC for all data. Shows workflows, their steps, and execution history.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  Workflow,
  LayoutTemplate,
  LogIn,
  Zap,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  StopCircle,
} from "lucide-react";
import { useLocation } from "wouter";

export default function Pipeline() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<number>>(new Set());

  // Queries
  const workflows = trpc.workflow.list.useQuery(undefined, { enabled: isAuthenticated });
  const templates = trpc.template.list.useQuery();
  const executions = trpc.execution.list.useQuery(undefined, { enabled: isAuthenticated });

  // Mutations
  const runExecution = trpc.execution.run.useMutation({
    onSuccess: () => toast.success("Execution engine triggered — agents running"),
    onError: (err) => toast.error(`Engine error: ${err.message}`),
  });
  const cancelExecution = trpc.execution.cancel.useMutation({
    onSuccess: () => {
      toast.info("Execution cancelled");
      executions.refetch();
    },
    onError: (err) => toast.error(`Cancel failed: ${err.message}`),
  });
  const startExecution = trpc.execution.start.useMutation({
    onSuccess: (exec) => {
      toast.success("Execution started — agents connecting...");
      executions.refetch();
      // Trigger the actual execution engine (Python bridge + LLM)
      runExecution.mutate({ executionId: exec.id });
    },
  });
  const cloneTemplate = trpc.template.clone.useMutation({
    onSuccess: () => {
      workflows.refetch();
      toast.success("Workflow created from template");
    },
  });

  const toggleExpand = (id: number) => {
    setExpandedWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.75_0.15_85)]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <Workflow className="w-16 h-16 text-[oklch(0.75_0.15_85)] opacity-60" />
        <h2 className="text-2xl font-bold font-[Sora]">Launch Pipeline</h2>
        <p className="text-muted-foreground max-w-md text-center">
          Sign in to view and manage your workflow pipelines.
        </p>
        <a href={getLoginUrl()}>
          <Button className="bg-[oklch(0.75_0.15_85)] text-black hover:bg-[oklch(0.80_0.15_85)]">
            <LogIn className="w-4 h-4 mr-2" /> Sign In
          </Button>
        </a>
      </div>
    );
  }

  const workflowList = workflows.data ?? [];
  const executionList = executions.data ?? [];
  const templateList = templates.data ?? [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[Sora]">Launch Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {workflowList.length} workflows · {executionList.length} executions
          </p>
        </div>
        <Button
          className="bg-[oklch(0.75_0.15_85)] text-black hover:bg-[oklch(0.80_0.15_85)]"
          onClick={() => navigate("/editor")}
        >
          <Zap className="w-4 h-4 mr-1" /> Open Editor
        </Button>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[oklch(0.14_0.005_250)] border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Workflow className="w-5 h-5 text-[oklch(0.75_0.15_85)]" />
            <div>
              <p className="text-xl font-bold font-[Sora]">{workflowList.length}</p>
              <p className="text-[10px] text-muted-foreground">Workflows</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[oklch(0.14_0.005_250)] border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Play className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xl font-bold font-[Sora]">
                {executionList.filter((e) => e.status === "running").length}
              </p>
              <p className="text-[10px] text-muted-foreground">Running</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[oklch(0.14_0.005_250)] border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-xl font-bold font-[Sora]">
                {executionList.filter((e) => e.status === "completed").length}
              </p>
              <p className="text-[10px] text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[oklch(0.14_0.005_250)] border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <LayoutTemplate className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-xl font-bold font-[Sora]">{templateList.length}</p>
              <p className="text-[10px] text-muted-foreground">Templates</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow List */}
      {workflows.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[oklch(0.75_0.15_85)]" />
        </div>
      ) : workflowList.length === 0 ? (
        <Card className="bg-[oklch(0.14_0.005_250)] border-border border-dashed">
          <CardContent className="p-12 text-center">
            <Workflow className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold font-[Sora] mb-2">No workflows yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Open the Workflow Editor to create your first workflow, or clone a template below.
            </p>
            <Button variant="outline" onClick={() => navigate("/editor")}>
              Open Editor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workflowList.map((wf, i) => {
            const isExpanded = expandedWorkflows.has(wf.id);
            const wfExecutions = executionList.filter((e) => e.workflowId === wf.id);
            const latestExec = wfExecutions[0];
            const progress = latestExec
              ? latestExec.totalSteps > 0
                ? Math.round((latestExec.completedSteps / latestExec.totalSteps) * 100)
                : 0
              : 0;

            return (
              <motion.div
                key={wf.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="bg-[oklch(0.14_0.005_250)] border-border">
                  <CardHeader
                    className="cursor-pointer py-3 px-4"
                    onClick={() => toggleExpand(wf.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-sm font-[Sora]">{wf.name}</CardTitle>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] ${
                            wf.status === "active"
                              ? "bg-green-500/20 text-green-400"
                              : wf.status === "archived"
                              ? "bg-red-500/20 text-red-400"
                              : ""
                          }`}
                        >
                          {wf.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {latestExec && (
                          <div className="flex items-center gap-2 w-32">
                            <Progress value={progress} className="h-1.5" />
                            <span className="text-[10px] text-muted-foreground font-[IBM_Plex_Mono]">
                              {progress}%
                            </span>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[oklch(0.75_0.15_85)] hover:bg-[oklch(0.75_0.15_85_/_10%)]"
                          disabled={startExecution.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            startExecution.mutate({ workflowId: wf.id });
                          }}
                        >
                          {startExecution.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 px-4 pb-4">
                      <p className="text-xs text-muted-foreground mb-4">
                        {wf.description ?? "No description"}
                      </p>

                      {/* Execution History */}
                      {wfExecutions.length > 0 && (
                        <div>
                          <p className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-wider text-muted-foreground mb-2">
                            Recent Executions
                          </p>
                          <div className="space-y-1">
                            {wfExecutions.slice(0, 5).map((exec) => (
                              <div
                                key={exec.id}
                                className="flex items-center justify-between py-1.5 px-2 rounded-sm bg-background/50"
                              >
                                <div className="flex items-center gap-2">
                                  {exec.status === "completed" ? (
                                    <CheckCircle className="w-3 h-3 text-green-400" />
                                  ) : exec.status === "running" ? (
                                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                                  ) : exec.status === "failed" ? (
                                    <XCircle className="w-3 h-3 text-red-400" />
                                  ) : (
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                  )}
                                  <span className="text-xs text-foreground">
                                    Execution #{exec.id}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] text-muted-foreground font-[IBM_Plex_Mono]">
                                    {exec.completedSteps}/{exec.totalSteps} steps
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(exec.startedAt ?? exec.createdAt).toLocaleString()}
                                  </span>
                                  {exec.status === "running" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-400 hover:bg-red-500/10 h-5 w-5 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelExecution.mutate({ executionId: exec.id });
                                      }}
                                    >
                                      <XCircle className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => navigate("/editor")}
                        >
                          Edit in Canvas
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Template Library Section */}
      {templateList.length > 0 && (
        <div>
          <h2 className="text-[10px] font-[IBM_Plex_Mono] uppercase tracking-widest text-muted-foreground mb-3">
            Template Library
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templateList.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="bg-[oklch(0.14_0.005_250)] border-border hover:border-[oklch(0.45_0.12_85)] transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold font-[Sora]">{t.name}</h3>
                      <Badge variant="secondary" className="text-[9px]">
                        {t.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {t.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px]">
                          {t.complexity}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground">
                          {t.cloneCount ?? 0} uses
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[oklch(0.75_0.15_85)] text-xs"
                        disabled={cloneTemplate.isPending}
                        onClick={() => cloneTemplate.mutate({ templateId: t.id })}
                      >
                        Clone
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
