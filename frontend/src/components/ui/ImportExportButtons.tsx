// frontend/src/components/ui/ImportExportButtons.tsx
import { useRef, useState } from 'react'
import { exportModule } from '../../api/export'
import { ImportableModule } from '../../api/import'
import { ImportResultModal } from './ImportResultModal'
import { IconDownload, IconUpload } from './icons'

interface Props {
  module: ImportableModule
  onImportDone?: () => void
}

export function ImportExportButtons({ module, onImportDone }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importData, setImportData] = useState<Record<string, unknown> | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  async function handleExport() {
    setExportLoading(true)
    try {
      await exportModule(module)
    } catch {
      // silently ignore
    } finally {
      setExportLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null)
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<string, unknown>
        setImportData(data)
      } catch {
        setParseError('Fichier JSON invalide')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <>
      <div className="io-buttons">
        <button
          className="btn btn-ghost btn-icon"
          onClick={handleExport}
          disabled={exportLoading}
          title="Exporter"
          aria-label="Exporter"
        >
          {exportLoading ? <div className="loading-spinner loading-spinner--sm" /> : <IconDownload size={14} />}
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => fileInputRef.current?.click()}
          title="Importer"
          aria-label="Importer"
        >
          <IconUpload size={14} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {parseError && (
        <div className="io-parse-error">{parseError}</div>
      )}

      {importData && (
        <ImportResultModal
          module={module}
          data={importData}
          onClose={() => setImportData(null)}
          onDone={() => onImportDone?.()}
        />
      )}
    </>
  )
}
