# Design : Auteurs en base de données

**Date :** 2026-06-18  
**Statut :** Approuvé

## Résumé

Transformer le champ `author: string` des livres en une entité `Author` persistée en DB. Permet l'autocomplete à la saisie, des stats par auteur, et une page dédiée par auteur enrichissable via Open Library (gratuit, sans clé API).

---

## 1. Schéma DB

### Nouvelle table `Author`

| Champ | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | PK |
| `userId` | String | FK vers User |
| `name` | String | Requis |
| `bio` | String? | Optionnel |
| `birthDate` | DateTime? | Optionnel |
| `deathDate` | DateTime? | Optionnel |
| `nationality` | String? | Optionnel |
| `photoUrl` | String? | Optionnel |
| `openLibraryId` | String? | Pour éviter les doublons lors de l'enrichissement |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

Contrainte d'unicité : `(userId, name)` — pas deux auteurs avec le même nom pour un même utilisateur.

### Modification de `Book`

- Suppression de `author: String`
- Ajout de `authorId: String` (FK vers Author, relation obligatoire)

### Migration

À la migration, pour chaque livre existant : créer un `Author` avec le nom du livre (find-or-create par `(userId, name)`), puis mettre à jour `authorId`.

---

## 2. Backend — Nouveaux endpoints

### Auteurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/reading/authors` | Liste tous les auteurs de l'utilisateur (nom, photo, nb livres, note moyenne) |
| `GET` | `/api/reading/authors/:id` | Détail d'un auteur + liste de ses livres |
| `PUT` | `/api/reading/authors/:id` | Modifier les infos manuellement |
| `POST` | `/api/reading/authors/:id/enrich` | Fetch Open Library → remplit les champs vides |

### Modification de `POST /api/reading/books`

Le payload accepte `authorName: string` au lieu de `author: string`.  
Logique : find-or-create `Author` par `(userId, authorName)` → lier via `authorId`.

### Open Library — logique d'enrichissement

1. Recherche par nom : `https://openlibrary.org/search/authors.json?q={name}`
2. Récupération du premier résultat pertinent (score + nom exact)
3. Fetch détail : `https://openlibrary.org/authors/{olid}.json`
4. Photo : `https://covers.openlibrary.org/a/olid/{olid}-L.jpg`
5. Seuls les champs **vides** sont mis à jour (ne pas écraser ce que l'utilisateur a renseigné manuellement)
6. Si Open Library ne retourne aucun résultat → réponse `404` avec message clair, aucun champ modifié

---

## 3. Frontend

### Formulaire d'ajout / édition de livre

- Le champ auteur devient un **autocomplete** : frappe → suggestions des auteurs existants via `GET /api/reading/authors?search=...`
- Si aucun match → création automatique au submit avec juste le nom
- Affichage de la suggestion avec le nombre de livres déjà associés

### Sidebar

Ajout d'un lien "Auteurs" dans la section Lecture de la sidebar.

### Page `/auteurs`

- Liste des auteurs : photo (avatar initiales si pas de photo), nom, nb de livres, note moyenne
- Clic → page détail

### Page `/auteurs/:id`

- En-tête : photo, nom, nationalité, dates de vie
- Bouton **"Enrichir"** : appelle `POST /api/reading/authors/:id/enrich`, spinner pendant le fetch, champs mis à jour
- Formulaire d'édition manuelle des champs optionnels
- Liste des livres de l'auteur (couverture, titre, statut, note)

---

## 4. Ce qui n'est pas dans ce scope

- Gestion des tags (prévu séparément)
- Auteurs multiples par livre (un seul auteur par livre pour l'instant)
- Page stats globale par auteur (à envisager plus tard)
