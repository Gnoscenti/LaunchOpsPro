import { useQuery } from '@tanstack/react-query'
import { FileText, Download, File } from 'lucide-react'
import { getArtifacts, downloadArtifact } from '../lib/api'

const TYPE_COLORS: Record<string, string> = {
  document: 'bg-blue-900 text-blue-300',
  config: 'bg-purple-900 text-purple-300',
  report: 'bg-emerald-900 text-emerald-300',
  file: 'bg-gray-800 text-gray-400',
}

export default function Artifacts() {
  const { data, isLoading } = useQuery({ queryKey: ['artifacts'], queryFn: () => getArtifacts() })

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText size={24} className="text-emerald-400" />
          Artifacts
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {data?.total || 0} generated documents and files
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">File</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Stage</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Type</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Size</th>
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Created</th>
              <th className="text-right text-xs text-gray-500 font-medium px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data?.artifacts || []).map((art: any) => (
              <tr key={art.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <File size={14} className="text-gray-500" />
                    <span className="text-sm text-gray-200">{art.filename}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-400 capitalize">{art.stage}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[art.type] || TYPE_COLORS.file}`}>
                    {art.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{formatSize(art.size_bytes)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(art.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={downloadArtifact(art.id)}
                    className="text-emerald-400 hover:text-emerald-300"
                    target="_blank"
                    rel="noopener"
                  >
                    <Download size={14} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="text-center text-gray-500 py-8">Loading artifacts...</div>}
        {!isLoading && (data?.total || 0) === 0 && (
          <div className="text-center text-gray-600 py-8">No artifacts generated yet. Run the pipeline to create documents.</div>
        )}
      </div>
    </div>
  )
}
