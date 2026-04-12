/**
 * useAgentStream
 * ---------------
 * Connects to a LaunchOps SSE endpoint and accumulates a stream of blocks
 * that mix free text and Generative UI widgets. The React view maps over
 * the returned `blocks` array and renders each one — text as markdown,
 * UI payloads through the GenerativeUIRenderer.
 *
 * Accepts TWO transport modes:
 *
 *   GET (EventSource):
 *     const blocks = useAgentStream({ url: "/dynexecutiv/stream" })
 *     Uses the browser's native EventSource API. Required for endpoints
 *     where auth is cookie-based and you can't control headers.
 *
 *   POST (fetch + ReadableStream):
 *     const blocks = useAgentStream({
 *       url: "/atlas/v2/execute",
 *       method: "POST",
 *       body: { start_stage: "intake" }
 *     })
 *     Required for Phase 2 endpoints that take a JSON body. EventSource
 *     cannot do POST, so we reach for fetch + stream reader instead.
 *
 * Payload recognition (both modes):
 *
 *   1. Native SSE event named `ui_component` with a JSON data frame → parsed
 *      directly into a UI block.
 *   2. In-text `__GUI_PAYLOAD__{...}__GUI_PAYLOAD_END__` markers inside a
 *      `message`-event data string → extracted and inlined between the text
 *      blocks they surround. This is the transport the user's original
 *      agent code uses.
 *
 * The hook returns the blocks array + a small status object so the view
 * can show "streaming..." / "done" / "error" indicators.
 */

import { useEffect, useRef, useState } from 'react'
import { API_BASE } from '../lib/api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>

export type StreamBlock =
  | { type: 'text'; content: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'ui'; componentName: string; props: AnyProps; id: string; sourceAgent?: string }
  | { type: 'event'; name: string; data: unknown }

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error'

export interface UseAgentStreamOptions {
  url: string
  method?: 'GET' | 'POST'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: Record<string, any>
  /** Enable/disable the stream. Defaults to true. */
  enabled?: boolean
  /**
   * Event names to accumulate as `event` blocks (in addition to ui_component
   * + text). Useful for threading pipeline_start/stage_start/etc through
   * the same log.
   */
  captureEvents?: string[]
}

