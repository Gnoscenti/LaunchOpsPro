import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { getLogs } from '../lib/api'

export default function Logs() {
  const [level, setLevel] = useState<string | undefined>(undefined)
  const { data, isLoading } = useQuery({
    queryKey: ['logs', level],
    queryFn: () => getLogs(200, level),
  })

  const logs = data?.logs || []

  const levelColors: Record<string, string> = {
    info: 'text-blue-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
    stage_start: 'text-cyan-400',
    stage_complete: 'text-emerald-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ScrollText size={24} className="text-emerald-400" />
            Audit Log
          </h1>
          <p className="text-gray-500 text-sm mt-1">{data?.total || 0} entries</p>
        </div>
        <div className="flex gap-2">
          {['all', 'info', 'success', 'warning', 'error'].map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l === 'all' ? undefined : l)}
              className={`px-3 py-1 rounded-lg text-xs ${
                (l === 'all' && !level) || l === level
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 max-h-[600px] overflow-y-auto">
        <div className="space-y-1 font-mono text-xs">
          {logs.map((entry: any, i: number) => (
            <div key={i} className="flex gap-3 py-1 border-b border-gray-800/30">
              <span className="text-gray-600 w-36 shrink-0">
                {entry.timestamp || entry.time || '—'}
              </span>
              <span className={`w-20 shrink-0 ${levelColors[entry.level || entry.status] || 'text-gray-400'}`}>
                {entry.level || entry.status || '—'}
              </span>
              <span className="text-gray-300 break-all">
                {entry.message || entry.details || JSON.stringify(entry)}
              </span>
            </div>
          ))}
          {logs.length === 0 && !isLoading && (
            <div className="text-gray-600 text-center py-4">No log entries</div>
          )}
        </div>
      </div>
    </div>
  )
}
