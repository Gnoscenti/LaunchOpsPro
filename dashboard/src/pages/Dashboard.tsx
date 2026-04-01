import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Rocket,
  Server,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Zap,
  ExternalLink,
  Target,
  TrendingUp,
} from 'lucide-react'
import { getHealth, getStages, getServices, getArtifacts, getRuns } from '../lib/api'

/* ─── Domain → Stage mapping ─── */
const DOMAIN_MAP: Record<string, { stages: string[]; icon: string }> = {
  'Business':       { stages: ['init', 'intake'],        icon: '🏢' },
  'Legal':          { stages: ['formation', 'legal'],    icon: '⚖️' },
  'Infrastructure': { stages: ['infrastructure'],        icon: '🔧' },
  'Monetization':   { stages: ['payments'],              icon: '💰' },
  'Funding':        { stages: ['funding'],               icon: '📈' },
  'GTM':            { stages: ['growth'],                icon: '🚀' },
}

/* ─── Milestone definitions ─── */
const MILESTONES = [
  { label: 'Stack Deployed',    stage: 'infrastructure', pct: 30 },
  { label: 'Entity Formed',     stage: 'formation',      pct: 50 },
  { label: 'Payments Live',     stage: 'payments',       pct: 70 },
  { label: 'First Revenue',     stage: 'growth',         pct: 90 },
  { label: 'Launch Complete',   stage: 'done',           pct: 100 },
]

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-emerald-900 text-emerald-300',
    current: 'bg-amber-900 text-amber-300',
    pending: 'bg-gray-800 text-gray-400',
    running: 'bg-blue-900 text-blue-300',
    error: 'bg-red-900 text-red-300',
    up: 'bg-emerald-900 text-emerald-300',
    down: 'bg-red-900 text-red-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-800 text-gray-400'}`}>
      {status}
    </span>
  )
}

function Card({ title, icon: Icon, action, children, className = '' }: any) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-emerald-400" />
          <h3 className="font-semibold text-gray-200">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth })
  const stages = useQuery({ queryKey: ['stages'], queryFn: getStages })
  const services = useQuery({ queryKey: ['services'], queryFn: getServices })
  const artifacts = useQuery({ queryKey: ['artifacts'], queryFn: () => getArtifacts() })
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => getRuns(5) })

  const stageData = stages.data?.stages || []
  const completedStages = stageData.filter((s: any) => s.status === 'completed').length
  const totalStages = stageData.length || 10
  const progressPct = Math.round((completedStages / totalStages) * 100)

  // Determine next recommended action
  const currentStage = stageData.find((s: any) => s.status === 'current')
  const nextAction = currentStage
    ? `Run the "${currentStage.name}" stage — agents: ${currentStage.agents?.join(', ') || 'none assigned'}`
    : completedStages === totalStages
    ? 'All stages complete. Review artifacts and prepare for launch.'
    : 'Start the pipeline from the Pipeline tab.'

  const nextLink = currentStage ? '/pipeline' : completedStages === totalStages ? '/artifacts' : '/pipeline'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-gray-500 text-sm mt-1">LaunchOps Founder Edition — Tier 3</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${health.data?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-sm text-gray-400">
            {health.data?.agents_loaded || 0} agents / {health.data?.handlers_registered || 0} handlers
          </span>
        </div>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500">Pipeline Progress</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{progressPct}%</div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="text-xs text-gray-600 mt-1">{completedStages}/{totalStages} stages</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500">Services</div>
          <div className="text-2xl font-bold text-white mt-1">
            {services.data?.up || 0}<span className="text-gray-600">/{services.data?.total || 5}</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {services.data?.up === services.data?.total ? 'All services healthy' : `${services.data?.down || 0} down`}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500">Artifacts</div>
          <div className="text-2xl font-bold text-white mt-1">{artifacts.data?.total || 0}</div>
          <div className="text-xs text-gray-600 mt-1">Generated documents</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500">Runs</div>
          <div className="text-2xl font-bold text-white mt-1">{runs.data?.total || 0}</div>
          <div className="text-xs text-gray-600 mt-1">Pipeline executions</div>
        </div>
      </div>

      {/* What Should I Do Next — enhanced */}
      <Link to={nextLink}>
        <div className="bg-gradient-to-r from-emerald-900/40 to-gray-900 border border-emerald-800/50 rounded-xl p-5 hover:border-emerald-600 transition-colors cursor-pointer group">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={18} className="text-emerald-400" />
                <h3 className="font-semibold text-emerald-300">What Should I Do Next?</h3>
              </div>
              <p className="text-gray-300">{nextAction}</p>
            </div>
            <ArrowRight size={20} className="text-emerald-600 group-hover:text-emerald-400 transition-colors" />
          </div>
        </div>
      </Link>

      {/* Milestone Timeline */}
      <Card title="Launch Milestones" icon={Target}>
        <div className="relative">
          {/* Timeline bar */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-800" />
          <div className="space-y-4">
            {MILESTONES.map((ms) => {
              const reached = stageData.find(
                (s: any) => s.name === ms.stage && s.status === 'completed'
              )
              return (
                <div key={ms.label} className="flex items-center gap-4 relative">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                    reached ? 'bg-emerald-600' : 'bg-gray-800 border border-gray-700'
                  }`}>
                    {reached ? (
                      <CheckCircle2 size={14} className="text-white" />
                    ) : (
                      <Clock size={10} className="text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className={`text-sm ${reached ? 'text-emerald-300' : 'text-gray-500'}`}>
                      {ms.label}
                    </span>
                    <span className="text-xs text-gray-600">{ms.pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        {/* Pipeline Stages */}
        <Card
          title="Pipeline Stages"
          icon={Rocket}
          action={
            <Link to="/pipeline" className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
              View all <ExternalLink size={10} />
            </Link>
          }
        >
          <div className="space-y-2">
            {stageData.map((stage: any) => (
              <div key={stage.name} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-2">
                  {stage.status === 'completed' ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : stage.status === 'current' ? (
                    <ArrowRight size={14} className="text-amber-400" />
                  ) : (
                    <Clock size={14} className="text-gray-600" />
                  )}
                  <span className={`text-sm ${stage.status === 'completed' ? 'text-gray-400' : stage.status === 'current' ? 'text-white' : 'text-gray-600'}`}>
                    {stage.name}
                  </span>
                </div>
                <StatusBadge status={stage.status} />
              </div>
            ))}
          </div>
        </Card>

        {/* Infrastructure Services — clickable endpoint cards */}
        <Card
          title="Infrastructure Services"
          icon={Server}
          action={
            <Link to="/services" className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
              View all <ExternalLink size={10} />
            </Link>
          }
        >
          <div className="space-y-2">
            {(services.data?.services || []).map((svc: any) => (
              <a
                key={svc.name}
                href={svc.url}
                target="_blank"
                rel="noopener"
                className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0 hover:bg-gray-800/30 rounded px-1 -mx-1 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {svc.status === 'up' ? (
                    <CheckCircle2 size={14} className="text-emerald-400" />
                  ) : (
                    <XCircle size={14} className="text-red-400" />
                  )}
                  <span className="text-sm text-gray-300">{svc.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {svc.response_time_ms !== undefined && (
                    <span className="text-xs text-gray-600">{svc.response_time_ms}ms</span>
                  )}
                  <StatusBadge status={svc.status} />
                  <ExternalLink size={10} className="text-gray-600" />
                </div>
              </a>
            ))}
            {(!services.data?.services || services.data.services.length === 0) && (
              <p className="text-sm text-gray-600">No services configured — deploy the LaunchOps stack first</p>
            )}
          </div>
        </Card>

        {/* Progress by Launch Domain */}
        <Card title="Progress by Launch Domain" icon={TrendingUp}>
          <div className="space-y-3">
            {Object.entries(DOMAIN_MAP).map(([domain, { stages: domainStages, icon }]) => {
              const completed = domainStages.filter((s) =>
                stageData.find((st: any) => st.name === s && st.status === 'completed')
              ).length
              const total = domainStages.length
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0
              return (
                <div key={domain}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{icon} {domain}</span>
                    <span className={`${pct === 100 ? 'text-emerald-400' : 'text-gray-500'}`}>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-400' : 'bg-emerald-600'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Recent Artifacts — clickable */}
        <Card
          title="Recent Artifacts"
          icon={FileText}
          action={
            <Link to="/artifacts" className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
              View all <ExternalLink size={10} />
            </Link>
          }
        >
          <div className="space-y-2">
            {(artifacts.data?.artifacts || []).slice(0, 5).map((art: any) => (
              <div key={art.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-gray-500" />
                  <span className="text-sm text-gray-300">{art.filename}</span>
                </div>
                <span className="text-xs text-gray-600 capitalize">{art.stage}</span>
              </div>
            ))}
            {(!artifacts.data?.artifacts || artifacts.data.artifacts.length === 0) && (
              <p className="text-sm text-gray-600">No artifacts yet — run the pipeline to generate documents</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
