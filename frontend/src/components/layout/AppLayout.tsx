import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { BottomTabBar } from './BottomTabBar'
import { IconHamburger } from '../ui/icons'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
      </header>
      <div
        className={`sidebar-overlay${sidebarOpen ? ' sidebar-overlay--visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="app-main">{children}</main>
      <BottomTabBar onOpenMore={() => setSidebarOpen(true)} />
    </div>
  )
}
