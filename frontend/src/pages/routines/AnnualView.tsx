import { useState, useEffect, useCallback } from 'react'
import { routinesApi, type Routine, type RoutineCompletion } from '../../api/routines'
import { AnnualHeatmap } from '../../components/routines/AnnualHeatmap'

export function AnnualView() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [routines, setRoutines] = useState<Routine[]>([])
  const [completionsByRoutine, setCompletionsByRoutine] = useState<Map<string, RoutineCompletion[]>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await routinesApi.getAll({ active: true })
      setRoutines(data.routines)

      const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString()
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString()

      const map = new Map<string, RoutineCompletion[]>()
      await Promise.all(
        data.routines.map(async r => {
          const cData = await routinesApi.getCompletions(r.id, { from: yearStart, to: yearEnd })
          map.set(r.id, cData.completions)
        })
      )
      setCompletionsByRoutine(new Map(map))
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  return (
    <div className="routines-container">
      <div className="grid-nav" style={{ marginBottom: '1.5rem' }}>
        <button className="grid-nav-btn" onClick={() => setYear(y => y - 1)}>←</button>
        <span className="grid-month-label">{year}</span>
        <button className="grid-nav-btn" onClick={() => setYear(y => y + 1)}>→</button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
      ) : routines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Aucune routine active.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {routines.map(r => (
            <AnnualHeatmap
              key={r.id}
              routine={r}
              completions={completionsByRoutine.get(r.id) ?? []}
              year={year}
            />
          ))}
        </div>
      )}
    </div>
  )
}
