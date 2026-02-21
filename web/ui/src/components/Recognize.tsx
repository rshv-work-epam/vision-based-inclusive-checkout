import { ChangeEvent, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Language } from '../App'

type Prediction = {
  label: string
  confidence: number
  box?: { x: number; y: number; w: number; h: number } | null
}

type PredictResult = { predictions: Prediction[] }

const TEXT = {
  uk: {
    couldNotCaptureFrame: 'Не вдалося зчитати кадр із вебкамери.',
    couldNotCaptureImage: 'Не вдалося захопити кадр із вебкамери.',
    inferenceFailedWithCode: (code: number) => `Інференс не вдався (${code})`,
    couldNotRunLiveRecognition: 'Не вдалося виконати розпізнавання в реальному часі.',
    couldNotRunRecognition: 'Не вдалося виконати розпізнавання.',
    couldNotAccessWebcam: 'Не вдалося отримати доступ до вебкамери.',
    taskCreationFailedWithCode: (code: number) => `Не вдалося створити завдання (${code})`,
    couldNotCreateTask: 'Не вдалося створити завдання на перевірку.',
    reviewTaskCreated: 'Завдання на перевірку успішно створено.',
    liveError: 'Помилка в live-режимі',
    liveStarting: 'Live-розпізнавання: запуск…',
    detected: 'Виявлено',
    noConfidentMatch: 'Немає впевненого збігу',
    uploadTitle: 'Завантаження зображення товару',
    uploadDescription: 'Оберіть фото товару. Модель поверне мітку та рівень впевненості.',
    productImage: 'Зображення товару',
    useWebcam: 'Використати вебкамеру',
    startWebcam: 'Увімкнути вебкамеру',
    stopWebcam: 'Вимкнути вебкамеру',
    captureFrame: 'Захопити кадр',
    liveRecognition: 'Live-розпізнавання',
    recognizing: 'Розпізнавання…',
    recognize: 'Розпізнати',
    predictionTitle: 'Прогноз',
    noImageSelected: 'Зображення ще не вибрано.',
    topPrediction: 'Найкращий прогноз',
    confidence: 'Впевненість',
    creating: 'Створення…',
    createReviewTask: 'Створити завдання на перевірку',
    noPredictionYet: 'Поки немає прогнозу.',
    previewAlt: 'Попередній перегляд обраного товару',
    bboxLabel: 'Рамка виявленого обʼєкта'
  },
  en: {
    couldNotCaptureFrame: 'Could not capture a frame from webcam.',
    couldNotCaptureImage: 'Could not capture an image from webcam.',
    inferenceFailedWithCode: (code: number) => `Inference failed (${code})`,
    couldNotRunLiveRecognition: 'Could not run live recognition.',
    couldNotRunRecognition: 'Could not run recognition.',
    couldNotAccessWebcam: 'Could not access webcam.',
    taskCreationFailedWithCode: (code: number) => `Task creation failed (${code})`,
    couldNotCreateTask: 'Could not create a review task.',
    reviewTaskCreated: 'Review task created successfully.',
    liveError: 'Live error',
    liveStarting: 'Live recognition: starting…',
    detected: 'Detected',
    noConfidentMatch: 'No confident match',
    uploadTitle: 'Upload Product Image',
    uploadDescription: 'Choose a product image. The model predicts a product label and confidence score.',
    productImage: 'Product image',
    useWebcam: 'Use webcam',
    startWebcam: 'Start webcam',
    stopWebcam: 'Stop webcam',
    captureFrame: 'Capture frame',
    liveRecognition: 'Live recognition',
    recognizing: 'Recognizing…',
    recognize: 'Recognize',
    predictionTitle: 'Prediction',
    noImageSelected: 'No image selected yet.',
    topPrediction: 'Top prediction',
    confidence: 'Confidence',
    creating: 'Creating…',
    createReviewTask: 'Create Review Task',
    noPredictionYet: 'No prediction yet.',
    previewAlt: 'Selected product preview',
    bboxLabel: 'Predicted object bounding box'
  }
} as const

type Props = { language: Language }

