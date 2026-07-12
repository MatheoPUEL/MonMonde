# Dashboard Global & Filtres Avancés — Design Spec

**Date:** 2026-06-18
**Modules concernés:** `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/reading/BookLibrary.tsx`
**Objectif:** Transformer le dashboard en tableau de bord vivant avec 4 widgets cross-module, et enrichir la bibliothèque avec un panel de filtres avancés dépliable.

---

## 1. Dashboard Global

### 1.1 Principe

La grille de modules existante (ModuleCard) est **remplacée** par 4 widgets fonctionnels. La navigation se fait exclusivement via la sidebar. Le header (greeting + date) est conservé tel quel.

### 1.2 Layout — Bento Grid

```
Desktop (≥ 1025px) :
┌──────────────────────────┬──────────────────┐
│                          │   📓 Journal      │
│   📚 Livre en cours      │   (demi-hauteur)  │
│   (pleine hauteur)       ├──────────────────┤
│                          │   🔄 Aujourd'hui  │
│                          │   (demi-hauteur)  │
├──────────────────────────┴──────────────────┤
│   💬 Citation du jour      (pleine largeur)  │
└─────────────────────────────────────────────┘

Tablet (768–1024px) :
┌──────────────────┬──────────────────┐
│  Livre en cours  │  Journal         │
├──────────────────┼──────────────────┤
│  Aujourd'hui     │  Citation        │
└──────────────────┴──────────────────┘

Mobile (< 768px) :
┌──────────────────┐
│  Livre en cours  │
├──────────────────┤
│  Journal         │
├──────────────────┤
│  Aujourd'hui     │
├──────────────────┤
│  Citation        │
└──────────────────┘
```

Implémentation CSS : `grid-template-areas` avec 2 colonnes et 2 lignes. Le widget lecture occupe `grid-row: span 2` sur desktop. La citation occupe `grid-column: span 2` sur desktop.

### 1.3 Widget — Livre en cours

**Données :** `readingApi.getBooks({ status: 'READING' })` → premier livre en cours.

**Contenu :**
- Couverture du livre (aspect-ratio 2/3, arrondie, shadow)
- Titre + auteur (cliquables → `/reading/books/:id`)
- Barre de progression `currentPage / pageCount` (réutilise `ProgressBar`)
- Label "X pages restantes" ou "Progression inconnue"
- Lien "Voir dans la bibliothèque →" → `/reading`

**État vide :** Illustration placeholder + message *"Aucun livre en cours"* + bouton *"Choisir un livre"* → `/reading`

**Si plusieurs livres en cours :** Affiche le premier uniquement avec mention "et X autres en cours" en bas.

### 1.4 Widget — Journal

**Données :**
- `journalApi.getEntries({ limit: 1 })` → dernière entrée
- `journalApi.getStats()` → `currentStreak`

**Contenu :**
- Titre de la dernière entrée (tronqué 2 lignes)
- Date relative (ex. "hier", "il y a 3 jours")
- Mood emoji si présent
- Badge streak : "🔥 X jours" (accent color, style pill)
- Lien → `/journal`

**État vide :** Message *"Pas encore d'entrée"* + bouton *"Écrire"* → `/journal`

### 1.5 Widget — Aujourd'hui (Routines)

**Données :** `routinesApi.getToday()` → liste de `TodayItem` (routine + completion + isDue).

**Calcul :** Filtrer les items `isDue === true`. Compter ceux avec `completion?.done === true`.

**Contenu :**
- Ring de progression SVG (cercle avec stroke-dasharray) : `X/Y complétées`
- Nombre et label : "3 sur 5 routines"
- Liste des 3 premières routines du jour avec icône + nom + checkmark si done
- Lien "Voir toutes →" → `/routines`

