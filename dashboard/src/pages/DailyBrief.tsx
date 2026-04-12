/**
 * DailyBrief
 * ----------
 * Agentic workspace view. Connects to the DynExecutiv stream endpoint via
 * SSE and renders whatever mix of text + Generative UI widgets the agent
 * emits, inline and in order.
 *
 * Two transport modes are supported:
 *
 *   1. GET /dynexecutiv/stream        (native EventSource, no body)
 *   2. POST /atlas/v2/execute         (Phase 2 governed pipeline, with body)
 *
 * Defaults to the DynExecutiv standalone endpoint.
 */

import { useState } from 'react'
import { Sparkles, Play, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { useAgentStream, type StreamBlock } from '../hooks/useAgentStream'
import GenerativeUIRenderer from '../components/generative/GenerativeUIRenderer'

export default function DailyBrief() {
  const [running, setRunning] = useState(false)
  const [bumpKey, setBumpKey] = useState(0)

  const { blocks, status, error } = useAgentStream({
    url: '/dynexecutiv/stream',
    method: 'GET',
    enabled: running,
    // Key on bumpKey indirectly via url; we bump it by toggling enabled
  })

  // Reset → re-run: flip enabled off then back on
  const handleRun = () => {
    setRunning(false)
    setTimeout(() => {
      setRunning(true)
      setBumpKey((k) => k + 1)
    }, 10)
  }
  const handleReset = () => setRunning(false)

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles size={24} className="text-emerald-400" />
            Daily Operations Brief
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            DynExecutiv · {status} {bumpKey > 0 && `· run #${bumpKey}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={!running}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-40 text-sm"
          >
            <RotateCcw size={14} /> Clear
          </button>
          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-medium text-sm"
          >
            {status === 'streaming' || status === 'connecting' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {status === 'streaming' ? 'Streaming…' : 'Generate Brief'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-red-950/40 border border-red-900/60 rounded-lg text-red-300 text-sm">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Generative workspace: text + UI widgets streamed inline */}
      <div className="space-y-4 text-gray-200 leading-relaxed">
        {blocks.length === 0 && !running && (
          <EmptyState onRun={handleRun} />
        )}
        {blocks.map((block, i) => (
          <BlockRenderer key={blockKey(block, i)} block={block} />
        ))}
      </div>
    </div>
  )
}

function BlockRenderer({ block }: { block: StreamBlock }) {
  if (block.type === 'text') {
    // Simple newline-preserving text rendering — swap in react-markdown
    // later if you want richer formatting.
    return (
      <div className="whitespace-pre-wrap text-gray-300">{block.content}</div>
    )
  }
  if (block.type === 'ui') {
    return (
      <GenerativeUIRenderer
        componentName={block.componentName}
        props={block.props}
        showAttribution
      />
    )
  }
  if (block.type === 'event') {
    return (
      <div className="text-xs text-gray-600 font-mono border-l-2 border-gray-800 pl-3">
        {block.name}
      </div>
    )
  }
  return null
}

function blockKey(block: StreamBlock, index: number): string {
  if (block.type === 'ui') return `ui-${block.id}`
  return `${block.type}-${index}`
}

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl">
      <Sparkles size={32} className="mx-auto text-gray-700 mb-3" />
      <div className="text-gray-400 mb-1">No brief generated yet.</div>
      <div className="text-xs text-gray-600 mb-4">
        DynExecutiv will stream narrative, charts, and KPIs into this view.
      </div>
      <button
        onClick={onRun}
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-medium"
      >
        <Play size={14} /> Generate Brief
      </button>
    </div>
  )
}
