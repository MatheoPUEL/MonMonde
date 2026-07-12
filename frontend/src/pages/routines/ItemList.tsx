import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { routinesApi, type Routine, type RoutineType } from '../../api/routines'
import { RoutineCard } from '../../components/routines/RoutineCard'
import { RoutineForm } from '../../components/routines/RoutineForm'
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'

const TYPE_FILTERS: Array<{ value: RoutineType | ''; label: string }> = [
  { value: '', label: 'Tous' },
  { value: 'HABIT', label: 'Habitudes' },
  { value: 'TASK', label: 'Tâches' },
  { value: 'OBLIGATION', label: 'Obligations' },
]

export function ItemList() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<RoutineType | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: { search?: string; type?: RoutineType } = {}
      if (search) params.search = search
      if (typeFilter) params.type = typeFilter as RoutineType
      const data = await routinesApi.getAll(Object.keys(params).length ? params : undefined)
      setRoutines(data.routines)
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="routines-container">
      <header className="routines-list-header">
        <div>
          <h1 className="routines-list-title">Routines</h1>
          <p className="routines-count">{routines.length} routine{routines.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ImportExportButtons module="routines" onImportDone={load} />
          <button className="btn btn-primary btn-add-routine" onClick={() => setShowForm(true)}>
            + Ajouter
          </button>
        </div>
      </header>

      <div className="routines-toolbar">
        <input
          className="input-field routines-search"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="routines-filters">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-chip${typeFilter === f.value ? ' filter-chip--active' : ''}`}
            onClick={() => setTypeFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="routines-loading"><div className="loading-spinner" /></div>
      ) : routines.length === 0 ? (
        <div className="routines-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <p>{search || typeFilter ? 'Aucune routine trouvée.' : 'Aucune routine. Créez-en une !'}</p>
          {!search && !typeFilter && (
            <button className="btn btn-primary btn-add-routine" style={{ marginTop: '1rem' }} onClick={() => setShowForm(true)}>
              Créer ma première routine
            </button>
          )}
        </div>
      ) : (
        <div className="routines-list">
          {routines.map(r => (
            <RoutineCard
              key={r.id}
              routine={r}
              onClick={() => navigate(`/routines/${r.id}`)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <RoutineForm
          onSave={async data => {
            await routinesApi.create(data)
            await load()
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
