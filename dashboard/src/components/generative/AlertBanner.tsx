/**
 * AlertBanner
 * -----------
 * Dismissable alert with severity, message, and optional CTA button.
 * Props shape matches core/generative_ui.py::alert_banner().
 */

import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react'

type Severity = 'info' | 'warning' | 'error' | 'success'

interface AlertBannerProps {
  severity: Severity
  title: string
  message: string
  actionLabel?: string
  actionUrl?: string
  dismissable?: boolean
}

const SEVERITY_STYLES: Record<
  Severity,
  { bg: string; border: string; text: string; icon: JSX.Element }
> = {
  info: {
    bg: 'bg-blue-950/40',
    border: 'border-blue-900/60',
    text: 'text-blue-200',
    icon: <Info size={18} />,
  },
  warning: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-900/60',
    text: 'text-amber-200',
    icon: <AlertTriangle size={18} />,
  },
  error: {
    bg: 'bg-red-950/40',
    border: 'border-red-900/60',
    text: 'text-red-200',
    icon: <AlertCircle size={18} />,
  },
  success: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-900/60',
    text: 'text-emerald-200',
    icon: <CheckCircle2 size={18} />,
  },
}

export default function AlertBanner({
  severity,
  title,
  message,
  actionLabel,
  actionUrl,
  dismissable = true,
}: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info

  if (dismissed) return null

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 px-4 py-3 border rounded-xl ${style.bg} ${style.border} ${style.text}`}
    >
      <div className="shrink-0 mt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-sm opacity-90 mt-0.5">{message}</div>
        {actionLabel && actionUrl && (
          <a
            href={actionUrl}
            className="inline-block mt-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-md text-xs font-medium transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            {actionLabel}
          </a>
        )}
      </div>
      {dismissable && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
