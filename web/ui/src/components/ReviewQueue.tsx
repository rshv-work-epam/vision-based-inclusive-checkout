import { useEffect, useState } from 'react'

type Task = {
  id: number
  created_at: string
  label: string
  confidence: number
  image_name?: string
  status: string
}

function statusClassName(status: string): string {
  if (status === 'pending') return 'bg-amber-50 text-amber-700'
  if (status === 'resolved') return 'bg-emerald-50 text-emerald-700'
  return 'bg-slate-100 text-slate-700'
}

export default function ReviewQueue() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stop = false

    async function load() {
      try {
        const response = await fetch('/api/review-tasks/tasks')
        if (!response.ok) {
          throw new Error(`Failed to load tasks (${response.status})`)
        }
        const data = (await response.json()) as Task[]
        if (!stop) {
          setTasks(data)
          setError(null)
        }
      } catch (loadError) {
        if (!stop) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load review tasks.')
        }
      } finally {
        if (!stop) setLoading(false)
      }
    }

    load()
    const id = setInterval(load, 5000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-lg font-medium text-slate-800">Pending Review Tasks</h3>
      <p className="mb-3 text-sm text-slate-600">Human-review queue for low-confidence or edge-case detections.</p>
      {error && <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Conf.</th>
              <th className="px-3 py-2">Image</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="odd:bg-slate-50">
                <td className="px-3 py-2">{task.id}</td>
                <td className="px-3 py-2">{new Date(task.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{task.label}</td>
                <td className="px-3 py-2">{(task.confidence * 100).toFixed(1)}%</td>
                <td className="px-3 py-2">{task.image_name || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(task.status)}`}>{task.status}</span>
                </td>
              </tr>
            ))}
            {!loading && tasks.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={6}>No tasks right now.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
