import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { citationsApi, type Citation, type SourceType } from '../../api/citations'
import { CitationCard } from '../../components/citations/CitationCard'
import { CitationForm } from '../../components/citations/CitationForm'
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'

const SOURCE_FILTERS: Array<{ value: SourceType | ''; label: string }> = [
  { value: '', label: 'Toutes' },
  { value: 'BOOK', label: '📚 Livres' },
  { value: 'ARTICLE', label: '📰 Articles' },
  { value: 'INTERNET', label: '🌐 Internet' },
  { value: 'PODCAST', label: '🎙️ Podcasts' },
  { value: 'FILM', label: '🎬 Films' },
  { value: 'SERIES', label: '📺 Séries' },
  { value: 'VIDEO', label: '▶️ Vidéos' },
  { value: 'PERSON', label: '🧑 Personnes' },
]

export function CitationList() {
  const [citations, setCitations] = useState<Citation[]>([])
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceType | ''>('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Parameters<typeof citationsApi.getAll>[0] = {}
      if (search) params.search = search
      if (sourceFilter) params.sourceType = sourceFilter as SourceType
      if (favoriteOnly) params.favorite = true
      const data = await citationsApi.getAll(params)
      setCitations(data.citations)
    } finally {
      setLoading(false)
    }
  }, [search, sourceFilter, favoriteOnly])

  useEffect(() => { load() }, [load])

  async function handleFavoriteToggle(id: string) {
    try {
      const { citation } = await citationsApi.toggleFavorite(id)
      setCitations(prev => prev.map(c => c.id === id ? citation : c))
    } catch {}
  }

  return (
    <div className="citations-container">
      <header className="citations-list-header">
        <div>
          <h1 className="citations-list-title">Citations</h1>
          <p className="citations-count">
            {citations.length} citation{citations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ImportExportButtons module="citations" onImportDone={load} />
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0.65rem 1.25rem' }} onClick={() => setShowForm(true)}>
            + Ajouter
          </button>
        </div>
      </header>

      <div className="citations-toolbar">
        <input
          className="input-field citations-search"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className={`btn${favoriteOnly ? ' btn-primary' : ' btn-secondary'}`}
          style={{ width: 'auto', padding: '0.6rem 0.875rem', flexShrink: 0 }}
          onClick={() => setFavoriteOnly(f => !f)}
          title="Favoris uniquement"
        >
          {favoriteOnly ? '★' : '☆'}
        </button>
      </div>

      <div className="citations-filters">
        {SOURCE_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-chip${sourceFilter === f.value ? ' filter-chip--active' : ''}`}
            onClick={() => setSourceFilter(f.value as SourceType | '')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="citations-loading"><div className="loading-spinner" /></div>
      ) : citations.length === 0 ? (
        <div className="citations-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
          <p>{search || sourceFilter || favoriteOnly ? 'Aucune citation trouvée.' : 'Aucune citation. Ajoutez-en une !'}</p>
          {!search && !sourceFilter && !favoriteOnly && (
            <button className="btn btn-primary" style={{ marginTop: '1rem', width: 'auto', display: 'inline-flex', padding: '0.65rem 1.25rem' }} onClick={() => setShowForm(true)}>
              Ajouter ma première citation
            </button>
          )}
        </div>
      ) : (
        <div className="citations-list">
          {citations.map(c => (
            <CitationCard
              key={c.id}
              citation={c}
              onClick={() => navigate(`/citations/${c.id}`)}
              onFavoriteToggle={handleFavoriteToggle}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CitationForm
          onSave={async data => {
            await citationsApi.create(data)
            await load()
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
