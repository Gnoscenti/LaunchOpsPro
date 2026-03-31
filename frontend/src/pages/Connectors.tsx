import { useState } from 'react'
import { Link as LinkIcon, Check, AlertCircle } from 'lucide-react'

interface Connector {
  id: string
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'error'
  required: boolean
}

export default function Connectors() {
  const [connectors] = useState<Connector[]>([
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Payment processing and subscription management',
      status: 'disconnected',
      required: true,
    },
    {
      id: 'gcloud',
      name: 'Google Cloud',
      description: 'Cloud infrastructure and deployment',
      status: 'disconnected',
      required: false,
    },
    {
      id: 'email',
      name: 'Email Provider',
      description: 'Email marketing and transactional emails',
      status: 'disconnected',
      required: true,
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Code repository and version control',
      status: 'connected',
      required: false,
    },
    {
      id: 'vercel',
      name: 'Vercel',
      description: 'Website deployment and hosting',
      status: 'disconnected',
      required: false,
    },
  ])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
            <Check size={12} />
            Connected
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle size={12} />
            Error
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
            Disconnected
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Connectors</h1>
        <p className="mt-2 text-gray-600">
          Manage external service integrations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectors.map((connector) => (
          <div key={connector.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <LinkIcon className="text-primary-600" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{connector.name}</h3>
                  {connector.required && (
                    <span className="text-xs text-red-600">Required</span>
                  )}
                </div>
              </div>
              {getStatusBadge(connector.status)}
            </div>

            <p className="text-sm text-gray-600 mb-4">{connector.description}</p>

            <button
              className={`w-full btn ${
                connector.status === 'connected' ? 'btn-secondary' : 'btn-primary'
              }`}
            >
              {connector.status === 'connected' ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <LinkIcon className="text-blue-600 flex-shrink-0 mt-1" size={20} />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Connectors</p>
            <p>
              Connectors allow the orchestrator to interact with external services. Required
              connectors must be configured before launching certain tasks. Credentials are
              stored securely in the encrypted vault.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
