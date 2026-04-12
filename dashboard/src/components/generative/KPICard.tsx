/**
 * KPICard
 * -------
 * Single big-number KPI with optional delta indicator and inline sparkline.
 * Props shape matches core/generative_ui.py::kpi_card().
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Tone = 'neutral' | 'positive' | 'negative' | 'warning'

interface KPICardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  sparkline?: number[]
  tone?: Tone
}

const TONE_STYLES: Record<Tone, { accent: string; border: string }> = {
  neutral: { accent: 'text-gray-300', border: 'border-gray-800' },
  positive: { accent: 'text-emerald-400', border: 'border-emerald-900/50' },
  negative: { accent: 'text-red-400', border: 'border-red-900/50' },
  warning: { accent: 'text-amber-400', border: 'border-amber-900/50' },
}

function Sparkline({ points }: { points: number[] }) {
  if (!points.length) return null
  const w = 80
  const h = 24
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1 || 1)) * w
      const y = h - ((p - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="ml-auto">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export default function KPICard({
  label,
  value,
  delta,
  deltaLabel,
  sparkline,
  tone = 'neutral',
}: KPICardProps) {
  const style = TONE_STYLES[tone] ?? TONE_STYLES.neutral
  const deltaPositive = typeof delta === 'number' && delta > 0
  const deltaNegative = typeof delta === 'number' && delta < 0
  const DeltaIcon = deltaPositive ? TrendingUp : deltaNegative ? TrendingDown : Minus

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 ${style.border}`}>
      <div className="text-xs text-gray-500 uppercase tracking-wide">
        {label}
      </div>
      <div className={`flex items-end gap-2 mt-1 ${style.accent}`}>
        <div className="text-3xl font-bold">{value}</div>
        {sparkline && sparkline.length > 0 && <Sparkline points={sparkline} />}
      </div>
      {typeof delta === 'number' && (
        <div
          className={`flex items-center gap-1 mt-2 text-xs ${
            deltaPositive
              ? 'text-emerald-400'
              : deltaNegative
              ? 'text-red-400'
              : 'text-gray-500'
          }`}
        >
          <DeltaIcon size={12} />
          <span>
            {deltaPositive ? '+' : ''}
            {delta}
            {deltaLabel ? ` ${deltaLabel}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
