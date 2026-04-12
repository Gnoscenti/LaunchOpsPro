/**
 * DailyCommandCenter
 * ------------------
 * Dynexis Founder OS — pomodoro-driven "What Matters Now" sprint board.
 * Renders the Top 3 priorities with 25-minute focus timers, driven by
 * the Python TemporalManager (core/temporal.py).
 *
 * Props shape matches agents/founder_os.py::generate_daily_agenda():
 *   {
 *     title: string,
 *     date: string,
 *     sprints: [{
 *       task, description?, roi_score, sprint_index,
 *       duration_minutes, duration_seconds, scheduled_start, status
 *     }],
 *     focus_minutes: number,
 *     break_minutes: number,
 *     total_committed_minutes: number,
 *     revenue_rule: string,
 *     tool_gate_status: "LOCKED" | "OPEN",
 *     current_mrr: number,
 *   }
 */

import { useEffect, useRef, useState } from 'react'
import {
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  TimerReset,
  Flame,
  Shield,
  DollarSign,
} from 'lucide-react'

interface Sprint {
  task: string
  description?: string
  roi_score: number
  sprint_index: number
  duration_minutes: number
  duration_seconds?: number
  break_minutes?: number
  scheduled_start?: string
  scheduled_end?: string
  status?: 'pending' | 'running' | 'done'
}

interface DailyCommandCenterProps {
  title: string
  date?: string
  sprints: Sprint[]
  focus_minutes?: number
  break_minutes?: number
  total_committed_minutes?: number
  revenue_rule?: string
  tool_gate_status?: 'LOCKED' | 'OPEN'
  current_mrr?: number
}

type TimerState = { sprintIndex: number; timeLeft: number } | null

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function roiTone(score: number): string {
  if (score >= 90) return 'text-red-400 bg-red-950/40 border-red-900/50'
  if (score >= 80) return 'text-amber-400 bg-amber-950/40 border-amber-900/50'
  return 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50'
}

export default function DailyCommandCenter({
  title,
  date,
  sprints,
  focus_minutes = 25,
  total_committed_minutes,
  revenue_rule,
  tool_gate_status = 'LOCKED',
  current_mrr = 0,
}: DailyCommandCenterProps) {
  const [activeTimer, setActiveTimer] = useState<TimerState>(null)
  const [completed, setCompleted] = useState<Record<number, boolean>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Countdown tick
  useEffect(() => {
    if (!activeTimer) return
    intervalRef.current = setInterval(() => {
      setActiveTimer((prev) => {
        if (!prev) return null
        if (prev.timeLeft <= 1) {
          // Sprint finished — mark done and clear timer
          setCompleted((c) => ({ ...c, [prev.sprintIndex]: true }))
          return null
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 }
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [activeTimer?.sprintIndex])

  const startPomodoro = (sprintIndex: number, durationSeconds: number) => {
    setActiveTimer({ sprintIndex, timeLeft: durationSeconds })
  }
  const stopPomodoro = () => setActiveTimer(null)
  const markDone = (sprintIndex: number) => {
    setCompleted((c) => ({ ...c, [sprintIndex]: true }))
    if (activeTimer?.sprintIndex === sprintIndex) setActiveTimer(null)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Flame size={20} className="text-amber-400" />
            {title}
          </h2>
          {date && (
            <div className="text-xs text-gray-500 mt-1 font-mono">{date}</div>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {typeof current_mrr === 'number' && current_mrr > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-950/40 border border-emerald-900/50 rounded text-emerald-300">
              <DollarSign size={10} /> MRR ${current_mrr.toLocaleString()}
            </span>
          )}
          <span
            className={`flex items-center gap-1 px-2 py-1 rounded border ${
              tool_gate_status === 'LOCKED'
                ? 'bg-red-950/40 border-red-900/50 text-red-300'
                : 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300'
            }`}
          >
            <Shield size={10} /> Tool Gate {tool_gate_status}
          </span>
        </div>
      </div>

      {/* Sprints */}
      <div className="space-y-3">
        {sprints.map((sprint, idx) => {
          const sprintIdx = sprint.sprint_index ?? idx
          const isActive = activeTimer?.sprintIndex === sprintIdx
          const isComplete = !!completed[sprintIdx]
          const durationSeconds =
            sprint.duration_seconds ?? (sprint.duration_minutes || focus_minutes) * 60

          return (
            <div
              key={sprintIdx}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                isComplete
                  ? 'bg-emerald-950/20 border-emerald-900/40'
                  : isActive
                  ? 'bg-amber-950/20 border-amber-900/60'
                  : 'bg-gray-950 border-gray-800'
              }`}
            >
              <div className="shrink-0 mt-0.5 text-xl font-bold text-gray-600 w-6 text-right">
                {sprintIdx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className={`font-semibold ${
                    isComplete ? 'text-gray-400 line-through' : 'text-gray-100'
                  }`}
                >
                  {sprint.task}
                </div>
                {sprint.description && (
                  <div className="text-sm text-gray-500 mt-0.5">
                    {sprint.description}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${roiTone(
                      sprint.roi_score,
                    )}`}
                  >
                    ROI {sprint.roi_score}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono">
                    {sprint.duration_minutes ?? focus_minutes}m focus
                  </span>
                </div>
              </div>

              {/* Timer / CTA */}
              <div className="shrink-0 flex items-center gap-2">
                {isComplete ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium text-sm">
                    <CheckCircle2 size={16} /> Done
                  </span>
                ) : isActive ? (
                  <>
                    <div className="text-amber-400 font-mono font-bold text-xl flex items-center gap-2">
                      <span className="animate-pulse">⏱</span>
                      {formatTime(activeTimer.timeLeft)}
                    </div>
                    <button
                      onClick={stopPomodoro}
                      className="p-1.5 text-gray-400 hover:text-white rounded"
                      aria-label="Pause"
                    >
                      <PauseCircle size={18} />
                    </button>
                    <button
                      onClick={() => markDone(sprintIdx)}
                      className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded"
                      aria-label="Mark done"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startPomodoro(sprintIdx, durationSeconds)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 text-xs font-medium transition-colors"
                  >
                    <PlayCircle size={14} />
                    {sprint.duration_minutes ?? focus_minutes}m
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {(total_committed_minutes || revenue_rule) && (
        <div className="mt-5 pt-4 border-t border-gray-800 space-y-2">
          {total_committed_minutes !== undefined && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <TimerReset size={12} />
              Committed: {total_committed_minutes} minutes across {sprints.length}{' '}
              sprints
            </div>
          )}
          {revenue_rule && (
            <div className="text-[11px] text-gray-600 italic leading-relaxed">
              {revenue_rule}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
