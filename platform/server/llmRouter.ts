/**
 * Atlas Orchestrator — Multi-Provider LLM Router
 *
 * Mirrors the Python LLMClient architecture with:
 *   - Primary/fallback provider routing (Forge/OpenAI ↔ Anthropic)
 *   - Per-agent model preference from the Agent Registry
 *   - Health checks and availability tracking
 *   - Structured JSON output with schema enforcement
 *   - Token usage tracking per provider
 *
 * Provider hierarchy:
 *   1. Agent's modelPreference from registry → selects provider
 *   2. Primary provider (Forge/OpenAI by default)
 *   3. Fallback provider (Anthropic if primary fails, or vice versa)
 *
 * Forward-looking design (2026-2027):
 *   - Provider interface is extensible for Hugging Face, Mistral, etc.
 *   - Model preference is a hint, not a hard requirement
 *   - Health checks run lazily (on first use or after failure)
 */

import { ENV } from "./_core/env";
import type { InvokeResult, Message, ResponseFormat, Tool, ToolChoice } from "./_core/llm";
import type { AgentDefinition } from "./agentRegistry";

// ─── Provider Types ────────────────────────────────────────────────────────

export type LLMProvider = "forge" | "anthropic" | "huggingface";

export type ModelPreference = "fast" | "balanced" | "deep-reasoning";

interface ProviderConfig {
  id: LLMProvider;
  name: string;
  available: boolean;
  lastChecked: number;
  lastError?: string;
  totalCalls: number;
  totalTokens: number;
  avgLatencyMs: number;
}

interface LLMRequest {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  maxTokens?: number;
  responseFormat?: ResponseFormat;
  temperature?: number;
}

interface LLMResponse extends InvokeResult {
  provider: LLMProvider;
  latencyMs: number;
}

// ─── Provider State ────────────────────────────────────────────────────────

const providers: Map<LLMProvider, ProviderConfig> = new Map([
  [
    "forge",
    {
      id: "forge",
      name: "Forge (OpenAI-compatible)",
      available: true,
      lastChecked: 0,
      totalCalls: 0,
      totalTokens: 0,
      avgLatencyMs: 0,
    },
  ],
  [
    "anthropic",
    {
      id: "anthropic",
      name: "Anthropic Claude",
      available: false, // Set to true when ANTHROPIC_API_KEY is available
      lastChecked: 0,
      totalCalls: 0,
      totalTokens: 0,
      avgLatencyMs: 0,
    },
  ],
]);

// ─── Model Mapping ─────────────────────────────────────────────────────────

const MODEL_MAP: Record<ModelPreference, Record<LLMProvider, string>> = {
  fast: {
    forge: "gemini-2.5-flash",
    anthropic: "claude-sonnet-4-20250514",
    huggingface: "meta-llama/Llama-3.3-70B-Instruct",
  },
  balanced: {
    forge: "gemini-2.5-flash",
    anthropic: "claude-sonnet-4-20250514",
    huggingface: "meta-llama/Llama-3.3-70B-Instruct",
  },
  "deep-reasoning": {
    forge: "gemini-2.5-flash",
    anthropic: "claude-sonnet-4-20250514",
    huggingface: "meta-llama/Llama-3.3-70B-Instruct",
  },
};

// ─── Preference → Provider Routing ─────────────────────────────────────────

function getPreferredProvider(preference: ModelPreference): LLMProvider {
  // Deep reasoning prefers Anthropic when available
  if (preference === "deep-reasoning") {
    const anthropic = providers.get("anthropic");
    if (anthropic?.available) return "anthropic";
  }
  // Default to Forge for everything else
  return "forge";
}

function getFallbackProvider(primary: LLMProvider): LLMProvider {
  if (primary === "forge") return "anthropic";
  return "forge";
}

// ─── Provider Initialization ───────────────────────────────────────────────

