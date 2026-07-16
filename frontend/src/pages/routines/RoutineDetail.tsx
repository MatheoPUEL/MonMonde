import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { routinesApi, type Routine, type RoutineStats, type RoutineCompletion, TYPE_LABELS, TYPE_COLORS } from '../../api/routines'
import { FrequencyBadge } from '../../components/routines/FrequencyBadge'
import { StreakBadge } from '../../components/routines/StreakBadge'
import { RoutineForm } from '../../components/routines/RoutineForm'
import { ConfirmModal } from '../../components/ui/ConfirmModal'

export function RoutineDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [stats, setStats] = useState<RoutineStats | null>(null)
  const [recentCompletions, setRecentCompletions] = useState<RoutineCompletion[]>([])
  const [showEdit, setShowEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [rData, sData] = await Promise.all([
        routinesApi.getOne(id),
        routinesApi.getStats(id),
      ])
      setRoutine(rData.routine)
      setStats(sData)

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
      const cData = await routinesApi.getCompletions(id, { from: thirtyDaysAgo })
      setRecentCompletions(cData.completions)
    } catch {
      navigate('/routines/list')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  function handleDelete() {
    if (!id) return
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!id) return
    await routinesApi.delete(id)
    navigate('/routines/list')
  }

  if (loading || !routine) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
  }

  return (
    <div className="routines-container" style={{ maxWidth: 720 }}>
      <button
        onClick={() => navigate('/routines/list')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}
      >
        ← Retour
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '2.5rem' }}>{routine.icon}</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', margin: 0 }}>
            {routine.name}
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="type-badge" style={{ background: TYPE_COLORS[routine.type] }}>
              {TYPE_LABELS[routine.type]}
            </span>
            <FrequencyBadge rruleString={routine.rruleString} />
            {stats && <StreakBadge streak={stats.currentStreak} />}
            {routine.category && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{routine.category}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>Modifier</button>
          <button className="btn-danger" onClick={handleDelete}>
            Supprimer
          </button>
        </div>
      </div>

      {routine.description && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{routine.description}</p>
      )}

      {stats && (
        <div className="stats-panel">
          <div className="stat-card">
            <div className="stat-value">{stats.totalCompletions}</div>
            <div className="stat-label">Complétions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{Math.round(stats.successRate * 100)}%</div>
            <div className="stat-label">Taux de réussite</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.currentStreak}</div>
            <div className="stat-label">Série actuelle</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.longestStreak}</div>
            <div className="stat-label">Record</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.thisMonth}</div>
            <div className="stat-label">Ce mois</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.thisYear}</div>
            <div className="stat-label">Cette année</div>
          </div>
        </div>
      )}

      {recentCompletions.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', marginBottom: '0.75rem' }}>
            30 derniers jours
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {recentCompletions.slice().reverse().slice(0, 15).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                <span style={{ color: c.done ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                  {c.done ? '✓' : '✗'}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {c.note && <span style={{ color: 'var(--text-secondary)' }}>{c.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showEdit && (
        <RoutineForm
          initial={routine}
          onSave={async data => {
            await routinesApi.update(routine.id, data)
            await load()
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Supprimer cette routine"
          message="Supprimer cette routine définitivement ? Cette action est irréversible."
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
