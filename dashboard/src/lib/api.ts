/**
 * LaunchOps API client
 * ---------------------
 * Talks to the Atlas API (http://localhost:8001 by default) and exposes:
 *   - getStages / getRuns / resetPipeline         REST
 *   - executeStage                                 REST (single stage)
 *   - executePipeline / executeGovernedPipeline    SSE streaming
 *
 * The SSE helpers use the native `fetch` + ReadableStream API (NOT
 * EventSource) because EventSource only supports GET — our /atlas/execute
 * endpoints are POST with a JSON body. The parser handles multi-line
 * `event:` / `data:` frames per the SSE spec.
 */

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8001'

type SSEHandler = (event: string, data: any) => void

// ── REST helpers ───────────────────────────────────────────────────────────

async function _json<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} ${path}`)
  }
  return res.json()
}

export interface HealthResponse {
  status: string
  agents_loaded?: number
  handlers_registered?: number
  [key: string]: unknown
}

export const getHealth = () => _json<HealthResponse>('/health')
export const getStages = () => _json('/atlas/stages')
export const getStatus = () => _json('/atlas/status')
export const getRuns = (limit = 20) => _json(`/atlas/runs?limit=${limit}`)
export const getAgents = () => _json('/atlas/agents')
export const getContext = () => _json('/atlas/context')
export const getLogs = (limit = 200, level?: string) => {
  const params = new URLSearchParams({ limit: String(limit) })
  if (level) params.set('level', level)
  return _json(`/atlas/logs?${params}`)
}
export const getArtifacts = () => _json('/artifacts/')
export const downloadArtifact = (id: string) => `${API_BASE}/artifacts/${id}/download`
export const getServices = () => _json('/services/')
export const getPrompts = () => _json('/prompts')
export const getPrompt = (id: string) => _json(`/prompts/${id}`)
export const getPermissions = () => _json('/permissions')

export const resetPipeline = () =>
  _json('/atlas/reset', { method: 'POST', body: '{}' })

export const executeStage = (stage: string) =>
  _json('/atlas/execute/stage', {
    method: 'POST',
    body: JSON.stringify({ stage }),
  })

// Phase 2 governance endpoints
export const getV2Status = () => _json('/atlas/v2/status')

// ── SSE streaming helpers ──────────────────────────────────────────────────

/**
 * Run the entire pipeline (Phase 1 sync, via /atlas/execute) and stream
 * SSE events to `onEvent`. Returns a cancel function.
 */
export function executePipeline(
  onEvent: SSEHandler,
  body: Record<string, any> = {},
): () => void {
  return _postSSE('/atlas/execute', body, onEvent)
}

/**
 * Phase 2: Run the pipeline through ProofGuard governance with per-agent
 * SSE events (agent_propose, proofguard_verdict, hitl_waiting, ui_component,
 * agent_result, …). This is the preferred entrypoint for the dashboard.
 */
export function executeGovernedPipeline(
  onEvent: SSEHandler,
  body: Record<string, any> = {},
): () => void {
  return _postSSE('/atlas/v2/execute', body, onEvent)
}

// ── SSE internals ──────────────────────────────────────────────────────────

function _postSSE(
  path: string,
  body: Record<string, any>,
  onEvent: SSEHandler,
): () => void {
  const controller = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        throw new Error(`${res.status} ${res.statusText}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      // Each SSE frame is separated by a blank line ("\n\n"). Within a frame:
      //   event: <name>
      //   data: <json>
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let sep
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          _dispatchFrame(frame, onEvent)
        }
      }
      if (buffer.trim()) _dispatchFrame(buffer, onEvent)
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        // eslint-disable-next-line no-console
        console.error(`[SSE ${path}]`, err)
        onEvent('error', { error: String(err) })
      }
    }
  })()

  return () => controller.abort()
}

function _dispatchFrame(frame: string, onEvent: SSEHandler) {
  let eventName = 'message'
  let dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  const raw = dataLines.join('\n')
  if (!raw) return
  let data: any = raw
  try {
    data = JSON.parse(raw)
  } catch {
    // Leave as string if not JSON
  }
  onEvent(eventName, data)
}
