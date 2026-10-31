import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { museumsApi, Museum, MuseumDetail, MuseumStatus } from '../../api/art'
import { MuseumMapCanvas } from '../../components/art/MuseumMapCanvas'
import { MuseumPanel } from '../../components/art/MuseumPanel'
import { MUSEUM_FILTER_LABELS, MUSEUM_STATUS_ORDER } from '../../components/art/museumStatus'
import { AddMuseumModal } from './AddMuseumModal'
import { Button } from '../../components/ui/Button'
import { IconChevronLeft, IconPin } from '../../components/ui/icons'

function summary(detail: MuseumDetail): Museum {
  const { visits: _visits, artworks: _artworks, ...museum } = detail
  return museum
}

export function MuseumMap() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [museums, setMuseums] = useState<Museum[]>([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState<MuseumStatus[]>([])
  const [selected, setSelected] = useState<MuseumDetail | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const selectedId = searchParams.get('museum')

  const fetchMuseums = useCallback(async () => {
    try {
      const data = await museumsApi.getAll()
      setMuseums(data.museums)
      setPending(data.pending)
    } catch {
      setPending(0)
    }
  }, [])

  useEffect(() => {
    fetchMuseums().finally(() => setLoading(false))
  }, [fetchMuseums])

  // The server places a few museums per request; keep asking until all are on the map
  useEffect(() => {
    if (pending > 0) fetchMuseums()
  }, [pending, museums, fetchMuseums])

  // Artwork pages link here by museum name (?name=…), since artworks only store the name
  const linkedName = searchParams.get('name')
  useEffect(() => {
    if (!linkedName || loading) return
    const match = museums.find(m => m.name === linkedName)
    setSearchParams(match ? { museum: match.id } : {}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedName, loading])

  useEffect(() => {
    if (!selectedId) { setSelected(null); return }
    if (selected?.id === selectedId) return
    museumsApi.getOne(selectedId)
      .then(d => setSelected(d.museum))
      .catch(() => setSearchParams({}, { replace: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function select(id: string | null) {
    setSearchParams(id ? { museum: id } : {})
  }

  function handleChanged(updated: MuseumDetail) {
    setSelected(updated)
    setMuseums(prev => prev.map(m => (m.id === updated.id ? summary(updated) : m)))
  }

  function handleAdded(added: MuseumDetail) {
    setShowAddModal(false)
    setMuseums(prev => [...prev.filter(m => m.id !== added.id), summary(added)].sort((a, b) => a.name.localeCompare(b.name)))
    setSelected(added)
    select(added.id)
  }

  function handleDeleted(id: string) {
    setMuseums(prev => prev.filter(m => m.id !== id))
    select(null)
  }

  const counts = useMemo(() => {
    const c: Record<MuseumStatus, number> = { visited: 0, wishlist: 0, artworks: 0 }
    for (const m of museums) c[m.status]++
    return c
  }, [museums])

  const visible = useMemo(
    () => museums.filter(m => !hidden.includes(m.status) || m.id === selectedId),
    [museums, hidden, selectedId]
  )

  const listed = useMemo(
    () => [...visible].sort((a, b) =>
      MUSEUM_STATUS_ORDER.indexOf(a.status) - MUSEUM_STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name)
    ),
    [visible]
  )

  function toggleStatus(status: MuseumStatus) {
    setHidden(h => (h.includes(status) ? h.filter(s => s !== status) : [...h, status]))
  }

  return (
    <div className="reading-library museum-map-page">
      <header className="reading-header">
        <div>
          <Link to="/art" className="museum-map-back"><IconChevronLeft size={13} /> Œuvres d'art</Link>
          <h1 className="reading-title">Carte des musées</h1>
          <p className="reading-count">
            {museums.length} musée{museums.length !== 1 ? 's' : ''}
            {counts.visited > 0 && ` · ${counts.visited} visité${counts.visited !== 1 ? 's' : ''}`}
            {pending > 0 && ` · localisation de ${pending} musée${pending !== 1 ? 's' : ''}…`}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
          + Ajouter un musée
        </Button>
      </header>

      <div className="reading-filters">
        {MUSEUM_STATUS_ORDER.map(status => (
          <button
            key={status}
            className={`filter-chip museum-filter museum-filter--${status} ${hidden.includes(status) ? '' : 'filter-chip--active'}`}
            onClick={() => toggleStatus(status)}
            aria-pressed={!hidden.includes(status)}
          >
            <span className="museum-dot" /> {MUSEUM_FILTER_LABELS[status]} <span className="museum-filter-count">{counts[status]}</span>
          </button>
        ))}
      </div>

      <div className="museum-map-layout">
        <div className="museum-map-frame glass-card">
          <MuseumMapCanvas museums={visible} selectedId={selectedId} onSelect={select} />
          {loading && <div className="museum-map-loading"><div className="loading-spinner" /></div>}
        </div>

        <aside className="museum-map-side glass-card">
          {selected ? (
            <MuseumPanel
              key={selected.id}
              museum={selected}
              onBack={() => select(null)}
              onChanged={handleChanged}
              onDeleted={handleDeleted}
            />
          ) : !loading && museums.length === 0 ? (
            <div className="museum-map-empty">
              <IconPin size={28} />
              <p>Aucun musée pour l'instant.</p>
              <p className="museum-map-empty-hint">
                Les musées de tes œuvres apparaissent ici automatiquement. Tu peux aussi ajouter ceux que tu as visités ou que tu veux voir.
              </p>
            </div>
          ) : (
            <ul className="museum-list">
              {listed.map(m => (
                <li key={m.id}>
                  <button className={`museum-list-item museum-filter--${m.status}`} onClick={() => select(m.id)}>
                    <span className="museum-dot" />
                    <span className="museum-list-info">
                      <span className="museum-list-name">{m.name}</span>
                      <span className="museum-list-meta">
                        {m.latitude == null ? 'Non localisé' : [m.city, m.country].filter(Boolean).join(', ')}
                      </span>
                    </span>
                    <span className="museum-list-counts">
                      {m.artworkCount > 0 && <span>{m.artworkCount} œuvre{m.artworkCount !== 1 ? 's' : ''}</span>}
                      {m.visitCount > 0 && <span>{m.visitCount} visite{m.visitCount !== 1 ? 's' : ''}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {showAddModal && <AddMuseumModal onClose={() => setShowAddModal(false)} onAdded={handleAdded} />}
    </div>
  )
}
