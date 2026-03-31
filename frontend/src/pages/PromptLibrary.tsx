import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search, BookOpen, Copy, Check } from 'lucide-react'
import { getPrompts, getPrompt } from '../lib/api'

export default function PromptLibrary() {
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { data: promptsData, isLoading } = useQuery({
    queryKey: ['prompts'],
    queryFn: getPrompts,
  })

  const { data: selectedPrompt } = useQuery({
    queryKey: ['prompt', selectedPromptId],
    queryFn: () => getPrompt(selectedPromptId!),
    enabled: !!selectedPromptId,
  })

  const filteredPrompts = promptsData?.prompts.filter((id) =>
    id.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Prompt Library</h1>
        <p className="mt-2 text-gray-600">
          Browse and use the 30 business-building prompts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prompt List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="card max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading prompts...</div>
            ) : (
              <div className="space-y-2">
                {filteredPrompts.map((promptId) => (
                  <button
                    key={promptId}
                    onClick={() => setSelectedPromptId(promptId)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      selectedPromptId === promptId
                        ? 'bg-primary-50 text-primary-700 border-2 border-primary-200'
                        : 'hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <BookOpen size={16} className="mt-1 flex-shrink-0" />
                      <span className="text-sm font-medium">{promptId}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Prompt Detail */}
        <div className="lg:col-span-2">
          {selectedPrompt ? (
            <div className="card space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedPrompt.id}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Category: {selectedPrompt.id.split('_')[1] || 'General'}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(selectedPrompt.prompt, selectedPrompt.id)}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  {copiedId === selectedPrompt.id ? (
                    <>
                      <Check size={16} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <div className="prose max-w-none">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                    {selectedPrompt.prompt}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="text-center py-12 text-gray-500">
                <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
                <p>Select a prompt to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
