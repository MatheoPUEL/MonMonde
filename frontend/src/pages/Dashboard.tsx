import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { exportModule } from '../api/export'
import { WidgetLecture } from '../components/dashboard/WidgetLecture'
import { WidgetJournal } from '../components/dashboard/WidgetJournal'
import { WidgetAujourdhui } from '../components/dashboard/WidgetAujourdhui'
import { WidgetCitation } from '../components/dashboard/WidgetCitation'

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
        <h1 className="dashboard-greeting">Bonjour, {firstName} 👋</h1>
        <p className="dashboard-date">{capitalizedDate}</p>
      </header>
      <div className="dashboard-bento">
        <WidgetLecture />
        <WidgetJournal />
        <WidgetAujourdhui />
        <WidgetCitation />
      </div>
      <div className="dashboard-export">
        <button
          className="btn btn-ghost"
          style={{ width: 'auto' }}
          disabled={exporting}
          onClick={async () => {
            setExporting(true)
            try { await exportModule('all') } catch {} finally { setExporting(false) }
          }}
        >
          {exporting ? '…' : '↓'} Exporter tout
        </button>
      </div>
    </div>
  )
}
