import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()

const MODULES = [
  { slug: 'projects', name: 'Projets', description: 'Gérez vos projets et tâches', icon: '📋', available: false },
  { slug: 'journal', name: 'Journal', description: 'Notes et journaling personnel', icon: '📓', available: true },
  { slug: 'finances', name: 'Finances', description: 'Budget, dépenses et objectifs', icon: '💰', available: false },
  { slug: 'routines', name: 'Habitudes', description: 'Routines et suivi des habitudes', icon: '✅', available: true },
  { slug: 'reading', name: 'Lectures', description: 'Livres lus et en cours', icon: '📚', available: true },
  { slug: 'citations', name: 'Citations', description: 'Tes citations et extraits', icon: '💬', available: true },
]

router.get('/', requireAuth, (_req, res) => {
  res.json({ modules: MODULES })
})

export default router