function initializeProviders() {
  // Check Anthropic availability (but don't re-enable if disabled due to credit/billing errors)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropicConfig = providers.get("anthropic")!;
  const wasBillingDisabled = !anthropicConfig.available && anthropicConfig.lastError?.includes("credit balance");
  if (!wasBillingDisabled) {
    anthropicConfig.available = !!anthropicKey && anthropicKey.length > 10;
  }
  anthropicConfig.lastChecked = Date.now();

  // Forge is always available (built-in)
  const forgeConfig = providers.get("forge")!;
  forgeConfig.available = !!ENV.forgeApiKey;
  forgeConfig.lastChecked = Date.now();
}

// Initialize on module load
initializeProviders();

// ─── Forge (OpenAI-compatible) Provider ────────────────────────────────────

async function callForge(request: LLMRequest, model: string): Promise<InvokeResult> {
  const apiUrl = ENV.forgeApiUrl
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

  const payload: Record<string, unknown> = {
    model,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: request.maxTokens ?? 32768,
    thinking: { budget_tokens: 128 },
  };

  if (request.tools && request.tools.length > 0) {
    payload.tools = request.tools;
  }

  if (request.toolChoice) {
    payload.tool_choice = request.toolChoice;
  }

  if (request.responseFormat) {
    payload.response_format = request.responseFormat;
  }

  if (request.temperature !== undefined) {
    payload.temperature = request.temperature;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Forge API error: ${response.status} ${response.statusText} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}

// ─── Anthropic Provider ────────────────────────────────────────────────────

async function callAnthropic(request: LLMRequest, model: string): Promise<InvokeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Extract system message from the messages array
  const systemMessages = request.messages.filter((m) => m.role === "system");
  const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

  const systemContent = systemMessages
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join("\n\n");

  const anthropicMessages = nonSystemMessages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));

  const payload: Record<string, unknown> = {
    model,
    max_tokens: request.maxTokens ?? 8192,
    system: systemContent || undefined,
    messages: anthropicMessages,
  };

  if (request.temperature !== undefined) {
    payload.temperature = request.temperature;
  }

  // Anthropic doesn't support response_format directly — we inject schema into system prompt
  // for structured output and parse the result
  if (request.responseFormat?.type === "json_schema") {
    const schema = (request.responseFormat as { type: "json_schema"; json_schema: { schema: unknown } }).json_schema;
    payload.system = `${systemContent}\n\nYou MUST respond with ONLY valid JSON matching this schema:\n${JSON.stringify(schema.schema, null, 2)}\nNo markdown, no explanation, no code fences. ONLY the JSON object.`;
  } else if (request.responseFormat?.type === "json_object") {
    payload.system = `${systemContent}\n\nYou MUST respond with ONLY valid JSON. No markdown, no explanation, no code fences. ONLY the JSON object.`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const anthropicResult = (await response.json()) as {
    id: string;
    model: string;
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens: number; output_tokens: number };
    stop_reason?: string;
  };

  // Convert Anthropic response to OpenAI-compatible format
  const textContent = anthropicResult.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");

  return {
    id: anthropicResult.id,
    created: Math.floor(Date.now() / 1000),
    model: anthropicResult.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent,
        },
        finish_reason: anthropicResult.stop_reason ?? "stop",
      },
    ],
    usage: anthropicResult.usage
      ? {
          prompt_tokens: anthropicResult.usage.input_tokens,
          completion_tokens: anthropicResult.usage.output_tokens,
          total_tokens: anthropicResult.usage.input_tokens + anthropicResult.usage.output_tokens,
        }
      : undefined,
  };
}

// ─── Main Router ───────────────────────────────────────────────────────────

/**
 * Route an LLM request through the multi-provider system.
 *
 * Uses the agent's model preference to select the primary provider,
 * then falls back to the secondary provider on failure.
 */
