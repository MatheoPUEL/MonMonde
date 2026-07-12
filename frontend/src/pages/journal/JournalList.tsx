import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { journalApi, JournalEntry, Mood, ArchiveItem, EMPTY_DOC } from '../../api/journal'
import { EntryCard } from '../../components/journal/EntryCard'
import { StatsPanel } from '../../components/journal/StatsPanel'
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'

const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: 'EXCELLENT', label: 'Excellent', emoji: '😄' },
  { value: 'GOOD', label: 'Bon', emoji: '🙂' },
  { value: 'NEUTRAL', label: 'Neutre', emoji: '😐' },
  { value: 'BAD', label: 'Mauvais', emoji: '😔' },
  { value: 'VERY_BAD', label: 'Très mauvais', emoji: '😞' },
]

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export function JournalList() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [mood, setMood] = useState<Mood | ''>('')
  const [favorite, setFavorite] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [draft, setDraft] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [archives, setArchives] = useState<ArchiveItem[]>([])
  const [showStats, setShowStats] = useState(false)

  useEffect(() => {
    journalApi.getArchives().then(d => setArchives(d.archives)).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setLoading(true)
    journalApi.getEntries({
      search: search || undefined,
      mood: mood || undefined,
      favorite: favorite || undefined,
      pinned: pinned || undefined,
      draft: draft || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
      .then(d => { setEntries(d.entries); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search, mood, favorite, pinned, draft, dateFrom, dateTo])

  async function handleNew() {
    try {
      const { entry } = await journalApi.createEntry({ title: '', content: EMPTY_DOC, draft: true })
      navigate(`/journal/${entry.id}`)
    } catch {}
  }

  function selectArchive(year: number, month: number) {
    setDateFrom(new Date(year, month - 1, 1).toISOString())
    setDateTo(new Date(year, month, 0, 23, 59, 59).toISOString())
  }

  function clearArchive() {
    setDateFrom('')
    setDateTo('')
  }

  function clearFilters() {
    setMood('')
    setFavorite(false)
    setPinned(false)
    setDraft(false)
    setDateFrom('')
    setDateTo('')
  }

  const hasFilters = !!(mood || favorite || pinned || draft || dateFrom || dateTo)

  const activeArchiveYear = dateFrom ? new Date(dateFrom).getFullYear() : null
  const activeArchiveMonth = dateFrom ? new Date(dateFrom).getMonth() + 1 : null

  return (
    <div className="journal-layout">
      <div className="journal-main">
        <div className="journal-header">
          <div>
            <h1 className="journal-title">Journal</h1>
            <div className="journal-count">{total} entrée{total !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <ImportExportButtons module="journal" onImportDone={() => {
              journalApi.getEntries().then(d => { setEntries(d.entries); setTotal(d.total) }).catch(() => {})
            }} />
            <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => setShowStats(s => !s)}>
              📊 Stats
            </button>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleNew}>+ Nouvelle entrée</button>
          </div>
        </div>

        <div className={`stats-accordion${showStats ? ' stats-accordion--open' : ''}`}>
          <StatsPanel />
        </div>

        <div className="journal-filters">
          <input
            className="input-field journal-search"
            placeholder="Rechercher dans le journal…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <div className="journal-filter-row">
            <select
              className="status-select"
              value={mood}
              onChange={e => setMood(e.target.value as Mood | '')}
            >
              <option value="">Toutes les humeurs</option>
              {MOODS.map(m => (
                <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
              ))}
            </select>
            <button
              className={`filter-toggle${favorite ? ' filter-toggle--active' : ''}`}
              onClick={() => setFavorite(f => !f)}
            >★ Favoris</button>
            <button
              className={`filter-toggle${pinned ? ' filter-toggle--active' : ''}`}
              onClick={() => setPinned(p => !p)}
            >📌 Épinglées</button>
            <button
              className={`filter-toggle${draft ? ' filter-toggle--active' : ''}`}
              onClick={() => setDraft(d => !d)}
            >✏ Brouillons</button>
            <input
              type="date"
              className="input-field journal-date-input"
              value={dateFrom ? dateFrom.slice(0, 10) : ''}
              onChange={e => setDateFrom(e.target.value ? new Date(e.target.value).toISOString() : '')}
              title="Depuis"
            />
            <input
              type="date"
              className="input-field journal-date-input"
              value={dateTo ? dateTo.slice(0, 10) : ''}
              onChange={e => setDateTo(e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : '')}
              title="Jusqu'au"
            />
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ Réinitialiser</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="reading-loading"><div className="loading-spinner" /></div>
        ) : entries.length === 0 ? (
          <div className="reading-empty">
            <div className="reading-empty-icon">📓</div>
            <p>
              {search || hasFilters
                ? 'Aucune entrée ne correspond à ces filtres.'
                : 'Ton journal est vide. Commence à écrire !'}
            </p>
            {!search && !hasFilters && (
              <button className="btn btn-primary" onClick={handleNew}>+ Première entrée</button>
            )}
          </div>
        ) : (
          <div className="journal-entries-list">
            {entries.map(e => (
              <EntryCard key={e.id} entry={e} onClick={() => navigate(`/journal/${e.id}`)} />
            ))}
          </div>
        )}
      </div>

      {archives.length > 0 && (
        <div className="journal-archives">
          <div className="journal-archives-title">Archives</div>
          {[...new Set(archives.map(a => a.year))].sort((a, b) => b - a).map(year => (
            <div key={year} className="journal-archive-year">
              <div className="journal-archive-year-label">{year}</div>
              {archives.filter(a => a.year === year).map(a => (
                <button
                  key={`${a.year}-${a.month}`}
                  className={`journal-archive-month${activeArchiveYear === a.year && activeArchiveMonth === a.month ? ' journal-archive-month--active' : ''}`}
                  onClick={() => selectArchive(a.year, a.month)}
                >
                  {MONTH_NAMES[a.month - 1]}
                  <span className="journal-archive-count">{a.count}</span>
                </button>
              ))}
            </div>
          ))}
          {(dateFrom || dateTo) && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: '0.5rem', width: '100%' }}
              onClick={clearArchive}
            >
              Tout afficher
            </button>
          )}
        </div>
      )}
    </div>
  )
}
