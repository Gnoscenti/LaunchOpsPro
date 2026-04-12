/**
 * HITLApprovalCard
 * ----------------
 * Rendered when Phase2Executor emits a `hitl_waiting` or a ui_component
 * payload with component=HITLApprovalCard. Lets the operator approve or
 * reject a ProofGuard-paused execution intent directly from the dashboard.
 *
 * Props shape matches core/generative_ui.py::hitl_approval_card().
 */

import { useState } from 'react'
import { Shield, Check, X, Loader2 } from 'lucide-react'
import { API_BASE } from '../../lib/api'

interface HITLApprovalCardProps {
  attestationId: string
  agent: string
  stage: string
  planSummary: string
  cqsScore?: number
}

type Decision = 'pending' | 'approving' | 'rejecting' | 'approved' | 'rejected'

export default function HITLApprovalCard({
  attestationId,
  agent,
  stage,
  planSummary,
  cqsScore,
}: HITLApprovalCardProps) {
  const [decision, setDecision] = useState<Decision>('pending')
  const [error, setError] = useState<string | null>(null)

  const act = async (action: 'approve' | 'reject') => {
    setDecision(action === 'approve' ? 'approving' : 'rejecting')
    setError(null)
    try {
      const res = await fetch(
        `${API_BASE}/atlas/v2/hitl/${attestationId}/${action}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      )
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`)
      }
      setDecision(action === 'approve' ? 'approved' : 'rejected')
    } catch (e: unknown) {
      setDecision('pending')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const scoreColor =
    cqsScore === undefined
      ? 'text-gray-400'
      : cqsScore >= 80
      ? 'text-emerald-400'
      : cqsScore >= 50
      ? 'text-amber-400'
      : 'text-red-400'

  const isResolved = decision === 'approved' || decision === 'rejected'

  return (
    <div className="bg-gray-900 border border-amber-900/60 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Shield size={18} className="text-amber-400" />
        <h3 className="font-semibold text-gray-100">
          ProofGuard: Approval Required
        </h3>
        {cqsScore !== undefined && (
          <span className={`ml-auto text-sm font-mono ${scoreColor}`}>
            CQS {cqsScore}/100
          </span>
        )}
      </div>

      <div className="text-sm text-gray-400 mb-2">
        <span className="font-medium text-gray-300">{agent}</span> wants to
        execute during stage{' '}
        <span className="font-medium text-gray-300">{stage}</span>
      </div>

      <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 mb-4 max-h-40 overflow-auto">
        <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
          {planSummary}
        </pre>
      </div>

      {error && (
        <div className="text-xs text-red-400 mb-2">Error: {error}</div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => act('approve')}
          disabled={isResolved || decision === 'approving'}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
        >
          {decision === 'approving' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          {decision === 'approved' ? 'Approved' : 'Approve'}
        </button>
        <button
          onClick={() => act('reject')}
          disabled={isResolved || decision === 'rejecting'}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
        >
          {decision === 'rejecting' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <X size={14} />
          )}
          {decision === 'rejected' ? 'Rejected' : 'Reject'}
        </button>
      </div>

      <div className="text-[10px] text-gray-600 mt-2 font-mono">
        attestation: {attestationId}
      </div>
    </div>
  )
}
