import { useState } from 'react'
import { ScrollText, Filter, Download } from 'lucide-react'

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error'
  agent: string
  message: string
}

export default function Logs() {
  const [filter, setFilter] = useState<string>('all')
  
  // Mock logs for demonstration
  const [logs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: new Date().toISOString(),
      level: 'info',
      agent: 'orchestrator',
      message: 'Run created: run_20260101_182400',
    },
    {
      id: '2',
      timestamp: new Date().toISOString(),
      level: 'info',
      agent: 'business_builder',
      message: 'Executing task: Generate 3 Business Concepts',
    },
    {
      id: '3',
      timestamp: new Date().toISOString(),
      level: 'warning',
      agent: 'stripe_agent',
      message: 'Stripe API key not configured',
    },
  ])

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.level === filter)

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 bg-red-50'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-blue-600 bg-blue-50'
    }
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(logs, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'logs.json'
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logs</h1>
          <p className="mt-2 text-gray-600">
            View system and agent execution logs
          </p>
        </div>
        <button onClick={handleExport} className="btn btn-secondary flex items-center gap-2">
          <Download size={16} />
          Export
        </button>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ScrollText size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No logs to display</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(
                      log.level
                    )}`}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <span className="font-medium">{log.agent}</span>
                      <span>•</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-900">{log.message}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
