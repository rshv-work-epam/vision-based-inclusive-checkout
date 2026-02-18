import { ChangeEvent, useEffect, useRef, useState, type CSSProperties } from 'react'

type Prediction = {
  label: string
  confidence: number
  box?: { x: number; y: number; w: number; h: number } | null
}

type PredictResult = { predictions: Prediction[] }

export default function Recognize() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null)
  const [displayDims, setDisplayDims] = useState<{ w: number; h: number } | null>(null)
  const [result, setResult] = useState<PredictResult | null>(null)
  const [liveEnabled, setLiveEnabled] = useState(true)
  const [liveResult, setLiveResult] = useState<PredictResult | null>(null)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [taskStatus, setTaskStatus] = useState<string | null>(null)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const liveBusyRef = useRef(false)
  const liveAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.srcObject = mediaStream

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [mediaStream])

  useEffect(() => {
    return () => {
      mediaStream?.getTracks().forEach((track) => track.stop())
    }
  }, [mediaStream])

  useEffect(() => {
    if (!mediaStream || !liveEnabled) {
      liveAbortRef.current?.abort()
      liveAbortRef.current = null
      liveBusyRef.current = false
      setLiveResult(null)
      setLiveError(null)
      return
    }

    let cancelled = false
    setLiveResult(null)
    setLiveError(null)

    const id = window.setInterval(async () => {
      if (cancelled) return
      if (liveBusyRef.current) return

      const video = videoRef.current
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return

      liveBusyRef.current = true
      const controller = new AbortController()
      liveAbortRef.current = controller

      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('Could not capture a frame from webcam.')
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.9)
        })
        if (!blob) {
          throw new Error('Could not capture a frame from webcam.')
        }

        const formData = new FormData()
        formData.append('file', blob, `webcam-live-${Date.now()}.jpg`)
        const response = await fetch('/api/inference/predict', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error(`Inference failed (${response.status})`)
        }
        const data = (await response.json()) as PredictResult
        if (!cancelled) {
          setLiveResult(data)
          setLiveError(null)
        }
      } catch (caughtError: unknown) {
        if (!cancelled) {
          if (caughtError instanceof DOMException && caughtError.name === 'AbortError') return
          setLiveError(caughtError instanceof Error ? caughtError.message : 'Could not run live recognition.')
        }
      } finally {
        if (!cancelled) liveBusyRef.current = false
      }
    }, 800)

    return () => {
      cancelled = true
      window.clearInterval(id)
      liveAbortRef.current?.abort()
      liveAbortRef.current = null
      liveBusyRef.current = false
    }
  }, [liveEnabled, mediaStream])

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

  async function startWebcam() {
    if (mediaStream) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      setMediaStream(stream)
      setWebcamError(null)
    } catch (error) {
      setWebcamError(error instanceof Error ? error.message : 'Could not access webcam.')
    }
  }

  function stopWebcam() {
    mediaStream?.getTracks().forEach((track) => track.stop())
    setMediaStream(null)
  }

  async function captureFromWebcam() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    })

    if (!blob) {
      setWebcamError('Could not capture an image from webcam.')
      return
    }

    const capturedFile = new File([blob], `webcam-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
    const nextPreview = URL.createObjectURL(capturedFile)

    if (preview) URL.revokeObjectURL(preview)

    setFile(capturedFile)
    setPreview(nextPreview)
    setResult(null)
    setError(null)
    setTaskStatus(null)
    setWebcamError(null)
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
  const liveTopPrediction = liveResult?.predictions?.[0] || null
  const liveConfidencePct = liveTopPrediction ? (liveTopPrediction.confidence * 100).toFixed(1) : null
  const liveOverlayText = (() => {
    if (!mediaStream || !liveEnabled) return null
    if (liveError) return `Live error: ${liveError}`
    if (!liveResult) return 'Live recognition: starting…'
    if (liveTopPrediction && liveConfidencePct) return `Detected: ${liveTopPrediction.label} (${liveConfidencePct}%)`
    return 'No confident match'
  })()

  const overlayStyle = (() => {
    const box = topPrediction?.box
    if (!box || !imgDims || !displayDims) return null
    const sx = displayDims.w / imgDims.w
    const sy = displayDims.h / imgDims.h
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
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">Use webcam</p>
          <div className="relative">
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg border border-slate-200 bg-black" />
            {liveOverlayText && (
              <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-black/70 px-3 py-2 text-sm text-white shadow">
                {liveOverlayText}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startWebcam}
              disabled={!!mediaStream}
              className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start webcam
            </button>
            <button
              type="button"
              onClick={stopWebcam}
              disabled={!mediaStream}
              className="rounded-lg bg-slate-500 px-3 py-2 text-sm text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Stop webcam
            </button>
            <button
              type="button"
              onClick={captureFromWebcam}
              disabled={!mediaStream}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Capture frame
            </button>
            <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={liveEnabled}
                disabled={!mediaStream}
                onChange={(event) => setLiveEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              Live recognition
            </label>
          </div>
          {webcamError && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{webcamError}</p>}
        </div>
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
