/**
 * AnalyticsChart
 * --------------
 * Inline SVG chart (no Recharts dependency — drop in Recharts later if
 * richer interactions are needed). Supports bar and line types.
 *
 * Props shape matches the Python analytics_chart() helper:
 *   { title, type: "bar" | "line", data: [{name, value}, ...], alertText? }
 */

import { AlertTriangle, BarChart3 } from 'lucide-react'

interface ChartPoint {
  name: string
  value: number
}

interface AnalyticsChartProps {
  title: string
  type?: 'bar' | 'line'
  data: ChartPoint[]
  alertText?: string
}

const WIDTH = 480
const HEIGHT = 200
const PADDING = { top: 16, right: 16, bottom: 32, left: 40 }

export default function AnalyticsChart({
  title,
  type = 'bar',
  data,
  alertText,
}: AnalyticsChartProps) {
  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom
  const maxValue = Math.max(...data.map((d) => d.value), 1)

  const yTicks = 4
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxValue * i) / yTicks),
  )

  // Bar layout
  const barGap = 12
  const barWidth =
    data.length > 0 ? (innerWidth - barGap * (data.length - 1)) / data.length : 0
  const bars = data.map((d, i) => {
    const h = (d.value / maxValue) * innerHeight
    return {
      ...d,
      x: PADDING.left + i * (barWidth + barGap),
      y: PADDING.top + innerHeight - h,
      width: barWidth,
      height: h,
    }
  })

  // Line layout
  const linePoints = data
    .map((d, i) => {
      const x =
        PADDING.left + (data.length > 1 ? (i / (data.length - 1)) * innerWidth : innerWidth / 2)
      const y = PADDING.top + innerHeight - (d.value / maxValue) * innerHeight
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-emerald-400" />
          <h3 className="font-semibold text-gray-100">{title}</h3>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={title}
      >
        {/* Y-axis grid lines + labels */}
        {tickValues.map((t, i) => {
          const y = PADDING.top + innerHeight - (t / maxValue) * innerHeight
          return (
            <g key={`tick-${i}`}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y}
                y2={y}
                stroke="#1f2937"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-500"
                style={{ fontSize: 10 }}
              >
                {t}
              </text>
            </g>
          )
        })}

        {/* Data */}
        {type === 'bar' &&
          bars.map((b, i) => (
            <g key={`bar-${i}`}>
              <rect
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                fill="#10b981"
                rx={3}
              />
              <text
                x={b.x + b.width / 2}
                y={b.y - 4}
                textAnchor="middle"
                className="fill-gray-300"
                style={{ fontSize: 10 }}
              >
                {b.value}
              </text>
              <text
                x={b.x + b.width / 2}
                y={HEIGHT - PADDING.bottom + 16}
                textAnchor="middle"
                className="fill-gray-400"
                style={{ fontSize: 10 }}
              >
                {b.name}
              </text>
            </g>
          ))}

        {type === 'line' && (
          <>
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              points={linePoints}
            />
            {data.map((d, i) => {
              const x =
                PADDING.left +
                (data.length > 1
                  ? (i / (data.length - 1)) * innerWidth
                  : innerWidth / 2)
              const y =
                PADDING.top + innerHeight - (d.value / maxValue) * innerHeight
              return (
                <g key={`pt-${i}`}>
                  <circle cx={x} cy={y} r={3} fill="#10b981" />
                  <text
                    x={x}
                    y={HEIGHT - PADDING.bottom + 16}
                    textAnchor="middle"
                    className="fill-gray-400"
                    style={{ fontSize: 10 }}
                  >
                    {d.name}
                  </text>
                </g>
              )
            })}
          </>
        )}
      </svg>

      {alertText && (
        <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-amber-950/40 border border-amber-900/50 rounded-lg text-sm text-amber-200">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{alertText}</span>
        </div>
      )}
    </div>
  )
}
