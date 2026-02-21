import { useEffect, useState } from 'react'
import { Link, Route, Routes, BrowserRouter, useLocation } from 'react-router-dom'
import ServiceCard from './components/ServiceCard'
import ToolRunner from './components/ToolRunner'
import Recognize from './components/Recognize'
import ReviewQueue from './components/ReviewQueue'

export type Language = 'uk' | 'en'

const SERVICES = [
  { key: 'catalog', names: { uk: 'Каталог', en: 'Catalog' }, path: '/api/catalog' },
  { key: 'inference', names: { uk: 'Інференс', en: 'Inference' }, path: '/api/inference' },
  { key: 'review-tasks', names: { uk: 'Черга перевірки', en: 'Review Tasks' }, path: '/api/review-tasks' },
  { key: 'operator-assistant', names: { uk: 'Помічник оператора', en: 'Operator Assistant' }, path: '/api/operator-assistant' }
]

type StatusMap = Record<string, { healthz?: number; readyz?: number; livez?: number }>

async function fetchProbe(path: string, signal: AbortSignal): Promise<number> {
  try {
    const response = await fetch(path, { signal })
    return response.status
  } catch {
    return 0
  }
}

const TEXT = {
  uk: {
    appTitle: 'Інклюзивна каса на базі компʼютерного зору',
    navDashboard: 'Панель',
    navRecognize: 'Розпізнавання',
    navReviewQueue: 'Черга перевірки',
    language: 'Мова',
    heroTitle: 'Операційна панель інклюзивної каси',
    heroBody: 'Відстежуйте стан сервісів, запускайте інструменти оператора і підтримуйте покупців у реальних сценаріях самообслуговування.',
    lastUpdated: 'Оновлено',
    loading: 'Завантаження…',
    serviceHealth: 'Стан сервісів',
    toolsTitle: 'Інструменти помічника оператора',
    footer: 'Інклюзивність за замовчуванням'
  },
  en: {
    appTitle: 'Vision-based Inclusive Checkout',
    navDashboard: 'Dashboard',
    navRecognize: 'Recognize',
    navReviewQueue: 'Review Queue',
    language: 'Language',
    heroTitle: 'Inclusive checkout operations cockpit',
    heroBody: 'Monitor service health, run assistant tools, and support real people in real checkout scenarios with confidence.',
    lastUpdated: 'Last updated',
    loading: 'Loading…',
    serviceHealth: 'Service Health',
    toolsTitle: 'Operator Assistant Tools',
    footer: 'Inclusive by design'
  }
} as const

function Dashboard({ language }: { language: Language }) {
  const [status, setStatus] = useState<StatusMap>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const t = TEXT[language]
  const locale = language === 'uk' ? 'uk-UA' : 'en-US'

  useEffect(() => {
    const controller = new AbortController()
    async function fetchAll() {
      const serviceStatuses = await Promise.all(
        SERVICES.map(async (service) => {
          const [healthz, readyz, livez] = await Promise.all([
            fetchProbe(`${service.path}/healthz`, controller.signal),
            fetchProbe(`${service.path}/readyz`, controller.signal),
            fetchProbe(`${service.path}/livez`, controller.signal)
          ])
          return [service.key, { healthz, readyz, livez }] as const
        })
      )
      setStatus(Object.fromEntries(serviceStatuses))
      setLastUpdated(new Date())
    }

    fetchAll()
    const id = setInterval(fetchAll, 5000)
    return () => {
      controller.abort()
      clearInterval(id)
    }
  }, [])

  return (
    <>
      <section className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 p-6 text-white shadow-lg">
        <h2 className="text-2xl font-semibold">{t.heroTitle}</h2>
        <p className="mt-2 max-w-3xl text-indigo-100">
          {t.heroBody}
        </p>
        <p className="mt-3 text-sm text-indigo-100">
          {t.lastUpdated}: {lastUpdated ? lastUpdated.toLocaleTimeString(locale) : t.loading}
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t.serviceHealth}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <ServiceCard key={s.key} language={language} name={s.names[language]} status={status[s.key]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t.toolsTitle}</h2>
        <ToolRunner language={language} basePath="/api/operator-assistant" />
      </section>
    </>
  )
}

function NavLinkItem({ to, children }: { to: string; children: string }) {
  const location = useLocation()
  const isActive = location.pathname === to
  return (
    <Link
      to={to}
      className={`rounded-lg px-3 py-2 transition ${isActive ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700 hover:bg-slate-100 hover:text-indigo-600'}`}
    >
      {children}
    </Link>
  )
}

export default function App() {
  const [language, setLanguage] = useState<Language>('uk')
  const t = TEXT[language]

  useEffect(() => {
    const saved = window.localStorage.getItem('vbic-language')
    if (saved === 'uk' || saved === 'en') {
      setLanguage(saved)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('vbic-language', language)
  }, [language])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🛒</div>
              <h1 className="text-xl font-semibold text-slate-800 md:text-2xl">{t.appTitle}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <nav className="flex gap-2">
                <NavLinkItem to="/">{t.navDashboard}</NavLinkItem>
                <NavLinkItem to="/recognize">{t.navRecognize}</NavLinkItem>
                <NavLinkItem to="/review-queue">{t.navReviewQueue}</NavLinkItem>
              </nav>
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm">
                <span className="text-slate-600">{t.language}:</span>
                <button
                  type="button"
                  onClick={() => setLanguage('uk')}
                  className={`rounded px-2 py-1 ${language === 'uk' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  UK
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`rounded px-2 py-1 ${language === 'en' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard language={language} />} />
            <Route path="/recognize" element={<Recognize language={language} />} />
            <Route path="/review-queue" element={<ReviewQueue language={language} />} />
          </Routes>
        </main>
        <footer className="py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} VBIC · {t.footer}</footer>
      </div>
    </BrowserRouter>
  )
}
