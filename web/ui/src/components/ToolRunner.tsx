import { useEffect, useState } from 'react'

type Props = { basePath: string }
type Tool = { name: string; description?: string }

export default function ToolRunner({ basePath }: Props) {
  const [tools, setTools] = useState<Tool[]>([])
  const [echo, setEcho] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${basePath}/tools`)
      .then((r) => r.json())
      .then(setTools)
      .catch(() => setTools([]))
  }, [basePath])

  async function execute(request: Promise<Response>) {
    setLoading(true)
    setError(null)
    try {
      const response = await request
      if (!response.ok) {
        throw new Error(`Tool call failed (${response.status})`)
      }
      setResult(await response.json())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Tool call failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-lg font-medium text-slate-800">Available Tools</h3>
        <ul className="list-disc pl-5 text-slate-700">
          {tools.map((tool) => (
            <li key={tool.name}>
              <span className="font-semibold">{tool.name}</span> — {tool.description}
            </li>
          ))}
          {tools.length === 0 && <li className="text-slate-500">No tools available</li>}
        </ul>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Echo payload (JSON)</label>
          <input
            value={echo}
            onChange={(e) => setEcho(e.target.value)}
            placeholder='{"a":1}'
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={loading}
            onClick={async () => {
              const payload = (() => {
                try {
                  return JSON.parse(echo || '{}')
                } catch {
                  return {}
                }
              })()
              await execute(fetch(`${basePath}/tools/echo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              }))
            }}
          >
            {loading ? 'Running…' : 'Run echo'}
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Summarize text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={loading}
            onClick={async () => {
              await execute(fetch(`${basePath}/tools/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
              }))
            }}
          >
            {loading ? 'Running…' : 'Run summarize'}
          </button>
        </div>

        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {result && <pre className="overflow-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100">{JSON.stringify(result, null, 2)}</pre>}
      </div>
    </div>
  )
}
