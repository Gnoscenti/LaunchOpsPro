/**
 * MissionControl
 * ---------------
 * Live deployment stream view. Connects to /api/v1/atlas/stream/{id} via
 * EventSource (GET) and renders a timeline of pipeline events with inline
 * Generative UI widgets, governance gate statuses, and a completion state.
 *
 * Used by the Onboarding page's Phase 3 (deploy) view.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Rocket,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react'
import { API_BASE } from '../../lib/api'
import GenerativeUIRenderer from './GenerativeUIRenderer'
import type { UIComponentPayload } from '../../lib/componentRegistry'

interface MissionControlProps {
  deploymentId: string
  vertical: string
  businessName: string
  onBack: () => void
}

interface TimelineEntry {
  time: string
  event: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  color: string
}

export default function MissionControl({
  deploymentId,
  vertical,
  businessName,
  onBack,
}: MissionControlProps) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [uiPayloads, setUIPayloads] = useState<UIComponentPayload[]>([])
  const [status, setStatus] = useState<'connecting' | 'running' | 'completed' | 'failed'>(
    'connecting',
  )
  const [stagesCompleted, setStagesCompleted] = useState(0)
  const [stagesTotal, setStagesTotal] = useState(10)
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const url = `${API_BASE}/api/v1/atlas/stream/${deploymentId}`
    const es = new EventSource(url)

    const eventNames = [
      'connected',
      'pipeline_start',
      'stage_start',
      'stage_complete',
      'stage_error',
      'pipeline_complete',
      'pipeline_error',
      'governance_halt',
      'governance_gate_passed',
      'governance_gate_blocked',
      'governance_gate_warning',
      'proofguard_verdict',
      'agent_propose',
      'agent_executing',
      'agent_result',
      'hitl_waiting',
      'hitl_resumed',
      'ui_component',
      'stream_end',
    ]

    const handler = (event: string) => (e: MessageEvent) => {
      let data: unknown = e.data
      try {
        data = JSON.parse(e.data)
      } catch {
        /* leave as string */
      }

      const entry: TimelineEntry = {
        time: new Date().toLocaleTimeString(),
        event,
        data,
        color: eventColor(event),
      }

      // Handle specific events
      if (event === 'pipeline_start' && typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>
        setStagesTotal(Number(d.total || 10))
        setStatus('running')
      }
      if (event === 'stage_start' && typeof data === 'object' && data !== null) {
        setCurrentStage((data as Record<string, unknown>).stage as string)
      }
      if (event === 'stage_complete') {
        setStagesCompleted((prev) => prev + 1)
      }
      if (event === 'pipeline_complete' || event === 'stream_end') {
        setStatus('completed')
      }
      if (event === 'pipeline_error' || event === 'governance_halt') {
        setStatus('failed')
      }
      if (event === 'ui_component' && typeof data === 'object' && data !== null) {
        setUIPayloads((prev) => [...prev, data as UIComponentPayload])
      }

      setTimeline((prev) => [...prev, entry])
    }

    eventNames.forEach((name) => {
      es.addEventListener(name, handler(name) as EventListener)
    })

    es.onerror = () => {
      setStatus('failed')
      es.close()
    }

    return () => es.close()
  }, [deploymentId])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline.length])

  const progressPct = stagesTotal > 0 ? Math.round((stagesCompleted / stagesTotal) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-2"
          >
            <ChevronLeft size={14} /> Back to Onboarding
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Rocket size={24} className="text-emerald-400" />
            Mission Control
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {vertical} Launch — <span className="text-white font-medium">{businessName}</span>
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>
            {currentStage ? (
              <>
                Stage: <span className="text-white font-medium">{currentStage}</span>
              </>
            ) : (
              'Waiting...'
            )}
          </span>
          <span>
            {stagesCompleted}/{stagesTotal} ({progressPct}%)
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              status === 'failed' ? 'bg-red-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Generative UI widgets */}
      {uiPayloads.length > 0 && (
        <div className="space-y-3 mb-6">
          <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400" />
            Agent Output ({uiPayloads.length})
          </h3>
          {uiPayloads.map((p, i) => (
            <GenerativeUIRenderer
              key={p.id || `${p.component}-${i}`}
              payload={p}
              showAttribution
            />
          ))}
        </div>
      )}

      {/* Event timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          Deployment Log
          <span className="text-xs text-gray-500 font-normal">
            ({timeline.length} events)
          </span>
        </h3>
        <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
          {timeline.map((entry, i) => (
            <div key={i} className="flex gap-3 py-1 border-b border-gray-800/50">
              <span className="text-gray-600 w-20 shrink-0">{entry.time}</span>
              <span className={`w-40 shrink-0 ${entry.color}`}>
                {formatEventName(entry.event)}
              </span>
              <span className="text-gray-400 truncate">
                {formatEventData(entry.event, entry.data)}
              </span>
            </div>
          ))}
          {status === 'running' && (
            <div className="flex items-center gap-2 py-2 text-gray-500">
              <Loader2 size={12} className="animate-spin" />
              Streaming...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Completion state */}
      {status === 'completed' && (
        <div className="mt-6 p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-xl text-center">
          <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
          <div className="text-lg font-bold text-emerald-300">
            {businessName} is deployed.
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {stagesCompleted} stages completed. Check the Artifacts page for generated documents.
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; icon: JSX.Element }> = {
    connecting: {
      bg: 'bg-blue-950/40 border-blue-900/60',
      text: 'text-blue-300',
      icon: <Clock size={12} />,
    },
    running: {
      bg: 'bg-amber-950/40 border-amber-900/60',
      text: 'text-amber-300',
      icon: <Loader2 size={12} className="animate-spin" />,
    },
    completed: {
      bg: 'bg-emerald-950/40 border-emerald-900/60',
      text: 'text-emerald-300',
      icon: <CheckCircle2 size={12} />,
    },
    failed: {
      bg: 'bg-red-950/40 border-red-900/60',
      text: 'text-red-300',
      icon: <XCircle size={12} />,
    },
  }
  const c = configs[status] || configs.connecting
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${c.bg} ${c.text}`}
    >
      {c.icon}
      {status}
    </span>
  )
}

function eventColor(event: string): string {
  if (event.includes('error') || event === 'governance_halt') return 'text-red-400'
  if (event.includes('complete') || event === 'hitl_resumed') return 'text-emerald-400'
  if (event === 'governance_gate_passed') return 'text-emerald-400'
  if (event === 'governance_gate_blocked') return 'text-red-400'
  if (event === 'governance_gate_warning') return 'text-amber-400'
  if (event === 'proofguard_verdict') return 'text-purple-400'
  if (event === 'hitl_waiting') return 'text-amber-400'
  if (event === 'ui_component') return 'text-sky-400'
  if (event === 'agent_propose') return 'text-blue-400'
  return 'text-gray-400'
}

function formatEventName(event: string): string {
  return event
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatEventData(event: string, data: any): string {
  if (!data || typeof data !== 'object') return String(data ?? '')
  if (event === 'proofguard_verdict')
    return `${data.agent || '?'} → ${data.status} (CQS ${data.cqs_score ?? '?'})`
  if (event === 'governance_gate_passed')
    return `Gate "${data.gate}" passed for stage ${data.stage}`
  if (event === 'governance_gate_blocked')
    return `Gate "${data.gate}" BLOCKED: missing=${JSON.stringify(data.missing_stages)}`
  if (event === 'agent_propose')
    return `${data.agent || '?'} drafting plan @ ${data.stage || '?'}`
  if (event === 'agent_result')
    return `${data.agent || '?'} → ${data.status || '?'}`
  if (event === 'stage_start')
    return `${data.stage} (${data.index + 1}/${data.total})`
  if (event === 'stage_complete')
    return `${data.stage} completed`
  if (event === 'ui_component')
    return `${data.component} from ${data.source_agent || '?'}`
  return data.stage || data.deployment_id || JSON.stringify(data).slice(0, 60)
}
