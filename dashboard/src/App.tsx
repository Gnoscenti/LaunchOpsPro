import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Rocket,
  LayoutDashboard,
  Activity,
  Server,
  FileText,
  Shield,
  BookOpen,
  ScrollText,
  History,
} from 'lucide-react'

import Dashboard from './pages/Dashboard'
import PipelineView from './pages/PipelineView'
import Services from './pages/Services'
import Artifacts from './pages/Artifacts'
import Agents from './pages/Agents'
import Logs from './pages/Logs'
import Prompts from './pages/Prompts'
import Permissions from './pages/Permissions'
import Runs from './pages/Runs'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchInterval: 5000 } },
})

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pipeline', icon: Rocket, label: 'Pipeline' },
  { to: '/services', icon: Server, label: 'Services' },
  { to: '/artifacts', icon: FileText, label: 'Artifacts' },
  { to: '/agents', icon: Activity, label: 'Agents' },
  { to: '/prompts', icon: BookOpen, label: 'Prompts' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
  { to: '/runs', icon: History, label: 'Runs' },
  { to: '/permissions', icon: Shield, label: 'Permissions' },
]

function NavLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-600 text-white'
          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <Icon size={16} />
      {label}
    </Link>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-950 text-gray-100 flex">
          {/* Sidebar */}
          <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
              <h1 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <Rocket size={20} />
                LaunchOps
              </h1>
              <p className="text-xs text-gray-500 mt-1">Founder Edition v3.0</p>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} {...item} />
              ))}
            </nav>
            <div className="p-3 border-t border-gray-800">
              <div className="text-xs text-gray-600 text-center">
                Tier 3 — No Guardrails
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pipeline" element={<PipelineView />} />
                <Route path="/services" element={<Services />} />
                <Route path="/artifacts" element={<Artifacts />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/prompts" element={<Prompts />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/runs" element={<Runs />} />
                <Route path="/permissions" element={<Permissions />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App
