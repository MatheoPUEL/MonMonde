import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { citationsApi, Citation } from '../../api/citations'
import { IconCitations, SOURCE_TYPE_ICONS } from '../ui/icons'

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

export function WidgetCitation() {
  const [citation, setCitation] = useState<Citation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    citationsApi.getAll({ favorite: true })
      .then(d => {
        if (d.citations.length > 0) return d.citations
        return citationsApi.getAll().then(d2 => d2.citations)
      })
      .then(list => setCitation(pickRandom(list)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const SourceIcon = citation ? SOURCE_TYPE_ICONS[citation.sourceType] : null

  return (
    <div className="dashboard-widget widget-citation">
      <span className="dashboard-widget-title"><IconCitations size={14} />Citation du jour</span>
      {loading ? (
        <div className="widget-loading-center">
          <div className="loading-spinner" />
        </div>
      ) : citation ? (
        <>
          <Link to={`/citations/${citation.id}`} className="widget-citation-link">
            <blockquote className="widget-citation-text">
              <p>{citation.text}</p>
            </blockquote>
            <footer className="widget-citation-footer">
              <span className="widget-citation-author">
                {citation.author ?? citation.source ?? 'Inconnu'}
              </span>
              <span className="widget-citation-source">
                {SourceIcon && <SourceIcon size={14} />}
              </span>
            </footer>
          </Link>
          <Link to="/citations" className="dashboard-widget-link">
            Voir les citations →
          </Link>
        </>
      ) : (
        <div className="widget-empty">
          <span>Aucune citation enregistrée</span>
          <Link to="/citations" className="btn btn-ghost" style={{ width: 'auto' }}>
            Ajouter
          </Link>
        </div>
      )}
    </div>
  )
}
