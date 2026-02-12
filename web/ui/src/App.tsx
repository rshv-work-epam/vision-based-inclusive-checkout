import { useEffect, useState } from 'react'
import { Link, Route, Routes, BrowserRouter } from 'react-router-dom'
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

function Dashboard() {
  const [status, setStatus] = useState<StatusMap>({})

  useEffect(() => {
    const controller = new AbortController()
    async function fetchAll() {
      const next: StatusMap = {}
      for (const s of SERVICES) {
        const healthz = await fetch(`${s.path}/healthz`, { signal: controller.signal }).then(r => r.status).catch(() => 0)
        const readyz = await fetch(`${s.path}/readyz`, { signal: controller.signal }).then(r => r.status).catch(() => 0)
        const livez = await fetch(`${s.path}/livez`, { signal: controller.signal }).then(r => r.status).catch(() => 0)
        next[s.key] = { healthz, readyz, livez }
      }
      setStatus(next)
    }
    fetchAll()
    const id = setInterval(fetchAll, 5000)
    return () => { controller.abort(); clearInterval(id) }
  }, [])

  return (
    <>
      <section>
        <h2 className="text-xl font-semibold mb-4">Service Health</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(s => (
            <ServiceCard key={s.key} name={s.name} status={status[s.key]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Operator Assistant Tools</h2>
        <ToolRunner basePath="/api/operator-assistant" />
      </section>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <header className="bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-6 py-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🛒</div>
              <h1 className="text-2xl font-semibold text-slate-800">Vision-based Inclusive Checkout</h1>
            </div>
            <nav className="flex gap-4 text-slate-700">
              <Link to="/" className="hover:text-indigo-600">Dashboard</Link>
              <Link to="/recognize" className="hover:text-indigo-600">Recognize</Link>
              <Link to="/review-queue" className="hover:text-indigo-600">Review Queue</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/recognize" element={<Recognize />} />
            <Route path="/review-queue" element={<ReviewQueue />} />
          </Routes>
        </main>
        <footer className="text-center text-sm text-slate-500 py-8">© {new Date().getFullYear()} VBIC</footer>
      </div>
    </BrowserRouter>
  )
}
