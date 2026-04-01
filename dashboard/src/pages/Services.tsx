import { useQuery } from '@tanstack/react-query'
import { Server, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { getServices } from '../lib/api'

export default function Services() {
  const { data, isLoading } = useQuery({ queryKey: ['services'], queryFn: getServices })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Server size={24} className="text-emerald-400" />
          Infrastructure Services
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          LaunchOps Stack — Docker-managed services
        </p>
      </div>

      {/* Summary bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            <span className="text-emerald-400 font-bold text-lg">{data?.up || 0}</span> up
          </div>
          <div className="text-sm text-gray-400">
            <span className="text-red-400 font-bold text-lg">{data?.down || 0}</span> down
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {data?.total || 0} total services
        </div>
      </div>

      {/* Service cards */}
      <div className="grid grid-cols-2 gap-4">
        {(data?.services || []).map((svc: any) => (
          <div
            key={svc.name}
            className={`bg-gray-900 border rounded-xl p-5 ${
              svc.status === 'up' ? 'border-emerald-800' : 'border-red-800'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {svc.status === 'up' ? (
                  <CheckCircle2 size={18} className="text-emerald-400" />
                ) : (
                  <XCircle size={18} className="text-red-400" />
                )}
                <h3 className="font-semibold text-white">{svc.name}</h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  svc.status === 'up'
                    ? 'bg-emerald-900 text-emerald-300'
                    : 'bg-red-900 text-red-300'
                }`}
              >
                {svc.status}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">URL</span>
                <a
                  href={svc.url}
                  target="_blank"
                  rel="noopener"
                  className="text-emerald-400 hover:underline flex items-center gap-1"
                >
                  :{svc.port} <ExternalLink size={10} />
                </a>
              </div>
              {svc.response_time_ms !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Response</span>
                  <span className="text-gray-300">{svc.response_time_ms}ms</span>
                </div>
              )}
              {svc.error && (
                <div className="mt-2 text-xs text-red-400 bg-red-900/20 rounded p-2">
                  {svc.error}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="text-center text-gray-500 py-8">Checking services...</div>
      )}
    </div>
  )
}
