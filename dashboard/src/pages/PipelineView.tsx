import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Rocket,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { getStages, executeStage, executePipeline, resetPipeline } from '../lib/api'

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={18} className="text-emerald-400" />
    case 'current':
      return <ArrowRight size={18} className="text-amber-400" />
    case 'running':
      return <Loader2 size={18} className="text-blue-400 animate-spin" />
    case 'error':
      return <XCircle size={18} className="text-red-400" />
    default:
      return <Clock size={18} className="text-gray-600" />
  }
}

export default function PipelineView() {
  const queryClient = useQueryClient()
  const stages = useQuery({ queryKey: ['stages'], queryFn: getStages })
  const [running, setRunning] = useState(false)
  const [events, setEvents] = useState<Array<{ event: string; data: any; time: string }>>([])
  const [executingStage, setExecutingStage] = useState<string | null>(null)

  const stageData = stages.data?.stages || []

  const handleLaunchAll = () => {
    setRunning(true)
    setEvents([])
    executePipeline((event, data) => {
      setEvents((prev) => [...prev, { event, data, time: new Date().toLocaleTimeString() }])
      if (event === 'stage_complete' || event === 'stage_error') {
        queryClient.invalidateQueries({ queryKey: ['stages'] })
      }
      if (event === 'pipeline_complete') {
        setRunning(false)
        queryClient.invalidateQueries({ queryKey: ['stages'] })
        queryClient.invalidateQueries({ queryKey: ['runs'] })
      }
    })
  }

  const handleRunStage = async (stageName: string) => {
    setExecutingStage(stageName)
    try {
      await executeStage(stageName)
      queryClient.invalidateQueries({ queryKey: ['stages'] })
    } catch (e) {
      console.error(e)
    }
    setExecutingStage(null)
  }

  const handleReset = async () => {
    await resetPipeline()
    queryClient.invalidateQueries({ queryKey: ['stages'] })
    setEvents([])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Rocket size={24} className="text-emerald-400" />
            Launch Pipeline
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {stages.data?.total || 10} stages — {stages.data?.current_stage || 'init'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={handleLaunchAll}
            disabled={running}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 font-medium text-sm"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? 'Running...' : 'Launch All'}
          </button>
        </div>
      </div>

      {/* Stage cards */}
      <div className="grid grid-cols-2 gap-4">
        {stageData.map((stage: any) => (
          <div
            key={stage.name}
            className={`bg-gray-900 border rounded-xl p-4 ${
              stage.status === 'current'
                ? 'border-amber-700'
                : stage.status === 'completed'
                ? 'border-emerald-800'
                : 'border-gray-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <StatusIcon status={executingStage === stage.name ? 'running' : stage.status} />
                <h3 className="font-semibold text-white capitalize">{stage.name}</h3>
              </div>
              <span className="text-xs text-gray-500">Stage {stage.index + 1}</span>
            </div>
            <div className="text-xs text-gray-500 mb-3">
              Agents: {stage.agents?.join(', ') || 'none'}
            </div>
            <button
              onClick={() => handleRunStage(stage.name)}
              disabled={running || executingStage === stage.name}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 text-xs"
            >
              {executingStage === stage.name ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
              Run Stage
            </button>
          </div>
        ))}
      </div>

      {/* Event feed */}
      {events.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="font-semibold text-gray-200 mb-3">Execution Events</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
            {events.map((e, i) => (
              <div key={i} className="flex gap-3 py-1 border-b border-gray-800/50">
                <span className="text-gray-600 w-20 shrink-0">{e.time}</span>
                <span
                  className={`w-28 shrink-0 ${
                    e.event.includes('error')
                      ? 'text-red-400'
                      : e.event.includes('complete')
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {e.event}
                </span>
                <span className="text-gray-400 truncate">
                  {e.data.stage || e.data.run_id || JSON.stringify(e.data).slice(0, 80)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
