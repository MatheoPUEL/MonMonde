import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { BottomTabBar } from './BottomTabBar'
import { SearchModal } from '../search/SearchModal'
import { useGlobalSearchShortcut } from '../../hooks/useGlobalSearchShortcut'
import { IconHamburger, IconSearch } from '../ui/icons'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useGlobalSearchShortcut(() => setSearchOpen(true))

  return (
    <div className="app-layout">
      <header className="mobile-topbar">
        <button
          className="mobile-topbar-menu"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Ouvrir le menu"
        >
          <IconHamburger size={20} />
        </button>
        <span className="mobile-topbar-logo">Mon Monde</span>
        <button
          className="mobile-topbar-search"
          onClick={() => setSearchOpen(true)}
          aria-label="Rechercher"
        >
          <IconSearch size={18} />
        </button>
      </header>
      <div
        className={`sidebar-overlay${sidebarOpen ? ' sidebar-overlay--visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <main className="app-main">{children}</main>
      <BottomTabBar onOpenMore={() => setSidebarOpen(true)} />
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
