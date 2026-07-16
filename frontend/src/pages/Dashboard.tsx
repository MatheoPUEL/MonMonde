import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { exportModule } from '../api/export'
import { WidgetLecture } from '../components/dashboard/WidgetLecture'
import { WidgetJournal } from '../components/dashboard/WidgetJournal'
import { WidgetAujourdhui } from '../components/dashboard/WidgetAujourdhui'
import { WidgetCitation } from '../components/dashboard/WidgetCitation'
import { WidgetOeuvre } from '../components/dashboard/WidgetOeuvre'
import { IconDownload } from '../components/ui/icons'

export function Dashboard() {
  const { user } = useAuth()

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  const firstName = user?.name.split(' ')[0] ?? ''
  const [exporting, setExporting] = useState(false)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-greeting">Bonjour, {firstName}</h1>
          <p className="dashboard-date">{capitalizedDate}</p>
        </div>
        <button
          className="btn btn-ghost"
          style={{ width: 'auto' }}
          disabled={exporting}
          onClick={async () => {
            setExporting(true)
            try { await exportModule('all') } catch {} finally { setExporting(false) }
          }}
        >
          {exporting ? '…' : <IconDownload size={14} />} Exporter tout
        </button>
      </header>
      <div className="dashboard-bento">
        <WidgetLecture />
        <WidgetOeuvre />
        <WidgetCitation />
        <WidgetJournal />
        <WidgetAujourdhui />
      </div>
    </div>
  )
}
