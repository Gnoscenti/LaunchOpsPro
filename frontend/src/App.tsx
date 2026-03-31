import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { 
  BookOpen, 
  FileText, 
  Play, 
  Shield, 
  Link as LinkIcon, 
  ScrollText 
} from 'lucide-react'

import PromptLibrary from './pages/PromptLibrary'
import BusinessSpec from './pages/BusinessSpec'
import LaunchRun from './pages/LaunchRun'
import Permissions from './pages/Permissions'
import Connectors from './pages/Connectors'
import Logs from './pages/Logs'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          {/* Navigation */}
          <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <div className="flex-shrink-0 flex items-center">
                    <h1 className="text-xl font-bold text-primary-600">
                      Founder Autopilot
                    </h1>
                  </div>
                  <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                    <NavLink to="/" icon={<BookOpen size={18} />}>
                      Prompt Library
                    </NavLink>
                    <NavLink to="/spec" icon={<FileText size={18} />}>
                      Business Spec
                    </NavLink>
                    <NavLink to="/launch" icon={<Play size={18} />}>
                      Launch Run
                    </NavLink>
                    <NavLink to="/permissions" icon={<Shield size={18} />}>
                      Permissions
                    </NavLink>
                    <NavLink to="/connectors" icon={<LinkIcon size={18} />}>
                      Connectors
                    </NavLink>
                    <NavLink to="/logs" icon={<ScrollText size={18} />}>
                      Logs
                    </NavLink>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Main content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<PromptLibrary />} />
              <Route path="/spec" element={<BusinessSpec />} />
              <Route path="/launch" element={<LaunchRun />} />
              <Route path="/permissions" element={<Permissions />} />
              <Route path="/connectors" element={<Connectors />} />
              <Route path="/logs" element={<Logs />} />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

function NavLink({ 
  to, 
  icon, 
  children 
}: { 
  to: string
  icon: React.ReactNode
  children: React.ReactNode 
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
    >
      {icon}
      {children}
    </Link>
  )
}

export default App
