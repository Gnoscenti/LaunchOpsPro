/**
 * Onboarding — 1-Click Vertical Deployment
 * ------------------------------------------
 * Three-phase onboarding flow:
 *
 *   Phase 1: Card Select — "What type of business are you building?"
 *   Phase 2: Dynamic Questionnaire — entity, jurisdiction, tiers, trial
 *   Phase 3: Mission Control — live SSE stream of the deployment
 *
 * Fetches vertical metadata from GET /api/v1/verticals so the cards,
 * questions, and default tiers are server-driven.
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Rocket,
  Cloud,
  ShoppingCart,
  Briefcase,
  Store,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { API_BASE } from '../lib/api'
import MissionControl from '../components/generative/MissionControl'

// Icon lookup for vertical cards
const ICONS: Record<string, typeof Cloud> = {
  cloud: Cloud,
  'shopping-cart': ShoppingCart,
  briefcase: Briefcase,
  store: Store,
}

interface VerticalCard {
  id: string
  name: string
  tagline: string
  icon: string
  agents: number
  highlights: string[]
  questions: Array<{
    key: string
    label: string
    type: 'select' | 'number' | 'toggle' | 'text'
    options?: string[]
    default?: unknown
    min?: number
    max?: number
    help?: string
  }>
  default_tiers: Array<{
    name: string
    price_monthly: number
    features: string[]
  }>
}

type Phase = 'select' | 'configure' | 'deploy'

export default function Onboarding() {
  const [phase, setPhase] = useState<Phase>('select')
  const [selectedVertical, setSelectedVertical] = useState<VerticalCard | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [businessName, setBusinessName] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deploymentId, setDeploymentId] = useState<string | null>(null)

  const verticals = useQuery({
    queryKey: ['verticals'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/verticals`)
      return res.json()
    },
  })

  const cards: VerticalCard[] = verticals.data?.verticals || []

  // Pre-fill answers from defaults when a vertical is selected
  useEffect(() => {
    if (selectedVertical) {
      const defaults: Record<string, unknown> = {}
      for (const q of selectedVertical.questions) {
        if (q.default !== undefined) defaults[q.key] = q.default
      }
      setAnswers(defaults)
    }
  }, [selectedVertical?.id])

  const handleSelectVertical = (card: VerticalCard) => {
    setSelectedVertical(card)
    setPhase('configure')
  }

  const handleDeploy = async () => {
    if (!selectedVertical || !businessName.trim()) return
    setDeploying(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vertical: selectedVertical.id,
          business_name: businessName.trim(),
          ...answers,
          tiers: selectedVertical.default_tiers.length > 0
            ? selectedVertical.default_tiers
            : undefined,
        }),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      setDeploymentId(data.deployment_id)
      setPhase('deploy')
    } catch (err) {
      console.error('Onboard failed:', err)
      setDeploying(false)
    }
  }

  // ── Phase 1: Card Select ──────────────────────────────────────────────

  if (phase === 'select') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
            <Rocket size={28} className="text-emerald-400" />
            What are you building?
          </h1>
          <p className="text-gray-400 mt-2">
            Select your business type. ATLAS will configure the right agents,
            infrastructure, and governance for your launch.
          </p>
        </div>

        {verticals.isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 size={32} className="animate-spin text-gray-500" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {cards.map((card) => {
            const Icon = ICONS[card.icon] || Cloud
            return (
              <button
                key={card.id}
                onClick={() => handleSelectVertical(card)}
                className="text-left bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-emerald-700 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-950/40 rounded-lg group-hover:bg-emerald-900/40 transition-colors">
                    <Icon size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">{card.name}</h3>
                    <p className="text-xs text-gray-500">
                      {card.agents} agents
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className="ml-auto text-gray-700 group-hover:text-emerald-400 transition-colors"
                  />
                </div>
                <p className="text-sm text-gray-400 mb-3">{card.tagline}</p>
                <div className="flex flex-wrap gap-1.5">
                  {card.highlights.map((h, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Phase 2: Configure ────────────────────────────────────────────────

  if (phase === 'configure' && selectedVertical) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button
          onClick={() => setPhase('select')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-6"
        >
          <ChevronLeft size={14} /> Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-950/40 rounded-lg">
            {(() => {
              const Icon = ICONS[selectedVertical.icon] || Cloud
              return <Icon size={20} className="text-emerald-400" />
            })()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Configure {selectedVertical.name} Launch
            </h2>
            <p className="text-sm text-gray-500">{selectedVertical.tagline}</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Business name — always required */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Business name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g., Dynexis Systems"
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Dynamic questions from the vertical */}
          {selectedVertical.questions.map((q) => (
            <div key={q.key}>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {q.label}
              </label>
              {q.help && (
                <p className="text-xs text-gray-600 mb-1">{q.help}</p>
              )}
              {q.type === 'select' && q.options && (
                <select
                  value={String(answers[q.key] ?? q.default ?? '')}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-emerald-600 focus:outline-none"
                >
                  {q.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
              {q.type === 'number' && (
                <input
                  type="number"
                  min={q.min}
                  max={q.max}
                  value={Number(answers[q.key] ?? q.default ?? 0)}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.key]: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-emerald-600 focus:outline-none"
                />
              )}
              {q.type === 'toggle' && (
                <button
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.key]: !prev[q.key],
                    }))
                  }
                  className={`w-12 h-6 rounded-full transition-colors ${
                    answers[q.key]
                      ? 'bg-emerald-600'
                      : 'bg-gray-700'
                  } relative`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      answers[q.key] ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              )}
            </div>
          ))}

          {/* Default tiers preview (SaaS) */}
          {selectedVertical.default_tiers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pricing tiers (auto-configured in Stripe)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {selectedVertical.default_tiers.map((tier) => (
                  <div
                    key={tier.name}
                    className="bg-gray-950 border border-gray-800 rounded-lg p-3"
                  >
                    <div className="font-semibold text-gray-200 text-sm">
                      {tier.name}
                    </div>
                    <div className="text-emerald-400 font-bold mt-1">
                      ${tier.price_monthly}/mo
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">
                      {tier.features.length} features
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deploy button */}
          <button
            onClick={handleDeploy}
            disabled={!businessName.trim() || deploying}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 font-bold text-sm transition-colors mt-4"
          >
            {deploying ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Command Launch
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── Phase 3: Mission Control ──────────────────────────────────────────

  if (phase === 'deploy' && deploymentId) {
    return (
      <MissionControl
        deploymentId={deploymentId}
        vertical={selectedVertical?.name || 'SaaS'}
        businessName={businessName}
        onBack={() => {
          setPhase('select')
          setDeploymentId(null)
          setDeploying(false)
        }}
      />
    )
  }

  return null
}
