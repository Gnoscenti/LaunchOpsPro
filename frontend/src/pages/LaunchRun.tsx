import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createRun, getPrompts, getRun, getRunTasks, executeNextTask } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TerminalCard } from "@/components/TerminalCard";
import { Play, Sparkles, Terminal, Cpu, CheckCircle, AlertCircle, Loader, Circle, Rocket } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LaunchRun() {
  const [goal, setGoal] = useState("Launch a $10k/month SaaS business");
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const { data: promptsData } = useQuery({
    queryKey: ["prompts"],
    queryFn: getPrompts,
  });

  const createRunMutation = useMutation({
    mutationFn: createRun,
    onSuccess: (data) => {
      setCurrentRunId(data.run_id);
      toast.success("Mission initialized successfully");
    },
    onError: () => {
      toast.error("Failed to initialize mission");
    },
  });

  const executeTaskMutation = useMutation({
    mutationFn: executeNextTask,
  });

  const { data: runData, refetch: refetchRun } = useQuery({
    queryKey: ['run', currentRunId],
    queryFn: () => getRun(currentRunId!),
    enabled: !!currentRunId,
    refetchInterval: 5000,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['runTasks', currentRunId],
    queryFn: () => getRunTasks(currentRunId!),
    enabled: !!currentRunId,
    refetchInterval: 5000,
  });

  const handleLaunch = () => {
    const spec = localStorage.getItem('businessSpec');
    const constraints = spec ? JSON.parse(spec) : {};

    createRunMutation.mutate({
      goal,
      constraints,
    });
  };

  const handleExecuteNext = () => {
    if (currentRunId) {
      executeTaskMutation.mutate(currentRunId, {
        onSuccess: () => {
          refetchRun();
        },
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'running':
        return <Loader className="text-primary animate-spin" size={16} />;
      case 'failed':
        return <AlertCircle className="text-red-500" size={16} />;
      default:
        return <Circle className="text-muted-foreground" size={16} />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono tracking-tight mb-2">
            LAUNCH_RUN
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            Initialize a new autonomous business operation.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {currentRunId ? "MISSION_ACTIVE" : "READY_FOR_INSTRUCTION"}
        </div>
      </div>

      {!currentRunId ? (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Input Area */}
          <div className="lg:col-span-2">
            <TerminalCard title="mission_control.sh" className="h-full">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                    Primary Objective
                  </label>
                  <Textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Describe the business task you want to automate..."
                    className="min-h-[200px] font-mono bg-background/50 border-border focus:border-primary/50 resize-none p-4 text-sm leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border/50">
                  <div className="text-xs font-mono text-muted-foreground">
                    EST. COMPUTE: <span className="text-primary">MODERATE</span>
                  </div>
                  <Button 
                    onClick={handleLaunch}
                    disabled={createRunMutation.isPending || !goal.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2 shadow-[0_0_20px_-5px_var(--primary)]"
                  >
                    {createRunMutation.isPending ? (
                      <>
                        <Cpu className="w-4 h-4 animate-spin" />
                        INITIALIZING...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" />
                        EXECUTE_RUN
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TerminalCard>
          </div>

          {/* Prompt Library Sidebar */}
          <div className="space-y-6">
            <TerminalCard title="quick_access_prompts">
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {promptsData?.prompts?.map((prompt: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => setGoal(prompt.prompt)}
                    className="p-3 rounded border border-border bg-background/30 hover:bg-primary/5 hover:border-primary/30 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Terminal className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-xs font-mono font-bold text-foreground group-hover:text-primary transition-colors">
                        {prompt.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 font-mono opacity-70">
                      {prompt.prompt}
                    </p>
                  </div>
                ))}
                
                {!promptsData?.prompts?.length && (
                  <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                    NO_PROMPTS_LOADED
                  </div>
                )}
              </div>
            </TerminalCard>

            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-2 text-primary font-mono text-xs font-bold">
                <Sparkles className="w-3 h-3" />
                PRO_TIP
              </div>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                Be specific about your business model and target audience for better results. The AI works best with clear constraints.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Run Status */}
          <TerminalCard title={`run_status: ${currentRunId}`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold font-mono text-foreground">Mission Progress</h2>
                <p className="text-xs font-mono text-muted-foreground">ID: {currentRunId}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold font-mono text-primary animate-pulse">
                  {Math.round((runData?.progress || 0) * 100)}%
                </div>
                <div className="text-xs font-mono text-muted-foreground uppercase">{runData?.status}</div>
              </div>
            </div>

            <div className="w-full bg-muted rounded-full h-1.5 mb-6 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500 shadow-[0_0_10px_var(--primary)]"
                style={{ width: `${(runData?.progress || 0) * 100}%` }}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleExecuteNext}
                disabled={executeTaskMutation.isPending || runData?.status === 'completed'}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2 shadow-[0_0_20px_-5px_var(--primary)]"
              >
                {executeTaskMutation.isPending ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin" />
                    PROCESSING...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    EXECUTE_NEXT_TASK
                  </>
                )}
              </Button>
            </div>
          </TerminalCard>

          {/* Tasks List */}
          <TerminalCard title="task_log">
            <div className="space-y-1">
              {tasksData?.tasks.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 p-3 hover:bg-muted/30 rounded border border-transparent hover:border-border transition-colors group"
                >
                  <div className="shrink-0">
                    {getStatusIcon(task.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {task.title}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                      <span className="uppercase text-[10px] border border-border px-1 rounded">
                        {task.type}
                      </span>
                      <span>AGENT: {task.agent}</span>
                    </div>
                  </div>
                  <div className={cn(
                    "text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                    task.status === 'completed' ? "bg-green-500/10 text-green-500" :
                    task.status === 'running' ? "bg-primary/10 text-primary" :
                    task.status === 'failed' ? "bg-red-500/10 text-red-500" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {task.status}
                  </div>
                </div>
              ))}
              
              {!tasksData?.tasks?.length && (
                <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                  WAITING_FOR_TASKS...
                </div>
              )}
            </div>
          </TerminalCard>
        </div>
      )}
    </div>
  );
}
