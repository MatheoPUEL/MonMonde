import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GlassCard } from '../components/ui/GlassCard'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(name, email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription échouée')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <h1 className="auth-title">Mon Monde</h1>
          <p className="auth-subtitle">Commencez à centraliser votre vie.</p>
        </div>
        <GlassCard className="auth-card">
          <h2 className="auth-card-title">Créer un compte</h2>
          <form onSubmit={handleSubmit} className="auth-form">
            <Input
              label="Prénom"
              type="text"
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="given-name"
            />
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
              minLength={8}
              autoComplete="new-password"
            />
            {error && <p className="auth-error">{error}</p>}
            <Button type="submit" loading={loading}>Créer mon compte</Button>
          </form>
          <p className="auth-link">
            Déjà un compte ?{' '}
            <Link to="/login">Se connecter</Link>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