const GUI_START = '__GUI_PAYLOAD__'
const GUI_END = '__GUI_PAYLOAD_END__'
const GUI_MARKER_RE = new RegExp(
  `${escapeRegExp(GUI_START)}(.*?)${escapeRegExp(GUI_END)}`,
  'gs',
)

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function useAgentStream({
  url,
  method = 'POST',
  body,
  enabled = true,
  captureEvents = [],
}: UseAgentStreamOptions) {
  const [blocks, setBlocks] = useState<StreamBlock[]>([])
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Stable handler for incoming events. Defined as a ref so inner closures
  // don't re-create on every render and thrash the EventSource/fetch loop.
  const handleEventRef = useRef<(event: string, data: string) => void>(() => {})

  handleEventRef.current = (event: string, raw: string) => {
    if (event === 'ui_component') {
      try {
        const payload = JSON.parse(raw)
        pushUIBlock(payload)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[useAgentStream] bad ui_component JSON', e)
      }
      return
    }

    if (event === 'message' || event === '') {
      // Plain text chunk — may contain embedded GUI markers
      processTextChunk(raw)
      return
    }

    // Capture structured events (stage_start, proofguard_verdict, etc.)
    if (captureEvents.includes(event)) {
      let parsed: unknown = raw
      try {
        parsed = JSON.parse(raw)
      } catch {
        /* leave as string */
      }
      setBlocks((prev) => [...prev, { type: 'event', name: event, data: parsed }])
    }

    if (event === 'pipeline_complete' || event === 'done') {
      setStatus('done')
    }
    if (event === 'error' || event === 'governance_halt') {
      setStatus('error')
      let msg = raw
      try {
        const parsed = JSON.parse(raw)
        msg = parsed.error || JSON.stringify(parsed)
      } catch {
        /* leave as raw */
      }
      setError(msg)
    }
  }

  function pushUIBlock(payload: {
    component?: string
    props?: AnyProps
    id?: string
    source_agent?: string
  }) {
    if (!payload.component) return
    setBlocks((prev) => [
      ...prev,
      {
        type: 'ui',
        componentName: payload.component!,
        props: payload.props || {},
        id: payload.id || cryptoId(),
        sourceAgent: payload.source_agent,
      },
    ])
  }

  function processTextChunk(raw: string) {
    if (!raw) return
    if (!raw.includes(GUI_START)) {
      appendText(raw)
      return
    }

    // Split the chunk on markers, turning each embedded payload into a UI
    // block and each surrounding segment back into an appended text block.
    let lastIndex = 0
    GUI_MARKER_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = GUI_MARKER_RE.exec(raw)) !== null) {
      const before = raw.slice(lastIndex, match.index)
      if (before) appendText(before)
      try {
        const payload = JSON.parse(match[1])
        pushUIBlock(payload)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[useAgentStream] bad GUI payload JSON', e)
      }
      lastIndex = match.index + match[0].length
    }
    const tail = raw.slice(lastIndex)
    if (tail) appendText(tail)
  }

  function appendText(chunk: string) {
    setBlocks((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.type === 'text') {
        const copy = [...prev]
        copy[copy.length - 1] = { type: 'text', content: last.content + chunk }
        return copy
      }
      return [...prev, { type: 'text', content: chunk }]
    })
  }

  useEffect(() => {
    if (!enabled) return
    setBlocks([])
    setStatus('connecting')
    setError(null)

    // GET + EventSource path (matches the user's original useAgentStream)
    if (method === 'GET') {
      const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
      const es = new EventSource(fullUrl)
      setStatus('streaming')

      es.onmessage = (evt) => handleEventRef.current('message', evt.data)
      es.onerror = () => {
        setStatus('error')
        setError('EventSource connection error')
        es.close()
      }

      // Subscribe to the named events we care about
      const namedEvents = [
        'ui_component',
        'pipeline_complete',
        'governance_halt',
        ...captureEvents,
      ]
      namedEvents.forEach((name) => {
        es.addEventListener(name, ((evt: MessageEvent) => {
          handleEventRef.current(name, evt.data)
        }) as EventListener)
      })

      return () => es.close()
    }

    // POST + fetch + ReadableStream path (for Phase 2 governed endpoints)
    const controller = new AbortController()
    abortRef.current = controller
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
    let sawError = false

    // Shadow the handler to flip a local flag when error events arrive, so
    // the post-loop "done" check can't race with stale React state.
    const outerHandler = handleEventRef.current
    handleEventRef.current = (event, raw) => {
      if (event === 'error' || event === 'governance_halt') sawError = true
      outerHandler(event, raw)
    }

    ;(async () => {
      try {
        const res = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(body ?? {}),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error(`${res.status} ${res.statusText}`)
        }
        setStatus('streaming')

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let sep
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sep)
            buffer = buffer.slice(sep + 2)
            dispatchFrame(frame)
          }
        }
        if (buffer.trim()) dispatchFrame(buffer)
        if (!sawError) setStatus('done')
      } catch (err: unknown) {
        const e = err as { name?: string }
        if (e?.name !== 'AbortError') {
          setStatus('error')
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    })()

    function dispatchFrame(frame: string) {
      let eventName = 'message'
      const dataLines: string[] = []
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim())
        }
      }
      const data = dataLines.join('\n')
      if (!data) return
      handleEventRef.current(eventName, data)
    }

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, method, enabled, JSON.stringify(body)])

  return { blocks, status, error }
}

function cryptoId(): string {
  // Stable-enough ID for React keys; avoids pulling in uuid
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