export async function routeLLM(
  request: LLMRequest,
  agentDef?: AgentDefinition
): Promise<LLMResponse> {
  // Re-check provider availability
  initializeProviders();

  const preference: ModelPreference = agentDef?.modelPreference ?? "balanced";
  const primaryProvider = getPreferredProvider(preference);
  const fallbackProvider = getFallbackProvider(primaryProvider);

  const primaryModel = MODEL_MAP[preference][primaryProvider];
  const fallbackModel = MODEL_MAP[preference][fallbackProvider];

  // Try primary provider
  const primaryConfig = providers.get(primaryProvider)!;
  if (primaryConfig.available) {
    try {
      const start = Date.now();
      const result = await callProvider(primaryProvider, request, primaryModel);
      const latency = Date.now() - start;

      // Update stats
      primaryConfig.totalCalls++;
      primaryConfig.totalTokens += result.usage?.total_tokens ?? 0;
      primaryConfig.avgLatencyMs =
        (primaryConfig.avgLatencyMs * (primaryConfig.totalCalls - 1) + latency) /
        primaryConfig.totalCalls;

      return { ...result, provider: primaryProvider, latencyMs: latency };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      primaryConfig.lastError = msg;
      // If billing/credit error, mark provider unavailable for this session to avoid retrying
      if (msg.includes("credit balance") || msg.includes("billing") || msg.includes("insufficient_quota")) {
        primaryConfig.available = false;
        console.warn(`[LLM Router] Primary (${primaryProvider}) disabled — billing/credit issue`);
      } else {
        console.warn(`[LLM Router] Primary (${primaryProvider}) failed: ${msg}`);
      }
    }
  }

  // Try fallback provider
  const fallbackConfig = providers.get(fallbackProvider)!;
  if (fallbackConfig.available) {
    try {
      const start = Date.now();
      const result = await callProvider(fallbackProvider, request, fallbackModel);
      const latency = Date.now() - start;

      fallbackConfig.totalCalls++;
      fallbackConfig.totalTokens += result.usage?.total_tokens ?? 0;
      fallbackConfig.avgLatencyMs =
        (fallbackConfig.avgLatencyMs * (fallbackConfig.totalCalls - 1) + latency) /
        fallbackConfig.totalCalls;

      return { ...result, provider: fallbackProvider, latencyMs: latency };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      fallbackConfig.lastError = msg;
      console.warn(`[LLM Router] Fallback (${fallbackProvider}) also failed: ${msg}`);
    }
  }

  throw new Error(
    `All LLM providers failed. Primary: ${primaryProvider} (${primaryConfig.lastError ?? "unavailable"}), Fallback: ${fallbackProvider} (${fallbackConfig.lastError ?? "unavailable"})`
  );
}

function callProvider(provider: LLMProvider, request: LLMRequest, model: string): Promise<InvokeResult> {
  switch (provider) {
    case "forge":
      return callForge(request, model);
    case "anthropic":
      return callAnthropic(request, model);
    default:
      throw new Error(`Provider ${provider} not implemented`);
  }
}

// ─── Health Check ──────────────────────────────────────────────────────────

export interface ProviderHealth {
  id: LLMProvider;
  name: string;
  available: boolean;
  lastChecked: number;
  lastError?: string;
  totalCalls: number;
  totalTokens: number;
  avgLatencyMs: number;
}

/**
 * Get the health status of all configured providers.
 */
export function getProviderHealth(): ProviderHealth[] {
  initializeProviders();
  return Array.from(providers.values()).map((p) => ({ ...p }));
}

/**
 * Get the list of available provider IDs.
 */
export function getAvailableProviders(): LLMProvider[] {
  initializeProviders();
  return Array.from(providers.values())
    .filter((p) => p.available)
    .map((p) => p.id);
}

/**
 * Get the model that would be used for a given agent.
 */
export function getModelForAgent(agentDef?: AgentDefinition): { provider: LLMProvider; model: string } {
  const preference: ModelPreference = agentDef?.modelPreference ?? "balanced";
  const provider = getPreferredProvider(preference);
  const model = MODEL_MAP[preference][provider];
  return { provider, model };
}

/**
 * Get routing stats for monitoring.
 */
export function getRoutingStats(): {
  providers: ProviderHealth[];
  totalCalls: number;
  totalTokens: number;
  primaryProvider: LLMProvider;
  anthropicAvailable: boolean;
} {
  const health = getProviderHealth();
  return {
    providers: health,
    totalCalls: health.reduce((sum, p) => sum + p.totalCalls, 0),
    totalTokens: health.reduce((sum, p) => sum + p.totalTokens, 0),
    primaryProvider: "forge",
    anthropicAvailable: providers.get("anthropic")?.available ?? false,
  };
}