**État vide (aucune routine due aujourd'hui) :** "Rien de prévu aujourd'hui" + lien vers routines.

### 1.6 Widget — Citation du jour

**Données :** `citationsApi.getAll({ favorite: true })` → liste de citations favorites. Sélection aléatoire côté client. Fallback sur `citationsApi.getAll()` si aucun favori.

**Contenu :**
- Texte de la citation (guillemets décoratifs, Playfair Display italic)
- Auteur / source
- Tag source (BOOK, ARTICLE, etc.) avec icône
- Lien → `/citations`

**Logique aléatoire :** `Math.floor(Math.random() * citations.length)` au mount, pas de persistance. Change à chaque rechargement.

**État vide :** Message *"Aucune citation enregistrée"* + bouton *"Ajouter"* → `/citations`

### 1.7 Chargement

Chaque widget charge ses données indépendamment (4 `useEffect` parallèles). Chaque widget affiche son propre skeleton/spinner pendant le chargement. Pas de loading global.

### 1.8 CSS

Nouvelles classes dans `globals.css` (section Dashboard) :
- `.dashboard-bento` — grid container avec `grid-template-areas`
- `.dashboard-widget` — base glass-card commune (réutilise `.glass-card`)
- `.dashboard-widget-title` — titre de section du widget (Playfair Display, text-secondary)
- `.dashboard-widget-link` — lien discret en bas du widget
- `.widget-reading`, `.widget-journal`, `.widget-today`, `.widget-citation` — areas nommées
- `.widget-streak-badge` — pill accent pour le streak
- `.widget-ring` — SVG progress ring
- `.widget-routine-list` — liste compacte des routines
- `.widget-citation-text` — style citation (guillemets, italic, Playfair)
- `.widget-empty` — état vide centré avec message + CTA

Responsive géré dans les media queries existants (767px, 768–1024px).

---

## 2. Filtres Avancés (BookLibrary)

### 2.1 Principe

Le panel de filtres avancés est **dépliable**, déclenché par un bouton `⊕ Filtres` dans la toolbar. Les filtres de statut existants (chips) restent inchangés. Les nouveaux filtres sont appliqués **côté client** sur le résultat du backend.

### 2.2 Toolbar modifiée

```
[ 🔍 Recherche... ] [ ⊞ ≡ ] [ ⊕ Filtres (3) ]
```

Le badge `(N)` sur le bouton indique le nombre de filtres avancés actifs. Le bouton utilise la classe `.btn-ghost` existante avec un style badge inline.

### 2.3 Panel dépliable

Animation : `max-height: 0` → `max-height: 400px` avec `overflow: hidden` et `transition: max-height 0.25s ease`. Pas de JS pour la hauteur — uniquement CSS class toggle `.filters-panel--open`.

**Contenu du panel (4 lignes) :**

```
Genre    [Roman] [Essai] [SF] [Biographie] … (chips cliquables, multi-select)
Tag      [lecture] [2024] [philosophie]   … (chips cliquables, multi-select)
Auteur   [Rechercher un auteur…]            (input avec autocomplete)
Trier    [Date d'ajout ▾]  [Décroissant ▾]  [Réinitialiser tout]
```

- **Genre** : extrait de `Array.from(new Set(books.flatMap(b => b.genres)))`, affiché en chips. Sélection multiple.
- **Tag** : extrait de `Array.from(new Set(books.flatMap(b => b.tags.map(t => t.name))))`, chips multi-select.
- **Auteur** : `<AuthorAutocomplete>` existant, filtre sur `book.author.name`.
- **Tri** :
  - Options : `Date d'ajout` (default), `Titre A→Z`, `Note`, `Date de lecture`
  - Ordre : `Décroissant` (default), `Croissant`
  - Deux `<select>` côte à côte, stylés avec `.status-select` existant

### 2.4 Application des filtres

Ordre d'application (tous côté client après fetch backend) :
1. Backend filtre : `status`, `search`, `tag` (via URL params)
2. Client filtre sur les résultats : `genres`, `author`, `rating`
3. Client trie le résultat final

Note : `tag` existe déjà côté backend. Le filtre tag du panel **remplace** le paramètre backend (pas de doublon).

Tri disponible côté client :
```ts
type SortKey = 'createdAt' | 'title' | 'rating' | 'finishedAt'
type SortDir = 'asc' | 'desc'
```

### 2.5 Réinitialisation

Le bouton "Réinitialiser tout" efface : genres sélectionnés, tags sélectionnés, auteur, tri (retour au défaut Date d'ajout / Décroissant). Il ne touche pas aux filtres de statut ni à la recherche texte.

### 2.6 CSS

Nouvelles classes dans `reading.css` :
- `.filters-panel` — container avec `max-height: 0; overflow: hidden; transition`
- `.filters-panel--open` — `max-height: 400px`
- `.filters-panel-inner` — padding interne, `display: flex; flex-direction: column; gap: 0.875rem`
- `.filters-panel-row` — ligne label + chips : `display: flex; align-items: flex-start; gap: 0.75rem`
- `.filters-panel-label` — label de catégorie (`font-size: 0.75rem`, text-muted, min-width fixe pour alignement)
- `.filters-panel-chips` — wrap de chips (réutilise `.filter-chip`, `.filter-chip--active`)
- `.filters-panel-sort` — ligne de tri avec les 2 selects + bouton reset
- `.filters-badge` — badge numérique sur le bouton Filtres

Responsive : sur mobile le panel passe en `flex-direction: column` et les chips wrappent librement. Le label passe au-dessus des chips.

---

## 3. Ce qui n'est PAS dans ce spec

- Stats de lecture (graphiques, objectif annuel) — feature future séparée
- Modification du backend pour filtres genre/sort — client-side suffisant
- Persistance des filtres dans localStorage — ajout futur si besoin
- Glissement de widgets (drag & drop) — hors scope

---

## 4. Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `frontend/src/pages/Dashboard.tsx` | Refonte complète |
| `frontend/src/styles/globals.css` | Ajout section `.dashboard-bento` et widgets |
| `frontend/src/pages/reading/BookLibrary.tsx` | Ajout panel filtres + logique tri/filtre |
| `frontend/src/styles/reading.css` | Ajout `.filters-panel*`, `.filters-badge` |
| `backend/src/routes/reading/books.ts` | Aucun changement |

Un nouveau endpoint backend `/api/dashboard/summary` est **explicitement écarté** — les 4 widgets font leurs propres appels pour rester découplés et facilement maintenables.
