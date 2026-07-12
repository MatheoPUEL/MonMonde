import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { readingApi, Book, ReadingStatus } from '../../api/reading'
import { BookCard } from '../../components/reading/BookCard'
import { BookRow } from '../../components/reading/BookRow'
import { AddBookModal } from './AddBookModal'
import { Button } from '../../components/ui/Button'
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'
import { AuthorAutocomplete } from '../../components/reading/AuthorAutocomplete'

type ViewMode = 'grid' | 'list'
type SortKey = 'createdAt' | 'title' | 'rating' | 'finishedAt'
type SortDir = 'asc' | 'desc'
const VIEW_KEY = 'reading_view'

const STATUS_FILTERS: Array<{ value: ReadingStatus | ''; label: string }> = [
  { value: '', label: 'Tous' },
  { value: 'WISHLIST', label: 'Souhaits' },
  { value: 'TO_READ', label: 'À lire' },
  { value: 'READING', label: 'En cours' },
  { value: 'FINISHED', label: 'Terminé' },
  { value: 'ABANDONED', label: 'Abandonné' },
]

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'createdAt', label: 'Date d\'ajout' },
  { value: 'title', label: 'Titre A→Z' },
  { value: 'rating', label: 'Note' },
  { value: 'finishedAt', label: 'Date de lecture' },
]

