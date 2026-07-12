// frontend/src/components/ui/ImportResultModal.tsx
import { useState } from 'react'
import { importModule, countItems, ImportResult, ImportableModule } from '../../api/import'

interface Props {
  module: ImportableModule
  data: Record<string, unknown>
  onClose: () => void
  onDone: () => void
}

export function ImportResultModal({ module, data, onClose, onDone }: Props) {
  const [state, setState] = useState<'confirm' | 'loading' | 'done' | 'error'>('confirm')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const itemCount = countItems(module, data)

  async function handleConfirm() {
    setState('loading')
    try {
      const r = await importModule(module, data)
      setResult(r)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setState('error')
    }
  }

  function handleDone() {
    onDone()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={state === 'confirm' || state === 'error' ? onClose : undefined}>
      <div className="modal-box glass-card" onClick={e => e.stopPropagation()}>
        {state === 'confirm' && (
          <>
            <h3 className="modal-title">Importer les données</h3>
            <p className="modal-body">
              {itemCount} élément{itemCount !== 1 ? 's' : ''} trouvé{itemCount !== 1 ? 's' : ''} dans ce fichier.
              <br />
              Les doublons seront ignorés.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" onClick={handleConfirm}>Importer</button>
            </div>
          </>
        )}

        {state === 'loading' && (
          <div className="modal-loading">
            <div className="loading-spinner" />
            <p>Import en cours…</p>
          </div>
        )}

        {state === 'done' && result && (
          <>
            <h3 className="modal-title">Import terminé</h3>
            <p className="modal-body">
              <strong>{result.imported}</strong> élément{result.imported !== 1 ? 's' : ''} ajouté{result.imported !== 1 ? 's' : ''}
              {result.skipped > 0 && `, ${result.skipped} ignoré${result.skipped !== 1 ? 's' : ''} (doublons)`}
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleDone}>Fermer</button>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <h3 className="modal-title">Erreur</h3>
            <p className="modal-body modal-error">{error}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
