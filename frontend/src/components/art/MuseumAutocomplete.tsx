import { useEffect, useRef, useState } from 'react'
import { museumsApi, MuseumSuggestion } from '../../api/art'
import { IconPin } from '../ui/icons'

interface Props {
  value: string
  selected: MuseumSuggestion | null
  onChange: (value: string, selected: MuseumSuggestion | null) => void
  autoFocus?: boolean
}

/** Museum name input suggesting notable museums from the bundled list. Typing freely is still
 *  allowed: `selected` is null until a suggestion is picked, and reset by any further typing. */
export function MuseumAutocomplete({ value, selected, onChange, autoFocus }: Props) {
  const [suggestions, setSuggestions] = useState<MuseumSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const timeout = useRef<ReturnType<typeof setTimeout>>()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected || value.trim().length < 2) { setSuggestions([]); return }
    clearTimeout(timeout.current)
    timeout.current = setTimeout(async () => {
      try {
        const { suggestions } = await museumsApi.suggest(value)
        setSuggestions(suggestions)
        setActive(0)
      } catch { setSuggestions([]) }
    }, 150)
    return () => clearTimeout(timeout.current)
  }, [value, selected])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function pick(suggestion: MuseumSuggestion) {
    onChange(suggestion.name, suggestion)
    setOpen(false)
    setSuggestions([])
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + suggestions.length) % suggestions.length) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[active]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  const place = (s: MuseumSuggestion) => [s.city, s.country].filter(Boolean).join(', ')

  return (
    <div ref={wrapRef} className="author-autocomplete-wrap">
      <input
        className="input-field"
        placeholder="Musée d'Orsay, Prado, Tate Modern…"
        value={value}
        onChange={e => { onChange(e.target.value, null); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        autoComplete="off"
        required
      />
      {open && suggestions.length > 0 && (
        <ul className="author-suggestions museum-suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.wikidataId}
              role="option"
              aria-selected={i === active}
              className={`author-suggestion-item${i === active ? ' museum-suggestion--active' : ''}`}
              onMouseDown={() => pick(s)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="museum-suggestion-icon"><IconPin size={14} /></span>
              <span className="museum-suggestion-info">
                <span className="museum-suggestion-name">{s.name}</span>
                {place(s) && <span className="museum-suggestion-place">{place(s)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="museum-suggestion-hint">
        {selected
          ? <>Placé automatiquement{place(selected) ? ` · ${place(selected)}` : ''}</>
          : value.trim().length >= 2
            ? 'Pas dans la liste ? Garde ton nom, il sera localisé automatiquement.'
            : 'Commence à taper pour voir les grands musées.'}
      </p>
    </div>
  )
}
