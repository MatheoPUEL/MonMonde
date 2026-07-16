import { useState } from 'react'

interface Props {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export function ChipsField({ label, values, onChange, placeholder }: Props) {
  const [input, setInput] = useState('')

  function add(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      const v = input.trim()
      if (!values.includes(v)) onChange([...values, v])
      setInput('')
    }
  }

  return (
    <div className="tags-input-wrap">
      <label className="input-label">{label}</label>
      <div className="tags-chips">
        {values.map(v => (
          <span key={v} className="tag-chip">
            {v}
            <button type="button" className="tag-chip-remove" onClick={() => onChange(values.filter(x => x !== v))}>×</button>
          </span>
        ))}
      </div>
      <input
        className="input-field"
        placeholder={placeholder ?? 'Ajouter (Entrée pour valider)'}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={add}
      />
    </div>
  )
}
