import { ChangeEvent, useEffect, useState, type CSSProperties } from 'react'

type Prediction = {
  label: string
  confidence: number
  box?: { x: number; y: number; w: number; h: number }
}

type PredictResult = { predictions: Prediction[] }

export default function Recognize() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null)
  const [displayDims, setDisplayDims] = useState<{ w: number; h: number } | null>(null)
  const [result, setResult] = useState<PredictResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [taskStatus, setTaskStatus] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null
    setFile(nextFile)
    setResult(null)
    setError(null)
    setTaskStatus(null)

    if (preview) URL.revokeObjectURL(preview)
    if (nextFile) {
      setPreview(URL.createObjectURL(nextFile))
    } else {
      setPreview(null)
    }
  }

  async function submit() {
    if (!file || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    setTaskStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/inference/predict', { method: 'POST', body: formData })
      if (!response.ok) {
        throw new Error(`Inference failed (${response.status})`)
      }
      const data = (await response.json()) as PredictResult
      setResult(data)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not run recognition.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function createTask() {
    const topPrediction = result?.predictions?.[0]
    if (!topPrediction || isCreatingTask) return

    setIsCreatingTask(true)
    setTaskStatus(null)

    try {
      const response = await fetch('/api/review-tasks/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: topPrediction.label,
          confidence: topPrediction.confidence,
          image_name: file?.name
        })
      })

      if (!response.ok) {
        throw new Error(`Task creation failed (${response.status})`)
      }
      setTaskStatus('Review task created successfully.')
    } catch (createError) {
      setTaskStatus(createError instanceof Error ? createError.message : 'Could not create a review task.')
    } finally {
      setIsCreatingTask(false)
    }
  }

  const topPrediction = result?.predictions?.[0]
  const confidencePct = topPrediction ? (topPrediction.confidence * 100).toFixed(1) : null

  const overlayStyle = (() => {
    if (!topPrediction?.box || !imgDims || !displayDims) return null
    const sx = displayDims.w / imgDims.w
    const sy = displayDims.h / imgDims.h
    const box = topPrediction.box
    const style: CSSProperties = {
      position: 'absolute',
      left: `${box.x * sx}px`,
      top: `${box.y * sy}px`,
      width: `${box.w * sx}px`,
      height: `${box.h * sy}px`,
      border: '2px solid #22c55e',
      borderRadius: 8,
      boxShadow: '0 0 0 2px rgba(34,197,94,0.20) inset'
    }
    return style
  })()

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-medium text-slate-800">Upload Product Image</h3>
        <p className="text-sm text-slate-600">Choose a product image. The model predicts a product label and confidence score.</p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="product-image">Product image</label>
        <input id="product-image" type="file" accept="image/*" onChange={onFileChange} className="w-full rounded-lg border border-slate-200 p-2" />
        <button
          disabled={!file || isSubmitting}
          onClick={submit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Recognizing…' : 'Recognize'}
        </button>
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {taskStatus && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{taskStatus}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-medium text-slate-800">Prediction</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            {preview ? (
              <div className="relative inline-block overflow-hidden rounded-lg border border-slate-200">
                <img
                  src={preview}
                  alt="Selected product preview"
                  className="max-w-full h-auto"
                  onLoad={(event) => {
                    const image = event.currentTarget
                    setImgDims({ w: image.naturalWidth, h: image.naturalHeight })
                    setDisplayDims({ w: image.clientWidth, h: image.clientHeight })
                  }}
                />
                {overlayStyle && <div style={overlayStyle} aria-label="Predicted object bounding box" />}
              </div>
            ) : (
              <p className="text-slate-500">No image selected yet.</p>
            )}
          </div>
          <div>
            {result ? (
              <div className="space-y-3">
                {topPrediction && (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm text-slate-600">Top prediction</p>
                    <p className="text-lg font-semibold text-slate-800">{topPrediction.label}</p>
                    <p className="text-sm text-slate-600">Confidence: {confidencePct}%</p>
                  </div>
                )}
                <pre className="overflow-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100">{JSON.stringify(result, null, 2)}</pre>
                <button
                  onClick={createTask}
                  disabled={!topPrediction || isCreatingTask}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingTask ? 'Creating…' : 'Create Review Task'}
                </button>
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
