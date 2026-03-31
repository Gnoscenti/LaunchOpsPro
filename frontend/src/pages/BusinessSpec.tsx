import { useState } from 'react'
import { FileText, Save, Download } from 'lucide-react'

export default function BusinessSpec() {
  const [spec, setSpec] = useState({
    skills: '',
    timeAvailable: '10',
    budget: '1000',
    riskTolerance: 'medium',
    businessModel: 'subscription',
    topics: '',
    targetIncome: '10000',
    timeline: '6',
  })

  const handleSave = () => {
    localStorage.setItem('businessSpec', JSON.stringify(spec))
    alert('Business spec saved!')
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(spec, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'business-spec.json'
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Business Spec</h1>
          <p className="mt-2 text-gray-600">
            Define your constraints and goals for the business builder
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="btn btn-secondary flex items-center gap-2">
            <Save size={16} />
            Save
          </button>
          <button onClick={handleExport} className="btn btn-primary flex items-center gap-2">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skills (comma-separated)
            </label>
            <input
              type="text"
              value={spec.skills}
              onChange={(e) => setSpec({ ...spec, skills: e.target.value })}
              placeholder="e.g., Python, Marketing, Design"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Available (hours/week)
            </label>
            <input
              type="number"
              value={spec.timeAvailable}
              onChange={(e) => setSpec({ ...spec, timeAvailable: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget (USD)
            </label>
            <input
              type="number"
              value={spec.budget}
              onChange={(e) => setSpec({ ...spec, budget: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Risk Tolerance
            </label>
            <select
              value={spec.riskTolerance}
              onChange={(e) => setSpec({ ...spec, riskTolerance: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Business Model
            </label>
            <select
              value={spec.businessModel}
              onChange={(e) => setSpec({ ...spec, businessModel: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="subscription">Subscription</option>
              <option value="one_time">One-time</option>
              <option value="hybrid">Hybrid</option>
              <option value="freemium">Freemium</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Monthly Income (USD)
            </label>
            <input
              type="number"
              value={spec.targetIncome}
              onChange={(e) => setSpec({ ...spec, targetIncome: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timeline (months)
            </label>
            <input
              type="number"
              value={spec.timeline}
              onChange={(e) => setSpec({ ...spec, timeline: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Topics of Interest (comma-separated)
            </label>
            <textarea
              value={spec.topics}
              onChange={(e) => setSpec({ ...spec, topics: e.target.value })}
              placeholder="e.g., SaaS, AI, productivity tools"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FileText className="text-blue-600 flex-shrink-0 mt-1" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">About Business Spec</p>
              <p>
                This form captures your constraints and goals. The orchestrator will use this
                information to generate tailored business concepts and execution plans.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
