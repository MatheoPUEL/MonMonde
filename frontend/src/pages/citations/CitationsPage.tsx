import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { CitationList } from './CitationList'
import { CitationDetail } from './CitationDetail'
import { CitationStatsPanel } from '../../components/citations/CitationStatsPanel'

const TABS = [
  { to: '/citations/list', label: 'Liste' },
  { to: '/citations/stats', label: 'Statistiques' },
]

const TAB_SLUGS = ['list', 'stats']

export function CitationsPage() {
  const location = useLocation()
  const segment = location.pathname.split('/')[2]
  const isDetail = !!segment && !TAB_SLUGS.includes(segment)

  return (
    <div>
      {!isDetail && (
        <div className="citations-tabs">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => `citations-tab${isActive ? ' active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      )}
      <Routes>
        <Route index element={<Navigate to="list" replace />} />
        <Route path="list" element={<CitationList />} />
        <Route path="stats" element={<CitationStatsPanel />} />
        <Route path=":id" element={<CitationDetail />} />
      </Routes>
    </div>
  )
}
