import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { apiClient } from '../../api/client'
import {
  IconDashboard,
  IconSettings,
  IconLogout,
  IconSun,
  IconMoon,
  IconLink,
  IconClose,
  MODULE_ICONS,
} from '../ui/icons'

interface Module {
  slug: string
  name: string
  icon: string
  available: boolean
}

interface Shortcut {
  id: string
  label: string
  url: string
  icon?: string
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [modules, setModules] = useState<Module[]>([])
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])

  useEffect(() => {
    apiClient<{ modules: Module[] }>('/api/modules')
      .then(d => setModules(d.modules))
      .catch(() => {})
    apiClient<{ shortcuts: Shortcut[] }>('/api/shortcuts')
      .then(d => setShortcuts(d.shortcuts))
      .catch(() => {})
  }, [])

  const initials = user?.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  return (
    <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo">Mon Monde</span>
        <button className="sidebar-close" onClick={onClose} aria-label="Fermer le menu">
          <IconClose size={16} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <Link
          to="/"
          onClick={onClose}
          className={`sidebar-nav-item${location.pathname === '/' ? ' sidebar-nav-item--active' : ''}`}
        >
          <span className="sidebar-nav-icon"><IconDashboard size={17} /></span>
          <span className="sidebar-nav-label">Dashboard</span>
        </Link>
        <span className="sidebar-section-label">Modules</span>
        {modules.map(mod => {
          const ModIcon = MODULE_ICONS[mod.slug]
          return (
            <Link
              key={mod.slug}
              to={mod.available ? `/${mod.slug}` : '#'}
              onClick={onClose}
              className={[
                'sidebar-nav-item',
                !mod.available ? 'sidebar-nav-item--disabled' : '',
                location.pathname.startsWith(`/${mod.slug}`) ? 'sidebar-nav-item--active' : '',
              ].join(' ')}
            >
              <span className="sidebar-nav-icon">{ModIcon ? <ModIcon size={17} /> : mod.icon}</span>
              <span className="sidebar-nav-label">{mod.name}</span>
              {!mod.available && <span className="sidebar-badge">Bientôt</span>}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-shortcuts">
        <span className="sidebar-section-label">Raccourcis</span>
        {shortcuts.map(s => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-shortcut"
          >
            <span className="sidebar-nav-icon">{s.icon ?? <IconLink size={16} />}</span>
            <span className="sidebar-nav-label">{s.label}</span>
          </a>
        ))}
        <button className="sidebar-add-shortcut">+ Ajouter</button>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : initials}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-user-email">{user?.email}</span>
          </div>
        </div>
        <Link
          to="/settings"
          onClick={onClose}
          className={`sidebar-nav-item${location.pathname === '/settings' ? ' sidebar-nav-item--active' : ''}`}
          style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}
        >
          <span className="sidebar-nav-icon"><IconSettings size={17} /></span>
          <span className="sidebar-nav-label">Paramètres</span>
        </Link>
        <button className="sidebar-logout" onClick={() => { logout(); onClose() }}>
          <span className="sidebar-nav-icon"><IconLogout size={17} /></span>
          <span className="sidebar-nav-label">Déconnexion</span>
        </button>
        <button className="sidebar-theme-toggle" onClick={toggleTheme}>
          <span className="sidebar-nav-icon">
            {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
          </span>
          <span className="sidebar-nav-label">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
        </button>
      </div>
    </aside>
  )
}
