/**
 * Atlas Orchestrator — Node.js ↔ Python Agent Bridge
 *
 * Spawns the Python agentRunner.py as a child process for each workflow step,
 * pipes the step task as JSON to stdin, and parses structured JSON-line events
 * from stdout. Supports real-time progress callbacks, cancellation, and
 * credential injection into the Python process environment.
 *
 * Architecture:
 *   Node.js (executionEngine) → pythonBridge.runAgent(step, creds)
 *     → spawn python3 agentRunner.py
 *       → stdin: JSON task payload
 *       ← stdout: JSON-line events (log, progress, result, error)
 *       ← exit code: 0 = success, 1 = failure
 */
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the Python agent runner script
const AGENT_RUNNER_PATH = path.join(__dirname, "agentRunner.py");

// Paths to the LaunchOps Python agents — monorepo structure
// platform/ is inside LaunchOpsPro/, agents/ is a sibling directory
const LAUNCHOPS_ROOT = path.resolve(__dirname, "..", ".."); // LaunchOpsPro/
const FOUNDER_EDITION_DIR = LAUNCHOPS_ROOT; // agents/ lives at LaunchOpsPro/agents/
const LEGACY_LAUNCHOPS_DIR = LAUNCHOPS_ROOT; // same root for legacy compat

// Primary LaunchOps directory
const LAUNCHOPS_DIR = LAUNCHOPS_ROOT;

// Track active processes for cancellation
const activeProcesses = new Map<number, ChildProcess>();

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
  /** User credentials to inject as environment variables */
  credentials?: Array<{ keyName: string; encryptedValue: string }>;
  /** Callback for real-time events (log, progress) */
  onEvent?: (event: AgentEvent) => void;
  /** Timeout in milliseconds (default: 120000 = 2 minutes) */
  timeout?: number;
  /** Execution ID for cancellation tracking */
  executionId?: number;
  /** Business context to pass to the Python agent */
  businessContext?: Record<string, unknown>;
}

/**
 * Spawn the Python agent runner and execute a workflow step.
 *
 * Returns a structured result with the agent's output, all events emitted
 * during execution, and whether the step used a real Python agent or the
 * LLM fallback path.
 */
export function runAgent(task: AgentTask, options: RunAgentOptions = {}): Promise<AgentResult> {
  const {
    credentials = [],
    onEvent,
    timeout = 120_000,
    executionId,
    businessContext = {},
  } = options;

  return new Promise((resolve, reject) => {
    // Build environment: inherit process env + inject user credentials
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    env.FOUNDER_EDITION_DIR = FOUNDER_EDITION_DIR;
    env.LAUNCHOPS_DIR = LEGACY_LAUNCHOPS_DIR;
    env.PYTHONUNBUFFERED = "1"; // Force unbuffered output for real-time streaming
    // Unset PYTHONHOME/NUITKA_PYTHONPATH to prevent uv's Python 3.13 from hijacking the system Python 3.11
    delete env.PYTHONHOME;
    delete env.NUITKA_PYTHONPATH;

    // Inject Forge LLM credentials for Python agents (primary LLM provider)
    // Forge is OpenAI-compatible, so Python agents use it via the OpenAI SDK
    if (process.env.BUILT_IN_FORGE_API_URL) {
      env.FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
    }
    if (process.env.BUILT_IN_FORGE_API_KEY) {
      env.FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
    }

    // Inject user credentials as environment variables
    for (const cred of credentials) {
      if (cred.keyName && cred.encryptedValue) {
        // The encryptedValue is stored as-is (application-layer "encryption" is just the raw value
        // in this prototype — production would use proper encryption/decryption here)
        env[cred.keyName] = cred.encryptedValue;
      }
    }

    // Spawn the Python process
    // Use system Python 3.11 explicitly to avoid uv's Python 3.13 which has import issues
    const proc = spawn("/usr/bin/python3.11", [AGENT_RUNNER_PATH], {
      cwd: LAUNCHOPS_DIR,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Track for cancellation
    if (executionId) {
      activeProcesses.set(executionId, proc);
    }

    const events: AgentEvent[] = [];
    let lastResult: AgentEvent | null = null;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let settled = false;

    // Timeout handler
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGTERM");
        reject(new Error(`Agent timed out after ${timeout / 1000}s: ${task.label}`));
      }
    }, timeout);

    // Parse JSON lines from stdout
    proc.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      // Keep the last incomplete line in the buffer
      stdoutBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event: AgentEvent = JSON.parse(line);
          events.push(event);

          // Track the last result event
          if (event.event === "result") {
            lastResult = event;
          }

          // Forward real-time events to the callback
          if (onEvent) {
            onEvent(event);
          }
        } catch {
          // Non-JSON output — treat as a log line
          const logEvent: AgentEvent = {
            event: "log",
            level: "debug",
            message: line,
          };
          events.push(logEvent);
          if (onEvent) onEvent(logEvent);
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
    });

    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (executionId) {
        activeProcesses.delete(executionId);
      }

      // Process any remaining stdout buffer
      if (stdoutBuffer.trim()) {
        try {
          const event: AgentEvent = JSON.parse(stdoutBuffer);
          events.push(event);
          if (event.event === "result") lastResult = event;
        } catch {
          events.push({ event: "log", level: "debug", message: stdoutBuffer });
        }
      }

      // Determine the result
      if (lastResult && lastResult.event === "result") {
        resolve({
          success: lastResult.success ?? (code === 0),
          data: lastResult.data ?? {},
          events,
          mode: lastResult.data?.mode === "llm_fallback" ? "llm_fallback" : "python",
        });
      } else if (code === 0) {
        // Process exited cleanly but no explicit result event
        resolve({
          success: true,
          data: {
            summary: `${task.label} completed`,
            actions: [],
            outputs: {},
            recommendations: [],
          },
          events,
          mode: "python",
        });
      } else {
        // Process failed
        const errorMsg =
          events.find((e) => e.event === "error")?.message ??
          stderrBuffer.trim().slice(0, 500) ??
          `Agent process exited with code ${code}`;

        reject(new Error(errorMsg));
      }
    });

    proc.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (executionId) activeProcesses.delete(executionId);
      reject(new Error(`Failed to spawn Python agent: ${err.message}`));
    });

    // Write the task payload to stdin and close
    const payload: Record<string, unknown> = {
      agentId: task.agentId,
      label: task.label,
      description: task.description,
      config: task.config,
      context: { ...businessContext, ...(task.context ?? {}) },
      taskType: task.taskType,
    };

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

/**
 * Cancel a running execution by killing its Python process.
 */
export function cancelExecution(executionId: number): boolean {
  const proc = activeProcesses.get(executionId);
  if (proc) {
    proc.kill("SIGTERM");
    activeProcesses.delete(executionId);
    return true;
  }
  return false;
}

/**
 * Check if an execution has an active Python process.
 */
export function isExecutionRunning(executionId: number): boolean {
  return activeProcesses.has(executionId);
}

/**
 * Get the count of currently active agent processes.
 */
export function getActiveProcessCount(): number {
  return activeProcesses.size;
}
