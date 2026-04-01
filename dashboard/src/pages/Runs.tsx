import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Clock,
} from 'lucide-react'
import { getRuns, executePipeline } from '../lib/api'
import { useState } from 'react'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-900 text-emerald-300',
    running: 'bg-blue-900 text-blue-300',
    failed: 'bg-red-900 text-red-300',
  }
  const icons: Record<string, any> = {
    completed: <CheckCircle2 size={12} />,
    running: <Loader2 size={12} className="animate-spin" />,
    failed: <XCircle size={12} />,
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-800 text-gray-400'}`}>
      {icons[status] || <Clock size={12} />}
      {status}
    </span>
  )
}

export default function Runs() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['runs'], queryFn: () => getRuns(50) })
  const [rerunning, setRerunning] = useState(false)

  const handleRerun = () => {
    setRerunning(true)
    executePipeline((event, _data) => {
      if (event === 'pipeline_complete') {
        setRerunning(false)
        queryClient.invalidateQueries({ queryKey: ['runs'] })
        queryClient.invalidateQueries({ queryKey: ['stages'] })
      }
    })
  }

  const runs = data?.runs || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History size={24} className="text-emerald-400" />
            Execution History
          </h1>
          <p className="text-gray-500 text-sm mt-1">{data?.total || 0} total runs</p>
        </div>
        <button
          onClick={handleRerun}
          disabled={rerunning}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 text-sm"
        >
          {rerunning ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          {rerunning ? 'Running...' : 'New Run'}
        </button>
      </div>

      <div className="space-y-3">
        {runs.map((run: any) => (
          <div key={run.run_id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-200">{run.run_id}</span>
                <StatusBadge status={run.status} />
              </div>
              <span className="text-xs text-gray-500">{run.started_at}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>Stages: {run.stages_completed || 0}/{run.stages_total || 0}</span>
              {run.completed_at && <span>Completed: {run.completed_at}</span>}
              {run.errors && run.errors.length > 0 && (
                <span className="text-red-400">{run.errors.length} error(s)</span>
              )}
            </div>
            {run.errors && run.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {run.errors.map((err: any, i: number) => (
                  <div key={i} className="text-xs text-red-400 bg-red-900/20 rounded p-2">
                    <span className="font-medium">{err.stage}:</span> {err.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {isLoading && <div className="text-center text-gray-500 py-8">Loading runs...</div>}
      {!isLoading && runs.length === 0 && (
        <div className="text-center text-gray-600 py-12">
          No pipeline runs yet. Click "New Run" or use the Pipeline tab to start.
        </div>
      )}
    </div>
  )
}