export default function Recognize({ language }: Props) {
  const t = TEXT[language]
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
          throw new Error(t.couldNotCaptureFrame)
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.9)
        })
        if (!blob) {
          throw new Error(t.couldNotCaptureFrame)
        }

        const formData = new FormData()
        formData.append('file', blob, `webcam-live-${Date.now()}.jpg`)
        const response = await fetch('/api/inference/predict', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        })
        if (!response.ok) {
          throw new Error(t.inferenceFailedWithCode(response.status))
        }
        const data = (await response.json()) as PredictResult
        if (!cancelled) {
          setLiveResult(data)
          setLiveError(null)
        }
      } catch (caughtError: unknown) {
        if (!cancelled) {
          if (caughtError instanceof DOMException && caughtError.name === 'AbortError') return
          setLiveError(caughtError instanceof Error ? caughtError.message : t.couldNotRunLiveRecognition)
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
        throw new Error(t.inferenceFailedWithCode(response.status))
      }
      const data = (await response.json()) as PredictResult
      setResult(data)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.couldNotRunRecognition)
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
      setWebcamError(error instanceof Error ? error.message : t.couldNotAccessWebcam)
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
      setWebcamError(t.couldNotCaptureImage)
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
        throw new Error(t.taskCreationFailedWithCode(response.status))
      }
      setTaskStatus(t.reviewTaskCreated)
    } catch (createError) {
      setTaskStatus(createError instanceof Error ? createError.message : t.couldNotCreateTask)
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
    if (liveError) return `${t.liveError}: ${liveError}`
    if (!liveResult) return t.liveStarting
    if (liveTopPrediction && liveConfidencePct) return `${t.detected}: ${liveTopPrediction.label} (${liveConfidencePct}%)`
    return t.noConfidentMatch
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
        <h3 className="text-lg font-medium text-slate-800">{t.uploadTitle}</h3>
        <p className="text-sm text-slate-600">{t.uploadDescription}</p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="product-image">{t.productImage}</label>
        <input id="product-image" type="file" accept="image/*" onChange={onFileChange} className="w-full rounded-lg border border-slate-200 p-2" />
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">{t.useWebcam}</p>
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
              {t.startWebcam}
            </button>
            <button
              type="button"
              onClick={stopWebcam}
              disabled={!mediaStream}
              className="rounded-lg bg-slate-500 px-3 py-2 text-sm text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.stopWebcam}
            </button>
            <button
              type="button"
              onClick={captureFromWebcam}
              disabled={!mediaStream}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.captureFrame}
            </button>
            <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              <input
                type="checkbox"
                checked={liveEnabled}
                disabled={!mediaStream}
                onChange={(event) => setLiveEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              {t.liveRecognition}
            </label>
          </div>
          {webcamError && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{webcamError}</p>}
        </div>
        <button
          disabled={!file || isSubmitting}
          onClick={submit}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t.recognizing : t.recognize}
        </button>
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {taskStatus && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{taskStatus}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-medium text-slate-800">{t.predictionTitle}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            {preview ? (
              <div className="relative inline-block overflow-hidden rounded-lg border border-slate-200">
                <img
                  src={preview}
                  alt={t.previewAlt}
                  className="max-w-full h-auto"
                  onLoad={(event) => {
                    const image = event.currentTarget
                    setImgDims({ w: image.naturalWidth, h: image.naturalHeight })
                    setDisplayDims({ w: image.clientWidth, h: image.clientHeight })
                  }}
                />
                {overlayStyle && <div style={overlayStyle} aria-label={t.bboxLabel} />}
              </div>
            ) : (
              <p className="text-slate-500">{t.noImageSelected}</p>
            )}
          </div>
          <div>
            {result ? (
              <div className="space-y-3">
                {topPrediction && (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-sm text-slate-600">{t.topPrediction}</p>
                    <p className="text-lg font-semibold text-slate-800">{topPrediction.label}</p>
                    <p className="text-sm text-slate-600">{t.confidence}: {confidencePct}%</p>
                  </div>
                )}
                <pre className="overflow-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100">{JSON.stringify(result, null, 2)}</pre>
                <button
                  onClick={createTask}
                  disabled={!topPrediction || isCreatingTask}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingTask ? t.creating : t.createReviewTask}
                </button>
              </div>
            ) : (
              <p className="text-slate-500">{t.noPredictionYet}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
