import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { searchApi, type GlobalSearchResults, type SearchResultItem } from '../../api/search'
import { IconSearch, IconReading, IconCitations, IconArt, IconJournal, IconRoutines, IconPerson } from '../ui/icons'

interface Props {
  onClose: () => void
}

type GroupKey = keyof GlobalSearchResults

const GROUP_CONFIG: { key: GroupKey; label: string; icon: typeof IconSearch; route: (id: string) => string }[] = [
  { key: 'books', label: 'Livres', icon: IconReading, route: id => `/reading/${id}` },
  { key: 'authors', label: 'Auteurs', icon: IconPerson, route: id => `/reading/authors/${id}` },
  { key: 'citations', label: 'Citations', icon: IconCitations, route: id => `/citations/${id}` },
  { key: 'artworks', label: "Œuvres d'art", icon: IconArt, route: id => `/art/${id}` },
  { key: 'artists', label: 'Artistes', icon: IconPerson, route: id => `/art/artists/${id}` },
  { key: 'entries', label: 'Journal', icon: IconJournal, route: id => `/journal/${id}` },
  { key: 'routines', label: 'Habitudes', icon: IconRoutines, route: id => `/routines/${id}` },
]

export function SearchModal({ onClose }: Props) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<GlobalSearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    searchApi.search(debouncedQuery)
      .then(d => setResults(d.results))
      .catch(() => setResults(null))
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  const flatList = useMemo(() => {
    if (!results) return []
    const list: { groupKey: GroupKey; item: SearchResultItem; route: string }[] = []
    for (const group of GROUP_CONFIG) {
      for (const item of results[group.key]) {
        list.push({ groupKey: group.key, item, route: group.route(item.id) })
      }
    }
    return list
  }, [results])

  useEffect(() => {
    setActiveIndex(0)
  }, [results])

  const hasAnyResult = flatList.length > 0

  function goTo(route: string) {
    navigate(route)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (!flatList.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i + 1) % flatList.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i - 1 + flatList.length) % flatList.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const active = flatList[activeIndex]
      if (active) goTo(active.route)
    }
  }

  let flatIndex = -1

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="search-modal-box glass-card" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrap">
          <IconSearch size={17} />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Rechercher dans tout Mon Monde…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>

        <div className="search-results">
          {query.trim().length < 2 ? (
            <div className="search-empty-state">Tape au moins 2 caractères pour rechercher.</div>
          ) : loading ? (
            <div className="widget-loading-center"><div className="loading-spinner" /></div>
          ) : !hasAnyResult ? (
            <div className="search-empty-state">Aucun résultat pour «&nbsp;{query}&nbsp;».</div>
          ) : (
            GROUP_CONFIG.map(group => {
              const items = results![group.key]
              if (items.length === 0) return null
              return (
                <div key={group.key} className="search-group">
                  <span className="search-group-label">{group.label}</span>
                  {items.map(item => {
                    flatIndex += 1
                    const idx = flatIndex
                    const route = group.route(item.id)
                    return (
                      <button
                        key={item.id}
                        className={`search-result-row${idx === activeIndex ? ' search-result-row--active' : ''}`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => goTo(route)}
                      >
                        {item.coverUrl
                          ? <img src={item.coverUrl} alt="" className="search-result-cover" />
                          : <span className="search-result-icon"><group.icon size={15} /></span>
                        }
                        <span className="search-result-info">
                          <span className="search-result-title">{item.title}</span>
                          {item.subtitle && <span className="search-result-subtitle">{item.subtitle}</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
