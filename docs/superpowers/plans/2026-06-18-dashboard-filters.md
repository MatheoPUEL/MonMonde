# Dashboard Global & Filtres Avancés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le Dashboard en tableau de bord avec 4 widgets cross-module (lecture, journal, routines, citation), et enrichir BookLibrary avec un panel de filtres avancés dépliable (genre, tag, auteur, tri).

**Architecture:** 4 widgets indépendants en bento grid dans Dashboard.tsx, chacun extrait en composant séparé dans `components/dashboard/`. BookLibrary reçoit un panel dépliable avec filtres client-side sur le résultat backend existant.

**Tech Stack:** React 18, TypeScript, CSS Grid (grid-template-areas), CSS transitions pour le panel dépliable. Aucune dépendance externe ajoutée.

## Global Constraints

- Réutiliser les classes CSS existantes : `.glass-card`, `.filter-chip`, `.filter-chip--active`, `.input-field`, `.status-select`, `.btn`, `.btn-ghost`, `.loading-spinner`, `.dashboard-widget-title`
- Pas de modification du backend
- Responsive : mobile < 768px, tablet 768–1024px, desktop > 1024px
- Fonts : `'Playfair Display', serif` pour titres, `'DM Sans', sans-serif` pour texte courant
- Variables CSS : `--accent: #C4775A`, `--accent-light`, `--text-primary`, `--text-secondary`, `--text-muted`, `--bg-glass`, `--glass-blur`, `--glass-border`, `--shadow-soft`, `--shadow-medium`, `--radius-sm`, `--radius-md`, `--transition`
- Dev server frontend : `cd frontend && npm run dev`

---

### Task 1: Dashboard — Bento Grid CSS + Scaffold

**Files:**
- Modify: `frontend/src/styles/globals.css` — ajouter section Dashboard Bento
- Modify: `frontend/src/pages/Dashboard.tsx` — remplacer modules grid par bento scaffold

**Interfaces:**
- Produit: `.dashboard-bento`, `.dashboard-widget`, `.widget-reading`, `.widget-journal`, `.widget-today`, `.widget-citation`, `.dashboard-widget-title`, `.dashboard-widget-link`, `.widget-empty` utilisables par les 4 tâches suivantes

- [ ] **Step 1: Ajouter les classes CSS dans globals.css**

Trouver la section `/* Dashboard */` dans `frontend/src/styles/globals.css` (vers la ligne 453). Remplacer la section Dashboard existante par :

```css
/* Dashboard */
.dashboard {
  max-width: 960px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 2rem;
  animation: fadeUp 0.45s ease both;
}

.dashboard-greeting {
  font-family: 'Playfair Display', serif;
  font-size: 2.1rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.dashboard-date {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-top: 0.2rem;
  font-family: 'Playfair Display', serif;
  font-style: italic;
}

/* Bento Grid */
.dashboard-bento {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  grid-template-areas:
    "reading journal"
    "reading today"
    "citation citation";
  gap: 1.25rem;
  animation: fadeUp 0.45s ease 0.08s both;
}

.dashboard-widget {
  background: var(--bg-glass);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  transition: box-shadow var(--transition);
  min-height: 180px;
}

.dashboard-widget:hover {
  box-shadow: var(--shadow-medium);
}

.widget-reading  { grid-area: reading; }
.widget-journal  { grid-area: journal; }
.widget-today    { grid-area: today; }
.widget-citation { grid-area: citation; }

.dashboard-widget-title {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.dashboard-widget-link {
  margin-top: auto;
  font-size: 0.8rem;
  color: var(--accent);
  text-decoration: none;
  transition: opacity var(--transition);
}

.dashboard-widget-link:hover { opacity: 0.75; }

.widget-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.875rem;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-family: 'Playfair Display', serif;
  font-style: italic;
  text-align: center;
}

/* Widget Lecture */
.widget-book-layout {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.widget-book-cover {
  width: 72px;
  flex-shrink: 0;
  aspect-ratio: 2/3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
}

.widget-book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.widget-book-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.widget-book-title {
  font-family: 'Playfair Display', serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
}

.widget-book-title:hover { color: var(--accent); }

.widget-book-author {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.widget-book-noprogress {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

.widget-book-more {
  font-size: 0.72rem;
  color: var(--text-muted);
}

/* Widget Journal */
.widget-journal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.widget-streak-badge {
  font-size: 0.72rem;
  background: var(--accent-light);
  color: var(--accent);
  padding: 0.15rem 0.6rem;
  border-radius: 20px;
  font-weight: 600;
  white-space: nowrap;
}

.widget-journal-entry {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.widget-journal-mood { font-size: 1.25rem; }

.widget-journal-entry-title {
  font-family: 'Playfair Display', serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
}

.widget-journal-date {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-style: italic;
}

/* Widget Aujourd'hui */
.widget-today-body {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex: 1;
}

.widget-ring {
  width: 76px;
  height: 76px;
  flex-shrink: 0;
}

.widget-ring-track {
  fill: none;
  stroke: var(--accent-light);
  stroke-width: 7;
}

.widget-ring-fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 7;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}

.widget-ring-label {
  font-size: 13px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: 'DM Sans', sans-serif;
}

.widget-routine-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
}

.widget-routine-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.widget-routine-item--done {
  color: var(--text-muted);
  text-decoration: line-through;
  text-decoration-color: var(--accent);
}

.widget-routine-icon { font-size: 0.95rem; flex-shrink: 0; }
.widget-routine-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.widget-routine-check { color: var(--accent); font-size: 0.85rem; flex-shrink: 0; }

/* Widget Citation */
.widget-citation-text {
  flex: 1;
  margin: 0;
  padding: 0 0.5rem;
  border-left: 2px solid var(--accent-light);
}

.widget-citation-text p {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 0.95rem;
  color: var(--text-primary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.widget-citation-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.widget-citation-author {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.widget-citation-source { font-size: 1rem; }

.dashboard-export {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}
```

