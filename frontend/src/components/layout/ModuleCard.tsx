import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../ui/GlassCard'

interface ModuleCardProps {
  slug: string
  name: string
  description: string
  icon: string
  available: boolean
  animationDelay: number
}

export function ModuleCard({ slug, name, description, icon, available, animationDelay }: ModuleCardProps) {
  const navigate = useNavigate()

  return (
    <GlassCard
      className={`module-card ${available ? 'module-card--available' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={() => available && navigate(`/${slug}`)}
    >
      <span className="module-card-icon">{icon}</span>
      <h3 className="module-card-name">{name}</h3>
      <p className="module-card-description">{description}</p>
      {!available && <span className="module-card-badge">Bientôt</span>}
    </GlassCard>
  )
}
