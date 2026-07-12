import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/globals.css'
import './styles/reading.css'
import './styles/journal.css'
import './styles/routines.css'
import './styles/citations.css'
import './styles/settings.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
