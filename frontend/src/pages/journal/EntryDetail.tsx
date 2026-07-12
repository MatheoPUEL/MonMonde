import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { journalApi, JournalEntry, Mood } from '../../api/journal'
import { RichEditor } from '../../components/ui/RichEditor'
import { MoodPicker } from '../../components/journal/MoodPicker'
import { ConfirmModal } from '../../components/ui/ConfirmModal'

export function EntryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [tagInput, setTagInput] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setFocusMode(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!id) return
    journalApi.getEntry(id)
      .then(d => setEntry(d.entry))
      .catch(() => navigate('/journal'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  function scheduleSave(updates: Partial<Parameters<typeof journalApi.updateEntry>[1]>) {
    setSaveStatus('unsaved')
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      if (!entry) return
      setSaveStatus('saving')
      try {
        const saved = await journalApi.updateEntry(entry.id, updates)
        setEntry(prev => prev ? {
          ...prev,
          updatedAt: saved.entry.updatedAt,
          tags: saved.entry.tags,
          mood: saved.entry.mood,
          favorite: saved.entry.favorite,
          pinned: saved.entry.pinned,
          draft: saved.entry.draft,
        } : prev)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    }, 1000)
  }

  function handleTitle(title: string) {
    setEntry(prev => prev ? { ...prev, title } : prev)
    scheduleSave({ title })
  }

  function handleContent(json: string) {
    setEntry(prev => prev ? { ...prev, content: json } : prev)
    scheduleSave({ content: json })
  }

  function handleMood(mood: Mood | null) {
    setEntry(prev => prev ? { ...prev, mood } : prev)
    scheduleSave({ mood })
  }

  function handleToggle(field: 'favorite' | 'pinned' | 'draft', value: boolean) {
    setEntry(prev => prev ? { ...prev, [field]: value } : prev)
    scheduleSave({ [field]: value })
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim() && entry) {
      e.preventDefault()
      const name = tagInput.trim().toLowerCase()
      if (!entry.tags.find(t => t.name === name)) {
        const newTagNames = [...entry.tags.map(t => t.name), name]
        setEntry(prev => prev
          ? { ...prev, tags: [...prev.tags, { id: `temp-${name}`, name, entryId: entry.id }] }
          : prev
        )
        scheduleSave({ tags: newTagNames })
      }
      setTagInput('')
    }
  }

  function handleTagRemove(name: string) {
    if (!entry) return
    const newTagNames = entry.tags.filter(t => t.name !== name).map(t => t.name)
    setEntry(prev => prev ? { ...prev, tags: prev.tags.filter(t => t.name !== name) } : prev)
    scheduleSave({ tags: newTagNames })
  }

  function handleDelete() {
    if (!entry) return
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!entry) return
    try { await journalApi.deleteEntry(entry.id); navigate('/journal') } catch {}
  }

  if (loading) return <div className="reading-loading"><div className="loading-spinner" /></div>
  if (!entry) return null

  const dateStr = new Date(entry.createdAt).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className={`entry-detail${focusMode ? ' entry-detail--focus' : ''}`}>
      <div className="entry-detail-topbar">
        {focusMode
          ? <button className="book-detail-back" onClick={() => setFocusMode(false)}>✕ Quitter le focus</button>
          : <button className="book-detail-back" onClick={() => navigate('/journal')}>← Journal</button>
        }
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`save-indicator save-indicator--${saveStatus}`}>
            {saveStatus === 'saving' ? 'Enregistrement…' : saveStatus === 'unsaved' ? '●' : 'Enregistré'}
          </span>
          {!focusMode && (
            <button className="focus-mode-btn" onClick={() => setFocusMode(true)} title="Mode focus (plein écran)">
              ⛶
            </button>
          )}
        </div>
      </div>

      <div className="entry-detail-layout">
        <div className="entry-detail-content">
          <input
            className="entry-title-input"
            placeholder="Titre de l'entrée"
            value={entry.title}
            onChange={e => handleTitle(e.target.value)}
          />
          <div className="entry-date-line">{dateStr}</div>
          <RichEditor
            content={entry.content}
            onChange={handleContent}
            placeholder="Commence à écrire…"
          />
        </div>

        <div className="entry-detail-sidebar">
          <div className="entry-sidebar-section">
            <div className="input-label">Humeur</div>
            <MoodPicker value={entry.mood} onChange={handleMood} />
          </div>

          <div className="entry-sidebar-section">
            <div className="input-label">Tags</div>
            <div className="tags-chips">
              {entry.tags.map(t => (
                <span key={t.id} className="chip chip--removable">
                  {t.name}
                  <button type="button" onClick={() => handleTagRemove(t.name)}>×</button>
                </span>
              ))}
            </div>
            <input
              className="input-field"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              placeholder="Ajouter un tag (Entrée)…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
          </div>

          <div className="entry-sidebar-section">
            <div className="input-label">Options</div>
            <label className="owned-toggle">
              <input
                type="checkbox"
                checked={entry.favorite}
                onChange={e => handleToggle('favorite', e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              ★ Favori
            </label>
            <label className="owned-toggle">
              <input
                type="checkbox"
                checked={entry.pinned}
                onChange={e => handleToggle('pinned', e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              📌 Épinglée
            </label>
            <label className="owned-toggle">
              <input
                type="checkbox"
                checked={entry.draft}
                onChange={e => handleToggle('draft', e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              ✏ Brouillon
            </label>
          </div>

          <div className="entry-sidebar-section entry-sidebar-meta">
            <div className="input-label">Infos</div>
            <div className="entry-meta-line">
              Créée le {new Date(entry.createdAt).toLocaleDateString('fr-FR')}
            </div>
            <div className="entry-meta-line">
              Modifiée le {new Date(entry.updatedAt).toLocaleDateString('fr-FR')}
            </div>
          </div>

          <button
            className="btn-side"
            style={{ color: '#C44B4B', marginTop: '0.5rem' }}
            onClick={handleDelete}
          >
            🗑 Supprimer
          </button>
        </div>
      </div>
      {showDeleteConfirm && entry && (
        <ConfirmModal
          title="Supprimer cette entrée"
          message={`Supprimer "${entry.title || 'cette entrée'}" définitivement ? Cette action est irréversible.`}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
