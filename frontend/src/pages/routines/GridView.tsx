import { useState, useEffect, useCallback } from 'react'
import { routinesApi, type Routine, type RoutineCompletion } from '../../api/routines'
import { HabitGrid } from '../../components/routines/HabitGrid'

export function GridView() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await routinesApi.getGrid(year, month)
      setRoutines(data.routines)
      setCompletions(data.completions)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  async function handleToggle(routineId: string, dateISO: string) {
    const dateKey = dateISO.slice(0, 10)
    const existing = completions.find(
      c => c.routineId === routineId && new Date(c.date).toISOString().slice(0, 10) === dateKey
    )
    if (existing?.done) {
      await routinesApi.deleteCompletion(routineId, existing.date)
    } else {
      await routinesApi.upsertCompletion(routineId, { date: dateISO, done: true })
    }
    await load()
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const monthLabel = new Date(year, month - 1, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="routines-container">
      <div className="grid-nav">
        <button className="grid-nav-btn" onClick={prevMonth}>←</button>
        <span className="grid-month-label" style={{ textTransform: 'capitalize' }}>{monthLabel}</span>
        <button className="grid-nav-btn" onClick={nextMonth}>→</button>
      </div>
      {loading ? (
        <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
      ) : routines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Aucune routine active. Créez-en une dans Éléments.
        </div>
      ) : (
        <HabitGrid
          routines={routines}
          completions={completions}
          year={year}
          month={month}
          onToggle={handleToggle}
        />
      )}
    </div>
  )
}
