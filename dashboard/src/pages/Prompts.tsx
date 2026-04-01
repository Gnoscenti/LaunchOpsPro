import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, FileText } from 'lucide-react'
import { getPrompts, getPrompt } from '../lib/api'

export default function Prompts() {
  const { data } = useQuery({ queryKey: ['prompts'], queryFn: getPrompts })
  const [selected, setSelected] = useState<string | null>(null)
  const promptDetail = useQuery({
    queryKey: ['prompt', selected],
    queryFn: () => getPrompt(selected!),
    enabled: !!selected,
  })

  const prompts = data?.prompts || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen size={24} className="text-emerald-400" />
          Prompt Library
        </h1>
        <p className="text-gray-500 text-sm mt-1">{data?.count || 0} templates</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 space-y-2">
          {Object.entries(prompts).map(([id]: [string, any]) => (
            <button
              key={id}
              onClick={() => setSelected(id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
                selected === id
                  ? 'bg-emerald-900/50 border border-emerald-700 text-emerald-300'
                  : 'bg-gray-900 border border-gray-800 text-gray-300 hover:bg-gray-800'
              }`}
            >
              <FileText size={14} />
              {id.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="col-span-2">
          {selected && promptDetail.data ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-3 capitalize">
                {selected.replace(/_/g, ' ')}
              </h3>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-950 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                {promptDetail.data.content}
              </pre>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-600">
              Select a prompt template to view its content
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
