import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { apiClient } from '../api/client'

interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchMe() {
    const data = await apiClient<{ user: User }>('/api/auth/me')
    setUser(data.user)
  }

  useEffect(() => {
    fetchMe()
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const data = await apiClient<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(data.user)
  }

  async function register(name: string, email: string, password: string) {
    const data = await apiClient<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    setUser(data.user)
  }

  async function logout() {
    await apiClient('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  async function refreshUser() {
    await fetchMe()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
