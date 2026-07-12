import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { TodayView } from './TodayView'
import { GridView } from './GridView'
import { ItemList } from './ItemList'
import { AnnualView } from './AnnualView'
import { RoutineDetail } from './RoutineDetail'

const TABS = [
  { to: '/routines/today', label: "Aujourd'hui" },
  { to: '/routines/grid', label: 'Grille' },
  { to: '/routines/list', label: 'Éléments' },
  { to: '/routines/annual', label: 'Annuel' },
]

const TAB_SLUGS = ['today', 'grid', 'list', 'annual']

export function RoutinesPage() {
  const location = useLocation()
  const segment = location.pathname.split('/')[2]
  const isDetail = !!segment && !TAB_SLUGS.includes(segment)

  return (
    <div>
      {!isDetail && (
        <div className="routines-tabs">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => `routines-tab${isActive ? ' active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      )}
      <Routes>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<TodayView />} />
        <Route path="grid" element={<GridView />} />
        <Route path="list" element={<ItemList />} />
        <Route path="annual" element={<AnnualView />} />
        <Route path=":id" element={<RoutineDetail />} />
      </Routes>
    </div>
  )
}
