import { useState } from 'react'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      <button
        className={`hamburger${sidebarOpen ? ' hamburger--hidden' : ''}`}
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Ouvrir le menu"
      >
        <span /><span /><span />
      </button>
      <div
        className={`sidebar-overlay${sidebarOpen ? ' sidebar-overlay--visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="app-main">{children}</main>
    </div>
  )
}
