/**
 * ActionList
 * ----------
 * Checklist of recommended actions with priority badges.
 * Props shape matches core/generative_ui.py::action_list().
 */

import { useState } from 'react'
import { CheckSquare, Square, Flag } from 'lucide-react'

type Priority = 'low' | 'medium' | 'high'

interface ActionItem {
  label: string
  description?: string
  completed?: boolean
  priority?: Priority
}

interface ActionListProps {
  title: string
  items: ActionItem[]
}

const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'text-gray-400 bg-gray-800',
  medium: 'text-amber-400 bg-amber-950/40',
  high: 'text-red-400 bg-red-950/40',
}

export default function ActionList({ title, items }: ActionListProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>(() =>
    items.reduce(
      (acc, item, i) => ({ ...acc, [i]: !!item.completed }),
      {} as Record<number, boolean>,
    ),
  )

  const toggle = (i: number) =>
    setChecked((prev) => ({ ...prev, [i]: !prev[i] }))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
        <CheckSquare size={18} className="text-emerald-400" />
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item, i) => {
          const isChecked = !!checked[i]
          return (
            <li
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-800/50 transition-colors"
            >
              <button
                onClick={() => toggle(i)}
                className="mt-0.5 text-gray-400 hover:text-emerald-400 transition-colors"
                aria-label={isChecked ? 'Mark incomplete' : 'Mark complete'}
              >
                {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium ${
                    isChecked ? 'line-through text-gray-500' : 'text-gray-100'
                  }`}
                >
                  {item.label}
                </div>
                {item.description && (
                  <div className="text-sm text-gray-500 mt-0.5">
                    {item.description}
                  </div>
                )}
              </div>
              {item.priority && (
                <span
                  className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.low
                  }`}
                >
                  <Flag size={10} />
                  {item.priority}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
