# Mon Monde — Life Aggregator — Design Spec
Date: 2026-06-09

## Vue d'ensemble

Application web personnelle de type "life aggregator" permettant de centraliser tous les aspects de la vie (projets, journal, finances, habitudes, lectures) sous une interface unifiée. Architecture modulaire : on construit les modules un par un au fil du temps.

**Phase 1 (ce spec) :** Authentification + Dashboard + Sidebar uniquement.

---

## Architecture globale

### Stack technique
- **Frontend** : React + Vite + TypeScript
- **Backend** : Node.js + Express + TypeScript + Prisma ORM
- **Base de données** : PostgreSQL 16
- **Déploiement** : Docker Compose

### Services Docker
| Service | Image | Port exposé |
|---------|-------|-------------|
| `frontend` | Node (build) → Nginx | 80 |
| `backend` | Node 20 Alpine | 3001 |
| `postgres` | PostgreSQL 16 Alpine | 5432 |

### Flux de données
```
Browser → Nginx (static assets)
       → /api/* → Express backend → PostgreSQL
```

### Authentification
- Email + mot de passe uniquement (pas d'OAuth)
- JWT stocké en cookie `httpOnly` (7 jours d'expiration)
- Middleware `auth.ts` injecte `req.user` sur toutes les routes protégées
- Mot de passe hashé en bcrypt (coût 12)

---

## Structure des fichiers

### Backend (`/backend`)
```
src/
├── index.ts                  # Entry point, Express setup
├── prisma/
│   └── schema.prisma         # Schéma DB
├── middleware/
│   └── auth.ts               # Vérifie JWT, injecte req.user
├── routes/
│   ├── auth.ts               # Routes auth publiques
│   └── modules.ts            # Liste des modules (protégé)
└── lib/
    └── prisma.ts             # Client Prisma singleton
```

### Frontend (`/frontend`)
```
src/
├── main.tsx
├── App.tsx                   # Router principal
├── api/
│   └── client.ts             # fetch wrapper (base URL + credentials: include)
├── pages/
│   ├── Login.tsx
│   ├── Register.tsx
│   └── Dashboard.tsx
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx     # Shell : sidebar + main content
│   │   ├── Sidebar.tsx
│   │   └── ModuleCard.tsx    # Carte placeholder module
│   └── ui/
│       ├── Input.tsx
│       ├── Button.tsx
│       └── GlassCard.tsx     # Composant glassmorphisme réutilisable
└── styles/
    ├── globals.css           # Reset, @font-face, base
    └── theme.css             # CSS variables design system
```

---

## Schéma base de données

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hash
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  shortcuts Shortcut[]
}

model Shortcut {
  id        String   @id @default(cuid())
  label     String
  url       String
  icon      String?
  order     Int
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

**Règle universelle pour tous les modules futurs :** chaque model de module aura un champ `userId String` avec une relation `User` — toutes les données sont associées à l'utilisateur.

---

## Routes API

### Auth (publiques)
```
POST /api/auth/register   { name, email, password } → crée user + set cookie JWT
POST /api/auth/login      { email, password }        → vérifie + set cookie JWT
POST /api/auth/logout     → clear cookie
GET  /api/auth/me         → retourne l'user connecté (protégé)
```

### Modules (protégé)
```
GET /api/modules          → liste des modules avec metadata (nom, icône, slug, disponible: bool)
```

### Shortcuts (protégé)
```
GET    /api/shortcuts
POST   /api/shortcuts         { label, url, icon? } → order auto-incrémenté
PUT    /api/shortcuts/:id     { label?, url?, icon? }
DELETE /api/shortcuts/:id
# Note : réorganisation par drag-and-drop = fonctionnalité future, pas phase 1
```

---

## Frontend — Pages & Routing

### Routes
```
/login       → page Login (publique, redirect / si auth)
/register    → page Register (publique, redirect / si auth)
/            → Dashboard (protégée, redirect /login si non auth)
```

### ProtectedRoute
Composant qui appelle `GET /api/auth/me` au montage. Si non authentifié → redirect `/login`. Gère l'état loading pour éviter le flash.

### Dashboard
- Greeting personnalisé avec le prénom de l'utilisateur
- Date du jour
- Grille de `ModuleCard` pour chaque module futur :
  - Icône + nom + description courte
  - Badge "Bientôt" sur les modules non encore construits
  - Au clic sur un module disponible → navigation vers sa route

**Modules prévus (placeholder pour l'instant) :**
| Slug | Nom | Icône |
|------|-----|-------|
| `projects` | Projets | 📋 |
| `journal` | Journal | 📓 |
| `finances` | Finances | 💰 |
| `habits` | Habitudes | ✅ |
| `reading` | Lectures | 📚 |

### Sidebar
- Logo / nom "Mon Monde" en haut
- Navigation modules (icône + label, état actif highlighted)
- Section "Raccourcis" : liste des shortcuts + bouton "Ajouter"
- En bas : avatar initiales + nom user + bouton Logout

---

## Système de design

### Typographie
| Usage | Font | Poids |
|-------|------|-------|
| Titres, headings | Playfair Display | 400, 700 |
| Corps, UI | DM Sans | 300, 400, 500 |

Source : Google Fonts

### Palette de couleurs
```css
--bg-base: #F5EFE6;           /* Crème chaud — fond principal */
--bg-surface: #FAF6F0;        /* Surface légèrement plus claire */
--bg-glass: rgba(255, 255, 255, 0.35);
--glass-blur: 12px;
--glass-border: rgba(255, 255, 255, 0.5);

--accent: #C4775A;            /* Terracotta — éléments interactifs */
--accent-hover: #B06548;
--accent-light: rgba(196, 119, 90, 0.12);

--text-primary: #2C1810;      /* Brun très foncé */
--text-secondary: #7A6458;    /* Brun moyen */
--text-muted: #A89890;        /* Brun clair */

--shadow-soft: 0 4px 24px rgba(196, 119, 90, 0.08);
--shadow-medium: 0 8px 32px rgba(196, 119, 90, 0.12);

--radius-sm: 8px;
--radius-md: 16px;
--radius-lg: 24px;
```

### Glassmorphisme (subtil)
```css
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}
```

### Animations
- Transitions hover : `transition: all 0.2s ease`
- Page load : fade-in staggeré sur les ModuleCard (`animation-delay` croissant)
- Pas d'animations complexes — fluidité et discrétion

---

## Docker Compose (structure)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
    volumes: [postgres_data:/var/lib/postgresql/data]

  backend:
    build: ./backend
    environment:
      DATABASE_URL, JWT_SECRET, NODE_ENV
    depends_on: [postgres]
    ports: ["3001:3001"]

  frontend:
    build: ./frontend
    ports: ["80:80"]
    depends_on: [backend]
```

---

## Périmètre Phase 1

**Inclus :**
- Inscription / Connexion / Déconnexion
- Dashboard avec cartes placeholder des modules futurs
- Sidebar avec navigation + raccourcis personnalisables + profil

**Exclus (modules futurs) :**
- Projets, Journal, Finances, Habitudes, Lectures
- Settings utilisateur avancés
- Notifications
