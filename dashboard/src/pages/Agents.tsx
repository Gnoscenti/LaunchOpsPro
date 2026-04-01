import { useQuery } from '@tanstack/react-query'
import { Activity, Code } from 'lucide-react'
import { getAgents } from '../lib/api'

export default function Agents() {
  const { data, isLoading } = useQuery({ queryKey: ['agents'], queryFn: getAgents })

  const agents = data?.agents || {}
  const handlers = data?.stage_handlers || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity size={24} className="text-emerald-400" />
          Agents
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {data?.count || 0} agents loaded — {handlers.length} stage handlers registered
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(agents).map(([name, info]: [string, any]) => {
          const isHandler = handlers.includes(name)
          return (
            <div
              key={name}
              className={`bg-gray-900 border rounded-xl p-4 ${
                isHandler ? 'border-emerald-800' : 'border-gray-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-sm">{name}</h3>
                {isHandler && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900 text-emerald-300">
                    handler
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Code size={10} />
                {info.class}
              </div>
              <div className="flex flex-wrap gap-1">
                {info.methods.slice(0, 8).map((m: string) => (
                  <span key={m} className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
                    {m}
                  </span>
                ))}
                {info.methods.length > 8 && (
                  <span className="px-1.5 py-0.5 text-xs text-gray-600">
                    +{info.methods.length - 8} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isLoading && <div className="text-center text-gray-500 py-8">Loading agents...</div>}
    </div>
  )
}