- [ ] **Step 2: Ajouter le responsive bento dans les media queries existantes**

Dans les media queries de `globals.css`, **remplacer** le bloc `.dashboard-*` mobile/tablet existant par :

```css
/* Mobile (< 768px) */
@media (max-width: 767px) {
  /* ... conserver toutes les règles existantes ... */

  .dashboard-greeting { font-size: 1.5rem; }
  .dashboard-date { font-size: 0.85rem; }
  .dashboard-header { margin-bottom: 1.5rem; }

  .dashboard-bento {
    grid-template-columns: 1fr;
    grid-template-areas:
      "reading"
      "journal"
      "today"
      "citation";
  }

  .widget-book-cover { width: 56px; }
}

/* Tablet (768px – 1024px) */
@media (min-width: 768px) and (max-width: 1024px) {
  /* ... conserver les règles existantes ... */

  .dashboard-greeting { font-size: 1.8rem; }

  .dashboard-bento {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "reading journal"
      "today citation";
  }
}
```

- [ ] **Step 3: Scaffold Dashboard.tsx**

Remplacer le contenu de `frontend/src/pages/Dashboard.tsx` par :

```tsx
import { useAuth } from '../context/AuthContext'

export function Dashboard() {
  const { user } = useAuth()

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  const firstName = user?.name.split(' ')[0] ?? ''

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-greeting">Bonjour, {firstName} 👋</h1>
        <p className="dashboard-date">{capitalizedDate}</p>
      </header>
      <div className="dashboard-bento">
        <div className="dashboard-widget widget-reading">
          <span className="dashboard-widget-title">📚 Lecture en cours</span>
        </div>
        <div className="dashboard-widget widget-journal">
          <span className="dashboard-widget-title">📓 Journal</span>
        </div>
        <div className="dashboard-widget widget-today">
          <span className="dashboard-widget-title">🔄 Aujourd'hui</span>
        </div>
        <div className="dashboard-widget widget-citation">
          <span className="dashboard-widget-title">💬 Citation du jour</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Vérifier visuellement**

```bash
cd frontend && npm run dev
```

Ouvrir `http://localhost:5173`. Vérifier :
- Le bento grid s'affiche avec 4 cases vides en bonne disposition
- Sur mobile (DevTools 390px) : 1 colonne
- Sur tablet (DevTools 900px) : 2×2 grid
- Sur desktop : reading span 2 lignes, citation pleine largeur

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/globals.css frontend/src/pages/Dashboard.tsx
git commit -m "feat: dashboard bento grid scaffold + CSS"
```

---

### Task 2: WidgetLecture — Livre en cours

**Files:**
- Create: `frontend/src/components/dashboard/WidgetLecture.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consomme: `readingApi.getBooks({ status: 'READING' })` → `{ books: Book[] }`
- Consomme: `ProgressBar({ currentPage, pageCount })` depuis `../../components/reading/ProgressBar`
- Produit: `<WidgetLecture />` — aucune prop

- [ ] **Step 1: Créer WidgetLecture.tsx**

