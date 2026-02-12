import { useState } from 'react'

export default function Recognize() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [imgDims, setImgDims] = useState<{w:number;h:number}|null>(null)
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
        <input type="file" accept="image/*" onChange={e=> {
          const f = e.target.files?.[0]||null
          setFile(f)
          setResult(null)
          if (f) setPreview(URL.createObjectURL(f))
          else setPreview(null)
        }} />
        <button disabled={!file} onClick={submit} className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">Recognize</button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-medium text-slate-800">Prediction</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            {preview ? (
              <div className="relative inline-block">
                <img src={preview} alt="preview" className="max-w-full h-auto rounded-lg border" onLoad={(e)=>{
                  const el = e.currentTarget
                  setImgDims({ w: el.naturalWidth, h: el.naturalHeight })
                }} />
                {result?.predictions?.[0]?.box && (
                  (()=>{
                    const box = result.predictions[0].box
                    const imgEl = document.querySelector('img[alt="preview"]') as HTMLImageElement | null
                    const dw = imgEl?.clientWidth || 1
                    const dh = imgEl?.clientHeight || 1
                    const sw = imgDims?.w || dw
                    const sh = imgDims?.h || dh
                    const sx = dw / sw
                    const sy = dh / sh
                    const style: React.CSSProperties = {
                      position: 'absolute',
                      left: `${box.x * sx}px`,
                      top: `${box.y * sy}px`,
                      width: `${box.w * sx}px`,
                      height: `${box.h * sy}px`,
                      border: '2px solid #22c55e',
                      borderRadius: 6,
                      boxShadow: '0 0 0 2px rgba(34,197,94,0.2) inset'
                    }
                    return <div style={style} />
                  })()
                )}
              </div>
            ) : (
              <p className="text-slate-500">No image selected.</p>
            )}
          </div>
          <div>
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
      </div>
    </div>
  )
}
