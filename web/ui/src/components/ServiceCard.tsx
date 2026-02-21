import type { Language } from '../App'

type Props = {
  language: Language
  name: string
  status?: { healthz?: number; readyz?: number; livez?: number }
}

const TEXT = {
  uk: {
    offline: 'офлайн',
    healthy: 'Працює',
    attentionNeeded: 'Потрібна увага'
  },
  en: {
    offline: 'offline',
    healthy: 'Healthy',
    attentionNeeded: 'Attention needed'
  }
} as const

function formatStatus(language: Language, code?: number): string {
  if (code === undefined) return '—'
  if (code === 0) return TEXT[language].offline
  return String(code)
}

export default function ServiceCard({ language, name, status }: Props) {
  const healthy = status && status.healthz === 200 && status.readyz === 200 && status.livez === 200
  const t = TEXT[language]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-slate-800">{name}</h3>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${healthy ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          <span className={`h-2 w-2 rounded-full ${healthy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          {healthy ? t.healthy : t.attentionNeeded}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 text-center text-sm">
        <div>
          <dt className="text-slate-500">/healthz</dt>
          <dd className="font-semibold">{formatStatus(language, status?.healthz)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">/readyz</dt>
          <dd className="font-semibold">{formatStatus(language, status?.readyz)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">/livez</dt>
          <dd className="font-semibold">{formatStatus(language, status?.livez)}</dd>
        </div>
      </dl>
    </div>
  )
}