Créer `frontend/src/components/dashboard/WidgetLecture.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { readingApi, Book } from '../../api/reading'
import { ProgressBar } from '../reading/ProgressBar'

export function WidgetLecture() {
  const [book, setBook] = useState<Book | null>(null)
  const [totalReading, setTotalReading] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    readingApi.getBooks({ status: 'READING' })
      .then(d => {
        setBook(d.books[0] ?? null)
        setTotalReading(d.books.length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="dashboard-widget widget-reading">
      <span className="dashboard-widget-title">📚 Lecture en cours</span>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
          <div className="loading-spinner" />
        </div>
      ) : book ? (
        <>
          <div className="widget-book-layout">
            <div className="widget-book-cover">
              {book.coverUrl
                ? <img src={book.coverUrl} alt={book.title} />
                : '📖'
              }
            </div>
            <div className="widget-book-info">
              <Link to={`/reading/books/${book.id}`} className="widget-book-title">
                {book.title}
              </Link>
              <span className="widget-book-author">{book.author.name}</span>
              {book.currentPage && book.pageCount ? (
                <>
                  <ProgressBar currentPage={book.currentPage} pageCount={book.pageCount} />
                  <span className="widget-book-noprogress" style={{ fontStyle: 'normal', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {book.pageCount - book.currentPage} page{book.pageCount - book.currentPage > 1 ? 's' : ''} restantes
                  </span>
                </>
              ) : (
                <span className="widget-book-noprogress">Progression non suivie</span>
              )}
            </div>
          </div>
          {totalReading > 1 && (
            <span className="widget-book-more">
              et {totalReading - 1} autre{totalReading > 2 ? 's' : ''} en cours
            </span>
          )}
          <Link to="/reading" className="dashboard-widget-link">
            Voir la bibliothèque →
          </Link>
        </>
      ) : (
        <div className="widget-empty">
          <span>Aucun livre en cours</span>
          <Link to="/reading" className="btn btn-ghost" style={{ width: 'auto' }}>
            Choisir un livre
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Brancher dans Dashboard.tsx**

Remplacer le widget reading placeholder dans `Dashboard.tsx` :

```tsx
import { useAuth } from '../context/AuthContext'
import { WidgetLecture } from '../components/dashboard/WidgetLecture'

// ... dans le JSX, remplacer :
<div className="dashboard-widget widget-reading">
  <span className="dashboard-widget-title">📚 Lecture en cours</span>
</div>

// par :
<WidgetLecture />
```

- [ ] **Step 3: Vérifier visuellement**

Avec le dev server actif, ouvrir le dashboard.
Vérifier :
- Si un livre est en cours : couverture + titre + auteur + barre de progression visible
- Si progression connue : "X pages restantes" affiché
- Si aucun livre en cours : message + bouton "Choisir un livre"
- Clic sur le titre → navigue vers la page du livre

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/WidgetLecture.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat: add WidgetLecture to dashboard"
```

---

### Task 3: WidgetJournal — Dernière entrée + streak

**Files:**
- Create: `frontend/src/components/dashboard/WidgetJournal.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consomme: `journalApi.getEntries({ limit: 1, draft: false })` → `{ entries: JournalEntry[]; total: number; page: number }`
- Consomme: `journalApi.getStats()` → `JournalStats` (`.currentStreak`)
- Consomme: `MOOD_EMOJIS: Record<Mood, string>` depuis `../../api/journal`
- Produit: `<WidgetJournal />` — aucune prop

- [ ] **Step 1: Créer WidgetJournal.tsx**

Créer `frontend/src/components/dashboard/WidgetJournal.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { journalApi, JournalEntry, JournalStats, MOOD_EMOJIS } from '../../api/journal'

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days} jours`
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaine${days >= 14 ? 's' : ''}`
  return `Il y a ${Math.floor(days / 30)} mois`
}

