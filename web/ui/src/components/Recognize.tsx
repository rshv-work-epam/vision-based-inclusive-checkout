import { useState } from 'react'

export default function Recognize() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)
  const [creating, setCreating] = useState(false)

  async function submit() {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch('/api/inference/predict', { method: 'POST', body: fd })
    const data = await r.json()
    setResult(data)
  }

  async function createTask() {
    if (!result?.predictions?.[0]) return
    setCreating(true)
    const p = result.predictions[0]
    const r = await fetch('/api/review-tasks/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: p.label, confidence: p.confidence, image_name: file?.name })
    })
    setCreating(false)
    if (r.ok) alert('Task created')
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <h3 className="text-lg font-medium text-slate-800">Upload Product Image</h3>
        <input type="file" accept="image/*" onChange={e=> setFile(e.target.files?.[0]||null)} />
        <button disabled={!file} onClick={submit} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">Recognize</button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-medium text-slate-800">Prediction</h3>
        {result ? (
          <div className="space-y-2">
            <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            <button onClick={createTask} disabled={!result?.predictions?.length || creating} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">Create Review Task</button>
          </div>
        ) : (
          <p className="text-slate-500">No prediction yet.</p>
        )}
      </div>
    </div>
  )
}
