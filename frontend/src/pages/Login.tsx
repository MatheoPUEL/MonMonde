import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GlassCard } from '../components/ui/GlassCard'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion échouée')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <h1 className="auth-title">Mon Monde</h1>
          <p className="auth-subtitle">Votre vie, centralisée.</p>
        </div>
        <GlassCard className="auth-card">
          <h2 className="auth-card-title">Connexion</h2>
          <form onSubmit={handleSubmit} className="auth-form">
            <Input
              label="Email"
              type="email"
              id="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Mot de passe"
              type="password"
              id="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && <p className="auth-error">{error}</p>}
            <Button type="submit" loading={loading}>Se connecter</Button>
          </form>
          <p className="auth-link">
            Pas encore de compte ?{' '}
            <Link to="/register">S'inscrire</Link>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
