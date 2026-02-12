import { useEffect, useState } from 'react'

type Task = { id: number; created_at: string; label: string; confidence: number; image_name?: string; status: string }

export default function ReviewQueue() {
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    let stop = false
    async function load() {
      const r = await fetch('/api/review-tasks/tasks')
      const data = await r.json()
      if (!stop) setTasks(data)
    }
    load()
    const id = setInterval(load, 5000)
    return () => { stop = true; clearInterval(id) }
  }, [])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-medium text-slate-800 mb-3">Pending Review Tasks</h3>
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
            {tasks.map(t => (
              <tr key={t.id} className="odd:bg-slate-50">
                <td className="px-3 py-2">{t.id}</td>
                <td className="px-3 py-2">{new Date(t.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{t.label}</td>
                <td className="px-3 py-2">{(t.confidence*100).toFixed(1)}%</td>
                <td className="px-3 py-2">{t.image_name || '—'}</td>
                <td className="px-3 py-2">{t.status}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td className="px-3 py-6 text-slate-500" colSpan={6}>No tasks</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
