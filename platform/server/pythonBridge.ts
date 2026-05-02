/**
 * Atlas Orchestrator — Node.js ↔ Python Agent Bridge (Microservices Architecture)
 *
 * This module acts as an API client to the Python FastAPI backend.
 * Instead of spawning child processes, it makes HTTP requests to the
 * FastAPI orchestration engine (running on port 8001 by default).
 */
import fetch from "node-fetch";

// The URL of the Python FastAPI backend
const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8001";

// Track active executions for cancellation
const activeExecutions = new Set<number>();

export interface AgentTask {
  agentId: string;
  label: string;
  description: string | null;
  config: unknown;
  context?: Record<string, unknown>;
  taskType?: string;
}

export interface AgentEvent {
  event: "log" | "progress" | "result" | "error";
  level?: string;
  message?: string;
  percent?: number;
  success?: boolean;
  data?: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  data: Record<string, unknown>;
  events: AgentEvent[];
  mode: "python" | "llm_fallback";
}

export interface RunAgentOptions {
  credentials?: Array<{ keyName: string; encryptedValue: string }>;
  onEvent?: (event: AgentEvent) => void;
  timeout?: number;
  executionId?: number;
  businessContext?: Record<string, unknown>;
}

/**
 * Execute a workflow step by calling the Python FastAPI backend.
 */
export async function runAgent(task: AgentTask, options: RunAgentOptions = {}): Promise<AgentResult> {
  const {
    credentials = [],
    onEvent,
    timeout = 120_000,
    executionId,
    businessContext = {},
  } = options;

  if (executionId) {
    activeExecutions.add(executionId);
  }

  const events: AgentEvent[] = [];
  
  // Helper to emit and store events
  const emitEvent = (event: AgentEvent) => {
    events.push(event);
    if (onEvent) onEvent(event);
  };

  emitEvent({ event: "log", level: "info", message: `Starting agent ${task.agentId} via FastAPI bridge...` });
  emitEvent({ event: "progress", percent: 10, message: "Connecting to Python backend..." });

  try {
    // 1. Prepare the payload
    const payload = {
      agent_id: task.agentId,
      label: task.label,
      description: task.description,
      config: task.config,
      context: { ...businessContext, ...(task.context ?? {}) },
      task_type: task.taskType,
      credentials: credentials.reduce((acc, cred) => {
        acc[cred.keyName] = cred.encryptedValue;
        return acc;
      }, {} as Record<string, string>)
    };

    // 2. Make the HTTP request to FastAPI
    // Note: We use AbortController for timeout/cancellation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Check if cancelled before starting
    if (executionId && !activeExecutions.has(executionId)) {
      throw new Error("Execution cancelled before starting");
    }

    emitEvent({ event: "progress", percent: 30, message: "Executing task on Python backend..." });

    // In a real streaming implementation, we would use Server-Sent Events (SSE)
    // or WebSockets here. For this bridge, we'll simulate the synchronous call
    // but in production, FastAPI should expose a streaming endpoint.
    // Call the single-stage sync endpoint
    const response = await fetch(`${FASTAPI_URL}/atlas/v2/execute/stage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: task.label, // Assuming task.label matches the stage name in STAGES
        enforce_hitl: false // Or pass from options if needed
      }),
      signal: controller.signal as any,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI returned ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;

    emitEvent({ event: "progress", percent: 100, message: "Execution complete" });
    
    const finalResultEvent: AgentEvent = {
      event: "result",
      success: result.success ?? true,
      data: result.data ?? result,
    };
    
    emitEvent(finalResultEvent);

    if (executionId) {
      activeExecutions.delete(executionId);
    }

    return {
      success: finalResultEvent.success!,
      data: finalResultEvent.data!,
      events,
      mode: result.mode === "llm_fallback" ? "llm_fallback" : "python",
    };

  } catch (error: any) {
    if (executionId) {
      activeExecutions.delete(executionId);
    }

    const isAbort = error.name === "AbortError";
    const errorMessage = isAbort 
      ? `Agent timed out or was cancelled after ${timeout / 1000}s: ${task.label}`
      : `Failed to execute Python agent: ${error.message}`;

    emitEvent({ event: "error", message: errorMessage });

    throw new Error(errorMessage);
  }
}

/**
 * Cancel a running execution.
 * Note: In a true microservices architecture, this should also send a DELETE/CANCEL
 * request to the FastAPI backend to stop the underlying Python task.
 */
export function cancelExecution(executionId: number): boolean {
  if (activeExecutions.has(executionId)) {
    activeExecutions.delete(executionId);
    // TODO: Send cancellation request to FastAPI
    // fetch(`${FASTAPI_URL}/api/executions/${executionId}/cancel`, { method: 'POST' }).catch(console.error);
    return true;
  }
  return false;
}

/**
 * Check if an execution is currently active.
 */
export function isExecutionRunning(executionId: number): boolean {
  return activeExecutions.has(executionId);
}

/**
 * Get the count of currently active agent executions.
 */
export function getActiveProcessCount(): number {
  return activeExecutions.size;
}
