import { useEffect, useState } from 'react'
import { Link, Route, Routes, BrowserRouter, useLocation } from 'react-router-dom'
import ServiceCard from './components/ServiceCard'
import ToolRunner from './components/ToolRunner'
import Recognize from './components/Recognize'
import ReviewQueue from './components/ReviewQueue'

const SERVICES = [
  { key: 'catalog', name: 'Catalog', path: '/api/catalog' },
  { key: 'inference', name: 'Inference', path: '/api/inference' },
  { key: 'review-tasks', name: 'Review Tasks', path: '/api/review-tasks' },
  { key: 'operator-assistant', name: 'Operator Assistant', path: '/api/operator-assistant' }
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

function Dashboard() {
  const [status, setStatus] = useState<StatusMap>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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
        <h2 className="text-2xl font-semibold">Inclusive checkout operations cockpit</h2>
        <p className="mt-2 max-w-3xl text-indigo-100">
          Monitor service health, run assistant tools, and support real people in real checkout scenarios with confidence.
        </p>
        <p className="mt-3 text-sm text-indigo-100">Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Loading…'}</p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Service Health</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <ServiceCard key={s.key} name={s.name} status={status[s.key]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Operator Assistant Tools</h2>
        <ToolRunner basePath="/api/operator-assistant" />
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
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🛒</div>
              <h1 className="text-xl font-semibold text-slate-800 md:text-2xl">Vision-based Inclusive Checkout</h1>
            </div>
            <nav className="flex gap-2">
              <NavLinkItem to="/">Dashboard</NavLinkItem>
              <NavLinkItem to="/recognize">Recognize</NavLinkItem>
              <NavLinkItem to="/review-queue">Review Queue</NavLinkItem>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/recognize" element={<Recognize />} />
            <Route path="/review-queue" element={<ReviewQueue />} />
          </Routes>
        </main>
        <footer className="py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} VBIC · Inclusive by design</footer>
      </div>
    </BrowserRouter>
  )
}
