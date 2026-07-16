import { Link, useLocation } from 'react-router-dom'
import { IconDashboard, IconJournal, IconReading, IconCitations, IconMore } from '../ui/icons'

interface BottomTabBarProps {
  onOpenMore: () => void
}

const TABS = [
  { to: '/', label: 'Accueil', Icon: IconDashboard, match: (p: string) => p === '/' },
  { to: '/journal', label: 'Journal', Icon: IconJournal, match: (p: string) => p.startsWith('/journal') },
  { to: '/reading', label: 'Lectures', Icon: IconReading, match: (p: string) => p.startsWith('/reading') },
  { to: '/citations', label: 'Citations', Icon: IconCitations, match: (p: string) => p.startsWith('/citations') },
]

export function BottomTabBar({ onOpenMore }: BottomTabBarProps) {
  const location = useLocation()

  return (
    <nav className="bottom-tab-bar">
      {TABS.map(tab => (
        <Link
          key={tab.to}
          to={tab.to}
          className={`bottom-tab${tab.match(location.pathname) ? ' bottom-tab--active' : ''}`}
        >
          <tab.Icon size={19} />
          <span>{tab.label}</span>
        </Link>
      ))}
      <button className="bottom-tab" onClick={onOpenMore}>
        <IconMore size={19} />
        <span>Plus</span>
      </button>
    </nav>
  )
}
