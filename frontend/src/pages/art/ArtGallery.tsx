import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { artApi, Artwork } from '../../api/art'
import { ArtworkCard } from '../../components/art/ArtworkCard'
import { ArtworkRow } from '../../components/art/ArtworkRow'
import { AddArtworkModal } from './AddArtworkModal'
import { Button } from '../../components/ui/Button'
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'
import { ArtistAutocomplete } from '../../components/art/ArtistAutocomplete'
import { IconSearch, IconGrid, IconList, IconSort, IconArt, IconClose } from '../../components/ui/icons'

type ViewMode = 'grid' | 'list'
type SortKey = 'createdAt' | 'title' | 'year'
type SortDir = 'asc' | 'desc'
const VIEW_KEY = 'art_view'

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'createdAt', label: 'Date d\'ajout' },
  { value: 'title', label: 'Titre A→Z' },
  { value: 'year', label: 'Année de création' },
]

export function ArtGallery() {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFavorites, setShowFavorites] = useState(false)
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'grid')
  const [showAddModal, setShowAddModal] = useState(false)

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedMovements, setSelectedMovements] = useState<string[]>([])
  const [selectedCurrents, setSelectedCurrents] = useState<string[]>([])
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filterArtist, setFilterArtist] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchArtworks = useCallback(async () => {
    try {
      const data = await artApi.getArtworks({
        search: search || undefined,
        favorite: showFavorites || undefined,
      })
      setArtworks(data.artworks)
    } catch {}
  }, [search, showFavorites])

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      await fetchArtworks()
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [fetchArtworks])

  useEffect(() => {
    setSelectedMovements([])
    setSelectedCurrents([])
    setSelectedThemes([])
    setSelectedTags([])
    setFilterArtist('')
  }, [search, showFavorites])

  function setViewMode(v: ViewMode) {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  const allMovements = useMemo(() => Array.from(new Set(artworks.flatMap(a => a.movements))).sort(), [artworks])
  const allCurrents = useMemo(() => Array.from(new Set(artworks.flatMap(a => a.currents))).sort(), [artworks])
  const allThemes = useMemo(() => Array.from(new Set(artworks.flatMap(a => a.themes))).sort(), [artworks])
  const allTags = useMemo(
    () => Array.from(new Set(artworks.flatMap(a => a.tags.map(t => t.name)))).sort(),
    [artworks]
  )

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter(x => x !== value) : [...list, value])
  }

  function resetFilters() {
    setSelectedMovements([])
    setSelectedCurrents([])
    setSelectedThemes([])
    setSelectedTags([])
    setFilterArtist('')
    setSortKey('createdAt')
    setSortDir('desc')
  }

  const activeDataFilterCount = useMemo(
    () => selectedMovements.length + selectedCurrents.length + selectedThemes.length + selectedTags.length + (filterArtist ? 1 : 0),
    [selectedMovements, selectedCurrents, selectedThemes, selectedTags, filterArtist]
  )

  const activeFilterCount = useMemo(() => {
    let count = activeDataFilterCount
    if (sortKey !== 'createdAt' || sortDir !== 'desc') count++
    return count
  }, [activeDataFilterCount, sortKey, sortDir])

  const displayedArtworks = useMemo(() => {
    let result = artworks

    if (selectedMovements.length > 0) {
      result = result.filter(a => selectedMovements.some(m => a.movements.includes(m)))
    }
    if (selectedCurrents.length > 0) {
      result = result.filter(a => selectedCurrents.some(c => a.currents.includes(c)))
    }
    if (selectedThemes.length > 0) {
      result = result.filter(a => selectedThemes.some(t => a.themes.includes(t)))
    }
    if (selectedTags.length > 0) {
      result = result.filter(a => selectedTags.some(t => a.tags.some(at => at.name === t)))
    }
    if (filterArtist) {
      const q = filterArtist.toLowerCase()
      result = result.filter(a => a.artist.name.toLowerCase().includes(q))
    }

    return [...result].sort((a, b) => {
      let valA: string | number
      let valB: string | number
      switch (sortKey) {
        case 'title':
          valA = a.title.toLowerCase()
          valB = b.title.toLowerCase()
          break
        case 'year':
          valA = a.year ?? -Infinity
          valB = b.year ?? -Infinity
          break
        default:
          valA = a.createdAt
          valB = b.createdAt
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [artworks, selectedMovements, selectedCurrents, selectedThemes, selectedTags, filterArtist, sortKey, sortDir])

  return (
    <div className="reading-library">
      <header className="reading-header">
        <div>
          <h1 className="reading-title">Œuvres d'art</h1>
          <p className="reading-count">{displayedArtworks.length} œuvre{displayedArtworks.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ImportExportButtons module="art" onImportDone={fetchArtworks} />
          <Link to="/art/artists" className="btn btn-ghost" style={{ width: 'auto' }}>
            Artistes
          </Link>
          <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
            + Ajouter une œuvre
          </Button>
        </div>
      </header>

      <div className="reading-toolbar">
        <div className="reading-search-box">
          <IconSearch size={15} />
          <input
            className="reading-search-input"
            placeholder="Titre, artiste, musée..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="reading-view-toggle">
          <button className={`view-btn ${view === 'grid' ? 'view-btn--active' : ''}`} onClick={() => setViewMode('grid')} aria-label="Grille"><IconGrid size={15} /></button>
          <button className={`view-btn ${view === 'list' ? 'view-btn--active' : ''}`} onClick={() => setViewMode('list')} aria-label="Liste"><IconList size={15} /></button>
        </div>
        <div className="filters-btn-wrap">
          <button
            className={`btn btn-ghost ${filtersOpen ? 'view-btn--active' : ''}`}
            style={{ width: 'auto' }}
            onClick={() => setFiltersOpen(o => !o)}
            aria-expanded={filtersOpen}
          >
            <IconSort size={13} /> Filtres
          </button>
          {activeFilterCount > 0 && (
            <span className="filters-badge">{activeFilterCount}</span>
          )}
        </div>
      </div>

      <div className={`filters-panel${filtersOpen ? ' filters-panel--open' : ''}`}>
        <div className="filters-panel-inner">
          {allMovements.length > 0 && (
            <div className="filters-panel-row">
              <span className="filters-panel-label">Mouvement</span>
              <div className="filters-panel-chips">
                {allMovements.map(m => (
                  <button key={m} className={`filter-chip ${selectedMovements.includes(m) ? 'filter-chip--active' : ''}`} onClick={() => toggle(selectedMovements, setSelectedMovements, m)}>{m}</button>
                ))}
              </div>
            </div>
          )}

          {allCurrents.length > 0 && (
            <div className="filters-panel-row">
              <span className="filters-panel-label">Courant</span>
              <div className="filters-panel-chips">
                {allCurrents.map(c => (
                  <button key={c} className={`filter-chip ${selectedCurrents.includes(c) ? 'filter-chip--active' : ''}`} onClick={() => toggle(selectedCurrents, setSelectedCurrents, c)}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {allThemes.length > 0 && (
            <div className="filters-panel-row">
              <span className="filters-panel-label">Thème</span>
              <div className="filters-panel-chips">
                {allThemes.map(t => (
                  <button key={t} className={`filter-chip ${selectedThemes.includes(t) ? 'filter-chip--active' : ''}`} onClick={() => toggle(selectedThemes, setSelectedThemes, t)}>{t}</button>
                ))}
              </div>
            </div>
          )}

          {allTags.length > 0 && (
            <div className="filters-panel-row">
              <span className="filters-panel-label">Tag</span>
              <div className="filters-panel-chips">
                {allTags.map(t => (
                  <button key={t} className={`filter-chip ${selectedTags.includes(t) ? 'filter-chip--active' : ''}`} onClick={() => toggle(selectedTags, setSelectedTags, t)}>{t}</button>
                ))}
              </div>
            </div>
          )}

          <div className="filters-panel-row">
            <span className="filters-panel-label">Artiste</span>
            <div className="filters-panel-author">
              <ArtistAutocomplete value={filterArtist} onChange={setFilterArtist} />
            </div>
          </div>

          <div className="filters-panel-row">
            <span className="filters-panel-label">Trier</span>
            <div className="filters-panel-sort">
              <select className="status-select" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select className="status-select" value={sortDir} onChange={e => setSortDir(e.target.value as SortDir)}>
                <option value="desc">Décroissant</option>
                <option value="asc">Croissant</option>
              </select>
              {activeFilterCount > 0 && (
                <button className="filters-reset-btn" onClick={resetFilters}>
                  <IconClose size={11} /> Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="reading-filters">
        <button
          className={`filter-chip ${showFavorites ? 'filter-chip--active' : ''}`}
          onClick={() => setShowFavorites(v => !v)}
        >
          ★ Favoris
        </button>
      </div>

      {loading ? (
        <div className="reading-loading"><div className="loading-spinner" /></div>
      ) : displayedArtworks.length === 0 ? (
        <div className="reading-empty">
          <div className="reading-empty-icon"><IconArt size={40} /></div>
          <p>{search || activeDataFilterCount > 0 ? 'Aucune œuvre trouvée.' : 'Ta collection est vide.'}</p>
          {!search && activeDataFilterCount === 0 && (
            <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
              Ajouter ma première œuvre
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="books-grid">
          {displayedArtworks.map(a => <ArtworkCard key={a.id} artwork={a} />)}
        </div>
      ) : (
        <div className="books-list">
          {displayedArtworks.map(a => <ArtworkRow key={a.id} artwork={a} />)}
        </div>
      )}

      {showAddModal && (
        <AddArtworkModal
          onClose={() => setShowAddModal(false)}
          onAdded={artwork => { setArtworks(prev => [artwork, ...prev]); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}
