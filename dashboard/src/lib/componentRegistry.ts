/**
 * Generative UI Component Registry
 * ---------------------------------
 * Maps the `component` field from a ui_component SSE payload to a React
 * component. Must stay in sync with core/generative_ui.py::UI_COMPONENTS.
 *
 * To add a new generative component:
 *   1. Add the name to UI_COMPONENTS in core/generative_ui.py
 *   2. Write the React component in ../components/generative/
 *   3. Register it in REGISTRY below
 *
 * The renderer (GenerativeUIRenderer.tsx) looks up the component by name
 * and passes the `props` object straight through.
 */

import type { ComponentType } from 'react'
import AnalyticsChart from '../components/generative/AnalyticsChart'
import AlertBanner from '../components/generative/AlertBanner'
import KPICard from '../components/generative/KPICard'
import ActionList from '../components/generative/ActionList'
import HITLApprovalCard from '../components/generative/HITLApprovalCard'
import DailyCommandCenter from '../components/generative/DailyCommandCenter'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenerativeComponent = ComponentType<any>

export const REGISTRY: Record<string, GenerativeComponent> = {
  AnalyticsChart,
  AlertBanner,
  KPICard,
  ActionList,
  HITLApprovalCard,
  DailyCommandCenter,
}

export interface UIComponentPayload {
  type: 'ui_component'
  component: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: Record<string, any>
  id: string
  source_agent?: string
  stage?: string
  timestamp?: string
}

export function lookupComponent(name: string): GenerativeComponent | null {
  return REGISTRY[name] || null
}
