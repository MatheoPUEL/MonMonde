import { useState, useEffect, useRef } from 'react'
import { artistsApi, type Artist } from '../../api/art'

interface Props {
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export function ArtistAutocomplete({ value, onChange, required }: Props) {
  const [suggestions, setSuggestions] = useState<Artist[]>([])
  const [open, setOpen] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout>>()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value.trim() || value.length < 2) { setSuggestions([]); return }
    clearTimeout(timeout.current)
    timeout.current = setTimeout(async () => {
      try {
        const data = await artistsApi.getAll({ search: value })
        setSuggestions(data.artists.slice(0, 6))
        setOpen(data.artists.length > 0)
      } catch { setSuggestions([]) }
    }, 250)
    return () => clearTimeout(timeout.current)
  }, [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function pick(artist: Artist) {
    onChange(artist.name)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={wrapRef} className="author-autocomplete-wrap">
      <input
        className="input-field"
        placeholder="Nom de l'artiste"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        required={required}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="author-suggestions">
          {suggestions.map(a => (
            <li key={a.id} className="author-suggestion-item" onMouseDown={() => pick(a)}>
              {a.photoUrl
                ? <img src={a.photoUrl} className="author-suggestion-photo" alt={a.name} />
                : <span className="author-suggestion-avatar">{a.name[0]}</span>
              }
              <span className="author-suggestion-name">{a.name}</span>
              <span className="author-suggestion-count">{a.artworkCount} œuvre{(a.artworkCount ?? 0) > 1 ? 's' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
