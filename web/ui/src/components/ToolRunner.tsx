import { useEffect, useState } from 'react'

type Props = { basePath: string }

type Tool = { name: string; description?: string }

export default function ToolRunner({ basePath }: Props) {
  const [tools, setTools] = useState<Tool[]>([])
  const [echo, setEcho] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    fetch(`${basePath}/tools`).then(r => r.json()).then(setTools).catch(() => setTools([]))
  }, [basePath])

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-medium text-slate-800 mb-2">Available Tools</h3>
        <ul className="list-disc pl-5 text-slate-700">
          {tools.map(t => <li key={t.name}><span className="font-semibold">{t.name}</span> — {t.description}</li>)}
          {tools.length === 0 && <li className="text-slate-500">No tools available</li>}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Echo payload (JSON)</label>
          <input value={echo} onChange={e => setEcho(e.target.value)} placeholder='{"a":1}' className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700" onClick={async ()=>{
            const payload = (()=>{ try{ return JSON.parse(echo||'{}') }catch{ return {} } })()
            const r = await fetch(`${basePath}/tools/echo`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
            setResult(await r.json())
          }}>Run echo</button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Summarize text</label>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700" onClick={async ()=>{
            const r = await fetch(`${basePath}/tools/summarize`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) })
            setResult(await r.json())
          }}>Run summarize</button>
        </div>

        {result && (
          <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}
