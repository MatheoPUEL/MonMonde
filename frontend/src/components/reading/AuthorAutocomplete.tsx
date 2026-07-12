import { useState, useEffect, useRef } from 'react'
import { authorsApi, type Author } from '../../api/reading'

interface Props {
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export function AuthorAutocomplete({ value, onChange, required }: Props) {
  const [suggestions, setSuggestions] = useState<Author[]>([])
  const [open, setOpen] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout>>()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value.trim() || value.length < 2) { setSuggestions([]); return }
    clearTimeout(timeout.current)
    timeout.current = setTimeout(async () => {
      try {
        const data = await authorsApi.getAll({ search: value })
        setSuggestions(data.authors.slice(0, 6))
        setOpen(data.authors.length > 0)
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

  function pick(author: Author) {
    onChange(author.name)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={wrapRef} className="author-autocomplete-wrap">
      <input
        className="input-field"
        placeholder="Nom de l'auteur"
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
              <span className="author-suggestion-count">{a.bookCount} livre{(a.bookCount ?? 0) > 1 ? 's' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
