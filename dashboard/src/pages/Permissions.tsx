import { useQuery } from '@tanstack/react-query'
import { Shield, Lock, Unlock } from 'lucide-react'
import { getPermissions } from '../lib/api'

export default function Permissions() {
  const { data } = useQuery({ queryKey: ['permissions'], queryFn: getPermissions })

  const enabled = data?.human_approval_enabled || false
  const operations = data?.operations_requiring_approval || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield size={24} className="text-emerald-400" />
          Permissions
        </h1>
        <p className="text-gray-500 text-sm mt-1">Human approval and operation controls</p>
      </div>

      {/* Approval status */}
      <div className={`bg-gray-900 border rounded-xl p-5 ${enabled ? 'border-amber-700' : 'border-emerald-800'}`}>
        <div className="flex items-center gap-3">
          {enabled ? (
            <Lock size={20} className="text-amber-400" />
          ) : (
            <Unlock size={20} className="text-emerald-400" />
          )}
          <div>
            <h3 className="font-semibold text-white">
              Human Approval: {enabled ? 'Enabled' : 'Disabled'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {enabled
                ? 'Operations listed below require manual approval before execution.'
                : 'Tier 3 — No guardrails. All operations execute without approval. Set ENABLE_HUMAN_APPROVAL=true in .env to enable.'}
            </p>
          </div>
        </div>
      </div>

      {/* Operations requiring approval */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="font-semibold text-gray-200 mb-3">
          Operations Requiring Approval (when enabled)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {operations.map((op: string) => (
            <div key={op} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
              <Lock size={12} className={enabled ? 'text-amber-400' : 'text-gray-600'} />
              <span className="text-sm text-gray-300 font-mono">{op}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