export function BookLibrary() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ReadingStatus | ''>('')
  const [showFavorites, setShowFavorites] = useState(false)
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'grid')
  const [showAddModal, setShowAddModal] = useState(false)

  // Filtres avancés
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filterAuthor, setFilterAuthor] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchBooks = useCallback(async () => {
    try {
      const data = await readingApi.getBooks({
        status: status || undefined,
        search: search || undefined,
        favorite: showFavorites || undefined,
      })
      setBooks(data.books)
    } catch {}
  }, [status, search, showFavorites])

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      await fetchBooks()
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [fetchBooks])

  useEffect(() => {
    setSelectedGenres([])
    setSelectedTags([])
    setFilterAuthor('')
  }, [status, search, showFavorites])

  function setViewMode(v: ViewMode) {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  // Options de genre/tag extraites des livres chargés
  const allGenres = useMemo(
    () => Array.from(new Set(books.flatMap(b => b.genres))).sort(),
    [books]
  )
  const allTags = useMemo(
    () => Array.from(new Set(books.flatMap(b => b.tags.map(t => t.name)))).sort(),
    [books]
  )

  function toggleGenre(g: string) {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  function toggleTag(t: string) {
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function resetFilters() {
    setSelectedGenres([])
    setSelectedTags([])
    setFilterAuthor('')
    setSortKey('createdAt')
    setSortDir('desc')
  }

  const activeDataFilterCount = useMemo(
    () => selectedGenres.length + selectedTags.length + (filterAuthor ? 1 : 0),
    [selectedGenres, selectedTags, filterAuthor]
  )

  const activeFilterCount = useMemo(() => {
    let count = activeDataFilterCount
    if (sortKey !== 'createdAt' || sortDir !== 'desc') count++
    return count
  }, [activeDataFilterCount, sortKey, sortDir])

  // Application des filtres et tri côté client
  const displayedBooks = useMemo(() => {
    let result = books

    if (selectedGenres.length > 0) {
      result = result.filter(b => selectedGenres.some(g => b.genres.includes(g)))
    }
    if (selectedTags.length > 0) {
      result = result.filter(b => selectedTags.some(t => b.tags.some(bt => bt.name === t)))
    }
    if (filterAuthor) {
      const q = filterAuthor.toLowerCase()
      result = result.filter(b => b.author.name.toLowerCase().includes(q))
    }

    return [...result].sort((a, b) => {
      let valA: string | number
      let valB: string | number
      switch (sortKey) {
        case 'title':
          valA = a.title.toLowerCase()
          valB = b.title.toLowerCase()
          break
        case 'rating':
          valA = a.rating ?? -1
          valB = b.rating ?? -1
          break
        case 'finishedAt':
          valA = a.finishedAt ?? ''
          valB = b.finishedAt ?? ''
          break
        default:
          valA = a.createdAt
          valB = b.createdAt
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [books, selectedGenres, selectedTags, filterAuthor, sortKey, sortDir])

  return (
    <div className="reading-library">
      <header className="reading-header">
        <div>
          <h1 className="reading-title">Lectures</h1>
          <p className="reading-count">{displayedBooks.length} livre{displayedBooks.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ImportExportButtons module="reading" onImportDone={fetchBooks} />
          <Link to="/reading/authors" className="btn btn-ghost" style={{ width: 'auto', padding: '0.65rem 1.25rem' }}>
            Auteurs
          </Link>
          <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
            + Ajouter un livre
          </Button>
        </div>
      </header>

      <div className="reading-toolbar">
        <input
          className="input-field reading-search"
          placeholder="Titre, auteur, ISBN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="reading-view-toggle">
          <button className={`view-btn ${view === 'grid' ? 'view-btn--active' : ''}`} onClick={() => setViewMode('grid')} aria-label="Grille">⊞</button>
          <button className={`view-btn ${view === 'list' ? 'view-btn--active' : ''}`} onClick={() => setViewMode('list')} aria-label="Liste">≡</button>
        </div>
        <div className="filters-btn-wrap">
          <button
            className={`btn btn-ghost ${filtersOpen ? 'view-btn--active' : ''}`}
            style={{ width: 'auto', padding: '0.5rem 0.875rem', fontSize: '0.85rem' }}
            onClick={() => setFiltersOpen(o => !o)}
            aria-expanded={filtersOpen}
          >
            ⊕ Filtres
          </button>
          {activeFilterCount > 0 && (
            <span className="filters-badge">{activeFilterCount}</span>
          )}
        </div>
      </div>

      {/* Panel filtres avancés */}
      <div className={`filters-panel${filtersOpen ? ' filters-panel--open' : ''}`}>
        <div className="filters-panel-inner">
          {allGenres.length > 0 && (
            <div className="filters-panel-row">
              <span className="filters-panel-label">Genre</span>
              <div className="filters-panel-chips">
                {allGenres.map(g => (
                  <button
                    key={g}
                    className={`filter-chip ${selectedGenres.includes(g) ? 'filter-chip--active' : ''}`}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allTags.length > 0 && (
            <div className="filters-panel-row">
              <span className="filters-panel-label">Tag</span>
              <div className="filters-panel-chips">
                {allTags.map(t => (
                  <button
                    key={t}
                    className={`filter-chip ${selectedTags.includes(t) ? 'filter-chip--active' : ''}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filters-panel-row">
            <span className="filters-panel-label">Auteur</span>
            <div className="filters-panel-author">
              <AuthorAutocomplete
                value={filterAuthor}
                onChange={setFilterAuthor}
              />
            </div>
          </div>

          <div className="filters-panel-row">
            <span className="filters-panel-label">Trier</span>
            <div className="filters-panel-sort">
              <select
                className="status-select"
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                className="status-select"
                value={sortDir}
                onChange={e => setSortDir(e.target.value as SortDir)}
              >
                <option value="desc">Décroissant</option>
                <option value="asc">Croissant</option>
              </select>
              {activeFilterCount > 0 && (
                <button className="filters-reset-btn" onClick={resetFilters}>
                  ✕ Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="reading-filters">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-chip ${status === f.value ? 'filter-chip--active' : ''}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
        <button
          className={`filter-chip ${showFavorites ? 'filter-chip--active' : ''}`}
          onClick={() => setShowFavorites(v => !v)}
        >
          ★ Favoris
        </button>
      </div>

      {loading ? (
        <div className="reading-loading"><div className="loading-spinner" /></div>
      ) : displayedBooks.length === 0 ? (
        <div className="reading-empty">
          <div className="reading-empty-icon">📚</div>
          <p>{search || status || activeDataFilterCount > 0 ? 'Aucun livre trouvé.' : 'Ta bibliothèque est vide.'}</p>
          {!search && !status && activeDataFilterCount === 0 && (
            <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
              Ajouter mon premier livre
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="books-grid">
          {displayedBooks.map(b => <BookCard key={b.id} book={b} />)}
        </div>
      ) : (
        <div className="books-list">
          {displayedBooks.map(b => <BookRow key={b.id} book={b} />)}
        </div>
      )}

      {showAddModal && (
        <AddBookModal
          onClose={() => setShowAddModal(false)}
          onAdded={book => { setBooks(prev => [book, ...prev]); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}
