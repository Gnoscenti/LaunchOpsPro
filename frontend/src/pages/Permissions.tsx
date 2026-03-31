import { useQuery } from '@tanstack/react-query'
import { Shield, Check, X } from 'lucide-react'
import { getPermissions } from '../lib/api'

export default function Permissions() {
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: getPermissions,
  })

  const allTools = [
    'filesystem',
    'shell',
    'git',
    'stripe',
    'gcloud',
    'playwright',
    'email',
    'social',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Permissions</h1>
        <p className="mt-2 text-gray-600">
          Tool access control for each agent
        </p>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading permissions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Agent</th>
                  {allTools.map((tool) => (
                    <th key={tool} className="text-center py-3 px-4 font-semibold text-gray-900">
                      {tool}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions && Object.entries(permissions).map(([agent, tools]) => (
                  <tr key={agent} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{agent}</td>
                    {allTools.map((tool) => (
                      <td key={tool} className="text-center py-3 px-4">
                        {(tools as string[]).includes(tool) ? (
                          <Check className="inline text-green-500" size={20} />
                        ) : (
                          <X className="inline text-gray-300" size={20} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Security Note</p>
            <p>
              Permissions control which tools each agent can access. Dangerous operations
              (like git push, Stripe operations, email campaigns) require human approval
              before execution.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