export function WidgetJournal() {
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [stats, setStats] = useState<JournalStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      journalApi.getEntries({ limit: 1, draft: false }),
      journalApi.getStats(),
    ])
      .then(([entriesData, statsData]) => {
        setEntry(entriesData.entries[0] ?? null)
        setStats(statsData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="dashboard-widget widget-journal">
      <div className="widget-journal-header">
        <span className="dashboard-widget-title">📓 Journal</span>
        {stats && stats.currentStreak > 0 && (
          <span className="widget-streak-badge">🔥 {stats.currentStreak} j</span>
        )}
      </div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
          <div className="loading-spinner" />
        </div>
      ) : entry ? (
        <>
          <div className="widget-journal-entry">
            {entry.mood && (
              <span className="widget-journal-mood">{MOOD_EMOJIS[entry.mood]}</span>
            )}
            <span className="widget-journal-entry-title">
              {entry.title || 'Sans titre'}
            </span>
            <span className="widget-journal-date">{relativeDate(entry.createdAt)}</span>
          </div>
          <Link to={`/journal/${entry.id}`} className="dashboard-widget-link">
            Lire l'entrée →
          </Link>
        </>
      ) : (
        <div className="widget-empty">
          <span>Pas encore d'entrée</span>
          <Link to="/journal" className="btn btn-ghost" style={{ width: 'auto' }}>
            Écrire
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Brancher dans Dashboard.tsx**

```tsx
import { WidgetJournal } from '../components/dashboard/WidgetJournal'

// Dans le JSX, remplacer :
<div className="dashboard-widget widget-journal">
  <span className="dashboard-widget-title">📓 Journal</span>
</div>

// par :
<WidgetJournal />
```

- [ ] **Step 3: Vérifier visuellement**

Vérifier :
- Titre de la dernière entrée visible, date relative correcte (ex. "Hier")
- Mood emoji affiché si présent
- Badge streak "🔥 X j" visible si streak > 0
- Clic "Lire l'entrée →" navigue vers `/journal/:id`
- État vide si aucune entrée

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/WidgetJournal.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat: add WidgetJournal to dashboard"
```

---

### Task 4: WidgetAujourdhui — Ring de progression des routines

**Files:**
- Create: `frontend/src/components/dashboard/WidgetAujourdhui.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consomme: `routinesApi.getToday()` → `{ items: TodayItem[] }` où `TodayItem = { routine: Routine; completion: RoutineCompletion | null; isDue: boolean }`
- Produit: `<WidgetAujourdhui />` — aucune prop

- [ ] **Step 1: Créer WidgetAujourdhui.tsx**

Créer `frontend/src/components/dashboard/WidgetAujourdhui.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { routinesApi, TodayItem } from '../../api/routines'

const RING_R = 34
const RING_CIRC = 2 * Math.PI * RING_R

function ProgressRing({ done, total }: { done: number; total: number }) {
  const progress = total === 0 ? 0 : done / total
  const offset = RING_CIRC * (1 - progress)
  return (
    <svg className="widget-ring" viewBox="0 0 88 88" aria-label={`${done} sur ${total} complétées`}>
      <circle cx="44" cy="44" r={RING_R} className="widget-ring-track" />
      <circle
        cx="44"
        cy="44"
        r={RING_R}
        className="widget-ring-fill"
        strokeDasharray={RING_CIRC}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="40" textAnchor="middle" dominantBaseline="middle" className="widget-ring-label">
        {done}/{total}
      </text>
      <text x="44" y="56" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>
        faites
      </text>
    </svg>
  )
}

export function WidgetAujourdhui() {
  const [items, setItems] = useState<TodayItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    routinesApi.getToday()
      .then(d => setItems(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const dueItems = items.filter(i => i.isDue)
  const doneItems = dueItems.filter(i => i.completion?.done)

  return (
    <div className="dashboard-widget widget-today">
      <span className="dashboard-widget-title">🔄 Aujourd'hui</span>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
          <div className="loading-spinner" />
        </div>
      ) : dueItems.length === 0 ? (
        <div className="widget-empty">
          <span>Rien de prévu aujourd'hui</span>
          <Link to="/routines" className="dashboard-widget-link">
            Voir les routines →
          </Link>
        </div>
      ) : (
        <>
          <div className="widget-today-body">
            <ProgressRing done={doneItems.length} total={dueItems.length} />
            <ul className="widget-routine-list">
              {dueItems.slice(0, 3).map(({ routine, completion }) => (
                <li
                  key={routine.id}
                  className={`widget-routine-item${completion?.done ? ' widget-routine-item--done' : ''}`}
                >
                  <span className="widget-routine-icon">{routine.icon}</span>
                  <span className="widget-routine-name">{routine.name}</span>
                  {completion?.done && <span className="widget-routine-check">✓</span>}
                </li>
              ))}
            </ul>
          </div>
          <Link to="/routines" className="dashboard-widget-link">
            Voir toutes →
          </Link>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Brancher dans Dashboard.tsx**

```tsx
import { WidgetAujourdhui } from '../components/dashboard/WidgetAujourdhui'

// Dans le JSX, remplacer :
<div className="dashboard-widget widget-today">
  <span className="dashboard-widget-title">🔄 Aujourd'hui</span>
</div>

// par :
<WidgetAujourdhui />
```

- [ ] **Step 3: Vérifier visuellement**

Vérifier :
- Ring SVG affiché avec cercle de fond + arc de progression (couleur accent)
- Chiffres done/total dans le ring
- Liste des 3 premières routines dues avec icône + nom
- Routines terminées : texte barré + ✓
- État vide : "Rien de prévu aujourd'hui"

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/WidgetAujourdhui.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat: add WidgetAujourdhui with SVG progress ring to dashboard"
```

---

### Task 5: WidgetCitation — Citation aléatoire parmi les favoris

**Files:**
- Create: `frontend/src/components/dashboard/WidgetCitation.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consomme: `citationsApi.getAll({ favorite: true })` → `{ citations: Citation[]; total: number }`
- Consomme: `citationsApi.getAll()` → fallback si aucun favori
- Consomme: `SOURCE_TYPE_ICONS: Record<SourceType, string>` depuis `../../api/citations`
- Produit: `<WidgetCitation />` — aucune prop

- [ ] **Step 1: Créer WidgetCitation.tsx**

Créer `frontend/src/components/dashboard/WidgetCitation.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { citationsApi, Citation, SOURCE_TYPE_ICONS } from '../../api/citations'

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

export function WidgetCitation() {
  const [citation, setCitation] = useState<Citation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    citationsApi.getAll({ favorite: true })
      .then(d => {
        if (d.citations.length > 0) return d.citations
        return citationsApi.getAll().then(d2 => d2.citations)
      })
      .then(list => setCitation(pickRandom(list)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="dashboard-widget widget-citation">
      <span className="dashboard-widget-title">💬 Citation du jour</span>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
          <div className="loading-spinner" />
        </div>
      ) : citation ? (
        <>
          <blockquote className="widget-citation-text">
            <p>{citation.text}</p>
          </blockquote>
          <footer className="widget-citation-footer">
            <span className="widget-citation-author">
              {citation.author ?? citation.source ?? 'Inconnu'}
            </span>
            <span className="widget-citation-source">
              {SOURCE_TYPE_ICONS[citation.sourceType]}
            </span>
          </footer>
          <Link to="/citations" className="dashboard-widget-link">
            Voir les citations →
          </Link>
        </>
      ) : (
        <div className="widget-empty">
          <span>Aucune citation enregistrée</span>
          <Link to="/citations" className="btn btn-ghost" style={{ width: 'auto' }}>
            Ajouter
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Brancher dans Dashboard.tsx (version finale)**

Remplacer tout le contenu de `frontend/src/pages/Dashboard.tsx` par la version finale :

```tsx
import { useAuth } from '../context/AuthContext'
import { WidgetLecture } from '../components/dashboard/WidgetLecture'
import { WidgetJournal } from '../components/dashboard/WidgetJournal'
import { WidgetAujourdhui } from '../components/dashboard/WidgetAujourdhui'
import { WidgetCitation } from '../components/dashboard/WidgetCitation'

export function Dashboard() {
  const { user } = useAuth()

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  const firstName = user?.name.split(' ')[0] ?? ''

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-greeting">Bonjour, {firstName} 👋</h1>
        <p className="dashboard-date">{capitalizedDate}</p>
      </header>
      <div className="dashboard-bento">
        <WidgetLecture />
        <WidgetJournal />
        <WidgetAujourdhui />
        <WidgetCitation />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Vérifier le dashboard complet**

Vérifier :
- Les 4 widgets s'affichent correctement dans le bento grid
- La citation change à chaque rechargement (aléatoire)
- Citation en italique Playfair avec bordure gauche accent
- Responsive testé sur mobile (DevTools 390px) : 4 widgets en colonne
- Responsive testé sur tablet (DevTools 900px) : 2×2 grid
- Aucune erreur TypeScript : `cd frontend && npm run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/WidgetCitation.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat: add WidgetCitation and complete dashboard bento"
```

---

### Task 6: Filtres CSS — Panel dépliable

**Files:**
- Modify: `frontend/src/styles/reading.css`

**Interfaces:**
- Produit: `.filters-panel`, `.filters-panel--open`, `.filters-panel-inner`, `.filters-panel-row`, `.filters-panel-label`, `.filters-panel-chips`, `.filters-panel-sort`, `.filters-badge` utilisables par Task 7

- [ ] **Step 1: Ajouter les classes dans reading.css**

En fin du fichier `frontend/src/styles/reading.css`, ajouter :

```css
/* ========== FILTRES AVANCÉS ========== */

.filters-btn-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.filters-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 16px;
  height: 16px;
  background: var(--accent);
  color: white;
  border-radius: 50%;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.filters-panel {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.28s ease;
}

.filters-panel--open {
  max-height: 500px;
}

.filters-panel-inner {
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  background: var(--bg-glass);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}

.filters-panel-row {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
}

.filters-panel-label {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  min-width: 52px;
  padding-top: 0.3rem;
  flex-shrink: 0;
}

.filters-panel-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  flex: 1;
}

.filters-panel-sort {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  flex-wrap: wrap;
}

.filters-panel-sort select {
  flex: 1;
  min-width: 130px;
}

.filters-reset-btn {
  background: none;
  border: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.3rem 0.5rem;
  border-radius: var(--radius-sm);
  transition: color var(--transition);
  white-space: nowrap;
  margin-left: auto;
}

.filters-reset-btn:hover { color: #C44B4B; }

.filters-panel-author {
  flex: 1;
  max-width: 280px;
}

/* Responsive filtres */
@media (max-width: 767px) {
  .filters-panel-row {
    flex-direction: column;
    gap: 0.4rem;
  }

  .filters-panel-label {
    min-width: unset;
    padding-top: 0;
  }

  .filters-panel-sort {
    flex-direction: column;
    align-items: flex-start;
  }

  .filters-panel-sort select {
    width: 100%;
  }

  .filters-reset-btn {
    margin-left: 0;
  }

  .filters-panel-author {
    max-width: 100%;
    width: 100%;
  }
}
```

- [ ] **Step 2: Vérifier le build TypeScript (aucun fichier .tsx modifié)**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" || echo "Build OK"
```

Expected: `Build OK` (les classes CSS n'ont pas d'impact TS)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/reading.css
git commit -m "feat: add filter panel CSS for advanced book filters"
```

---

### Task 7: BookLibrary — Panel de filtres avancés + tri client-side

**Files:**
- Modify: `frontend/src/pages/reading/BookLibrary.tsx`

**Interfaces:**
- Consomme: CSS classes de Task 6 : `.filters-panel`, `.filters-panel--open`, `.filters-panel-inner`, `.filters-panel-row`, `.filters-panel-label`, `.filters-panel-chips`, `.filters-panel-sort`, `.filters-badge`, `.filters-reset-btn`, `.filters-panel-author`
- Consomme: `AuthorAutocomplete` depuis `../../components/reading/AuthorAutocomplete`
- Consomme: `Book` avec `.genres: string[]`, `.tags: BookTag[]`, `.author.name: string`, `.rating?: number`, `.finishedAt?: string`, `.createdAt: string`, `.title: string`

- [ ] **Step 1: Remplacer BookLibrary.tsx complet**

Remplacer le contenu de `frontend/src/pages/reading/BookLibrary.tsx` :

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { readingApi, Book, ReadingStatus } from '../../api/reading'
import { BookCard } from '../../components/reading/BookCard'
import { BookRow } from '../../components/reading/BookRow'
import { AddBookModal } from './AddBookModal'
import { Button } from '../../components/ui/Button'
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'
import { AuthorAutocomplete } from '../../components/reading/AuthorAutocomplete'

type ViewMode = 'grid' | 'list'
type SortKey = 'createdAt' | 'title' | 'rating' | 'finishedAt'
type SortDir = 'asc' | 'desc'
const VIEW_KEY = 'reading_view'

const STATUS_FILTERS: Array<{ value: ReadingStatus | ''; label: string }> = [
  { value: '', label: 'Tous' },
  { value: 'WISHLIST', label: 'Souhaits' },
  { value: 'TO_READ', label: 'À lire' },
  { value: 'READING', label: 'En cours' },
  { value: 'FINISHED', label: 'Terminé' },
  { value: 'ABANDONED', label: 'Abandonné' },
]

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'createdAt', label: 'Date d\'ajout' },
  { value: 'title', label: 'Titre A→Z' },
  { value: 'rating', label: 'Note' },
  { value: 'finishedAt', label: 'Date de lecture' },
]

export function BookLibrary() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ReadingStatus | ''>('')
  const [showFavorites, setShowFavorites] = useState(false)
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'grid')
  const [showAddModal, setShowAddModal] = useState(false)

  // Filtres avancés
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filterAuthor, setFilterAuthor] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchBooks = useCallback(async () => {
    try {
      const data = await readingApi.getBooks({
        status: status || undefined,
        search: search || undefined,
        favorite: showFavorites || undefined,
      })
      setBooks(data.books)
    } catch {}
  }, [status, search, showFavorites])

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      await fetchBooks()
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [fetchBooks])

  function setViewMode(v: ViewMode) {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  // Options de genre/tag extraites des livres chargés
  const allGenres = useMemo(
    () => Array.from(new Set(books.flatMap(b => b.genres))).sort(),
    [books]
  )
  const allTags = useMemo(
    () => Array.from(new Set(books.flatMap(b => b.tags.map(t => t.name)))).sort(),
    [books]
  )

  function toggleGenre(g: string) {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  function toggleTag(t: string) {
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function resetFilters() {
    setSelectedGenres([])
    setSelectedTags([])
    setFilterAuthor('')
    setSortKey('createdAt')
    setSortDir('desc')
  }

  const activeFilterCount = useMemo(() => {
    let count = selectedGenres.length + selectedTags.length
    if (filterAuthor) count++
    if (sortKey !== 'createdAt' || sortDir !== 'desc') count++
    return count
  }, [selectedGenres, selectedTags, filterAuthor, sortKey, sortDir])

  // Application des filtres et tri côté client
  const displayedBooks = useMemo(() => {
    let result = books

    if (selectedGenres.length > 0) {
      result = result.filter(b => selectedGenres.some(g => b.genres.includes(g)))
    }
    if (selectedTags.length > 0) {
      result = result.filter(b => selectedTags.some(t => b.tags.some(bt => bt.name === t)))
    }
    if (filterAuthor) {
      const q = filterAuthor.toLowerCase()
      result = result.filter(b => b.author.name.toLowerCase().includes(q))
    }

    return [...result].sort((a, b) => {
      let valA: string | number
      let valB: string | number
      switch (sortKey) {
        case 'title':
          valA = a.title.toLowerCase()
          valB = b.title.toLowerCase()
          break
        case 'rating':
          valA = a.rating ?? -1
          valB = b.rating ?? -1
          break
        case 'finishedAt':
          valA = a.finishedAt ?? ''
          valB = b.finishedAt ?? ''
          break
        default:
          valA = a.createdAt
          valB = b.createdAt
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [books, selectedGenres, selectedTags, filterAuthor, sortKey, sortDir])

  return (
    <div className="reading-library">
      <header className="reading-header">
        <div>
          <h1 className="reading-title">Lectures</h1>
          <p className="reading-count">{displayedBooks.length} livre{displayedBooks.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ImportExportButtons module="reading" onImportDone={fetchBooks} />
          <Link to="/reading/authors" className="btn btn-ghost" style={{ width: 'auto', padding: '0.65rem 1.25rem' }}>
            Auteurs
          </Link>
          <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
            + Ajouter un livre
          </Button>
        </div>
      </header>

      <div className="reading-toolbar">
        <input
          className="input-field reading-search"
          placeholder="Titre, auteur, ISBN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="reading-view-toggle">
          <button className={`view-btn ${view === 'grid' ? 'view-btn--active' : ''}`} onClick={() => setViewMode('grid')} aria-label="Grille">⊞</button>
          <button className={`view-btn ${view === 'list' ? 'view-btn--active' : ''}`} onClick={() => setViewMode('list')} aria-label="Liste">≡</button>
        </div>
        <div className="filters-btn-wrap">
          <button
            className={`btn btn-ghost ${filtersOpen ? 'view-btn--active' : ''}`}
            style={{ width: 'auto', padding: '0.5rem 0.875rem', fontSize: '0.85rem' }}
            onClick={() => setFiltersOpen(o => !o)}
            aria-expanded={filtersOpen}
          >
            ⊕ Filtres
          </button>
          {activeFilterCount > 0 && (
            <span className="filters-badge">{activeFilterCount}</span>
          )}
        </div>
      </div>

      {/* Panel filtres avancés */}
      <div className={`filters-panel${filtersOpen ? ' filters-panel--open' : ''}`}>
        <div className="filters-panel-inner">
          {allGenres.length > 0 && (
            <div className="filters-panel-row">
              <span className="filters-panel-label">Genre</span>
              <div className="filters-panel-chips">
                {allGenres.map(g => (
                  <button
                    key={g}
                    className={`filter-chip ${selectedGenres.includes(g) ? 'filter-chip--active' : ''}`}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allTags.length > 0 && (
            <div className="filters-panel-row">
              <span className="filters-panel-label">Tag</span>
              <div className="filters-panel-chips">
                {allTags.map(t => (
                  <button
                    key={t}
                    className={`filter-chip ${selectedTags.includes(t) ? 'filter-chip--active' : ''}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filters-panel-row">
            <span className="filters-panel-label">Auteur</span>
            <div className="filters-panel-author">
              <AuthorAutocomplete
                value={filterAuthor}
                onChange={setFilterAuthor}
              />
            </div>
          </div>

          <div className="filters-panel-row">
            <span className="filters-panel-label">Trier</span>
            <div className="filters-panel-sort">
              <select
                className="status-select"
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select
                className="status-select"
                value={sortDir}
                onChange={e => setSortDir(e.target.value as SortDir)}
              >
                <option value="desc">Décroissant</option>
                <option value="asc">Croissant</option>
              </select>
              {activeFilterCount > 0 && (
                <button className="filters-reset-btn" onClick={resetFilters}>
                  ✕ Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="reading-filters">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-chip ${status === f.value ? 'filter-chip--active' : ''}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
        <button
          className={`filter-chip ${showFavorites ? 'filter-chip--active' : ''}`}
          onClick={() => setShowFavorites(v => !v)}
        >
          ★ Favoris
        </button>
      </div>

      {loading ? (
        <div className="reading-loading"><div className="loading-spinner" /></div>
      ) : displayedBooks.length === 0 ? (
        <div className="reading-empty">
          <div className="reading-empty-icon">📚</div>
          <p>{search || status || activeFilterCount > 0 ? 'Aucun livre trouvé.' : 'Ta bibliothèque est vide.'}</p>
          {!search && !status && activeFilterCount === 0 && (
            <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
              Ajouter mon premier livre
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="books-grid">
          {displayedBooks.map(b => <BookCard key={b.id} book={b} />)}
        </div>
      ) : (
        <div className="books-list">
          {displayedBooks.map(b => <BookRow key={b.id} book={b} />)}
        </div>
      )}

      {showAddModal && (
        <AddBookModal
          onClose={() => setShowAddModal(false)}
          onAdded={book => { setBooks(prev => [book, ...prev]); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier le build TypeScript**

```bash
cd frontend && npm run build 2>&1 | grep -E "error TS|Error" | head -20
```

Expected: aucune erreur. Si erreur sur `SortKey` ou `SortDir`, vérifier les types définis en haut du fichier.

- [ ] **Step 3: Vérifier visuellement**

Avec dev server actif, ouvrir `/reading`.
Tester :
1. Clic "⊕ Filtres" : le panel s'anime vers le bas
2. Cliquer un genre chip → il passe en accent, la liste se filtre instantanément
3. Cliquer un tag → filtre cumulatif avec genre
4. Taper un auteur → autocomplete s'ouvre, sélection filtre la liste
5. Changer tri "Titre A→Z" + "Croissant" → liste triée alphabétiquement
6. Badge orange "3" apparaît sur le bouton si 3 filtres actifs
7. Clic "✕ Réinitialiser" → tous les filtres effacés, badge disparaît
8. Re-clic "⊕ Filtres" → panel se referme
9. Sur mobile (DevTools 390px) : le panel passe en colonne, sélects pleine largeur

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/reading/BookLibrary.tsx
git commit -m "feat: add advanced filter panel with genre, tag, author, and sort to BookLibrary"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Dashboard : 4 widgets (Lecture, Journal, Aujourd'hui, Citation)
- ✅ Bento grid avec responsive mobile/tablet/desktop
- ✅ Widget Lecture : couverture, progression, état vide, lien
- ✅ Widget Journal : dernière entrée, mood emoji, streak badge, état vide
- ✅ Widget Aujourd'hui : SVG ring, liste 3 routines, état vide
- ✅ Widget Citation : aléatoire parmi favoris, fallback toutes, état vide
- ✅ Filtres avancés : genre (multi), tag (multi), auteur (autocomplete), tri (4 options × 2 sens)
- ✅ Panel dépliable avec animation CSS
- ✅ Badge compteur de filtres actifs
- ✅ Réinitialisation complète
- ✅ Filtrage client-side cumulatif
- ✅ Aucune modification backend

**Types cohérents entre tâches:**
- `ProgressBar` reçoit `currentPage` et `pageCount` (confirmé dans le composant existant)
- `AuthorAutocomplete` reçoit `value: string` et `onChange: (v: string) => void` (confirmé)
- `TodayItem.isDue`, `TodayItem.completion?.done` correspondent à l'API routines
- `SortKey` défini en Task 7 et utilisé uniquement dans Task 7 ✅
