# Module Lectures — Design Spec
Date: 2026-06-10

## Vue d'ensemble

Module de gestion et suivi de lecture pour Mon Monde. Permet de gérer une bibliothèque personnelle de livres avec suivi de progression, notes, évaluation et organisation par tags.

**Principe clé :** Google Books API est utilisé uniquement pour pré-remplir le formulaire d'ajout. Une fois le livre ajouté, toutes les données sont stockées localement dans PostgreSQL — aucune dépendance externe à l'usage.

---

## Intégration dans l'app existante

- `backend/src/routes/modules.ts` : passer `available: true` pour le module `reading`
- `frontend/src/App.tsx` : ajouter la route `/reading/*` protégée
- `docker-compose.yml` : ajouter le volume `uploads_data` pour la persistance des couvertures uploadées

---

## Schéma base de données

```prisma
model Book {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  title         String
  author        String
  synopsis      String?
  isbn          String?
  pageCount     Int?
  genres        String[]
  coverUrl      String?       // URL externe ou chemin fichier uploadé
  coverType     String?       // "url" | "upload"
  googleBooksId String?

  status        ReadingStatus @default(WISHLIST)
  owned         Boolean       @default(false)

  rating        Int?          // 1–5
  review        String?

  favorite      Boolean       @default(false)
  rereadCount   Int           @default(0)
  tags          BookTag[]

  currentPage   Int?
  startedAt     DateTime?
  finishedAt    DateTime?

  notes         BookNote[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([userId])
  @@index([userId, status])
}

enum ReadingStatus {
  WISHLIST
  TO_READ
  READING
  FINISHED
  ABANDONED
}

model BookTag {
  id     String @id @default(cuid())
  name   String
  bookId String
  book   Book   @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@unique([bookId, name])
  @@index([bookId])
}

model BookNote {
  id        String   @id @default(cuid())
  bookId    String
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)

  title     String
  content   String
  chapter   String?  // texte libre : "Chapitre 3", "Partie II"
  page      Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([bookId])
}
```

**Règle d'isolation :** `userId` est sur `Book` uniquement. `BookTag` et `BookNote` héritent de l'isolation via la relation `Book → User`. Toutes les requêtes filtrent sur `userId` via une jointure `Book`.

**Calcul progression :** `Math.round((currentPage / pageCount) * 100)` — calculé côté frontend, pas stocké en DB.

---

## Routes API

### Recherche Google Books (proxy)
```
GET /api/reading/search?q=:query
```
Proxie vers `https://www.googleapis.com/books/v1/volumes?q=:query&maxResults=10`. Renvoie tableau simplifié : `{ googleBooksId, title, author, synopsis, coverUrl, isbn, pageCount, genres }`.

### Livres
```
GET    /api/reading/books
  → Filtres query: status, search (titre/auteur/isbn), tag, favorite=true
  → Retourne: livres avec leurs tags

POST   /api/reading/books
  → Body JSON: { title, author, synopsis?, isbn?, pageCount?, genres?, coverUrl?, coverType?, googleBooksId?, status?, owned?, tags? }

GET    /api/reading/books/:id
  → Livre complet avec tags et notes

PUT    /api/reading/books/:id
  → Modification partielle de tous les champs

DELETE /api/reading/books/:id
```

### Progression
```
PUT /api/reading/books/:id/progress
  → Body: { currentPage, startedAt?, finishedAt? }
  → Si currentPage >= pageCount et status = READING → status passe automatiquement à FINISHED
  → Si pageCount est null, aucun changement automatique de statut
```

### Upload couverture
```
POST /api/reading/books/:id/cover
  → multipart/form-data, champ "cover"
  → Stocké dans /app/uploads/covers/<bookId>.<ext>
  → Retourne: { coverUrl: "/uploads/covers/<bookId>.<ext>", coverType: "upload" }
```

### Notes
```
GET    /api/reading/books/:id/notes
POST   /api/reading/books/:id/notes
  → Body: { title, content, chapter?, page? }
PUT    /api/reading/books/:id/notes/:noteId
DELETE /api/reading/books/:id/notes/:noteId
```

---

## Structure frontend

```
frontend/src/
├── pages/reading/
│   ├── ReadingPage.tsx          # Routes internes /reading et /reading/:id
│   ├── BookLibrary.tsx          # Bibliothèque principale
│   ├── BookDetail.tsx           # Fiche détaillée
│   └── AddBookModal.tsx         # Modale ajout (search + formulaire)
│
└── components/reading/
    ├── BookCard.tsx              # Vue grille
    ├── BookRow.tsx               # Vue liste
    ├── BookStatusBadge.tsx       # Badge coloré par statut
    ├── ProgressBar.tsx           # Barre de progression + %
    ├── StarRating.tsx            # ★★★★★ interactif (1–5)
    ├── NoteCard.tsx              # Affichage d'une note
    ├── NoteForm.tsx              # Formulaire note (ajout/édition)
    └── ProgressUpdateForm.tsx    # Formulaire mise à jour page actuelle
```

**Routing React Router :**
```
/reading        → BookLibrary
/reading/:id    → BookDetail
```

Route dans `App.tsx` :
```tsx
<Route path="/reading/*" element={
  <ProtectedRoute>
    <AppLayout>
      <ReadingPage />
    </AppLayout>
  </ProtectedRoute>
} />
```

---

## UX détaillée

### BookLibrary

- **Header** : titre "Lectures", compteur `N livres`, bouton "＋ Ajouter un livre"
- **Barre de recherche** : filtre temps réel (debounce 300ms côté frontend) sur titre, auteur, ISBN, tags
- **Chips de filtres** : `Tous · Liste de souhaits · À lire · En cours · Terminé · Abandonné · ★ Favoris`
- **Toggle vue** : icônes grille/liste, état persisté en `localStorage` (clé `reading_view`)
- **Vue grille** : `BookCard` — couverture dominante, titre, auteur, badge statut, barre de progression si `READING`, étoiles si `rating` défini
- **Vue liste** : `BookRow` — une ligne par livre, couverture thumbnail, titre, auteur, statut, progression, note, date début/fin

### AddBookModal

1. Champ de recherche → appel `/api/reading/search?q=...` (debounce 400ms) → liste de résultats
2. Clic sur un résultat → pré-remplit le formulaire (tous les champs éditables)
3. Lien "Saisie manuelle" pour formulaire vide
4. Champ couverture : radio "URL externe" | "Uploader une image" (upload après création du livre via `POST /cover`)
5. Champ tags : input avec création à la volée (Enter pour valider, chips supprimables)
6. Statut initial : select (défaut `WISHLIST`)
7. Toggle "Je possède ce livre"

### BookDetail

**Layout deux colonnes (desktop) / colonne unique (mobile) :**

Colonne gauche :
- Couverture (cliquable pour changer)
- Select statut
- Toggle "Possédé"
- StarRating (1–5, cliquable)
- Textarea avis personnel
- Bouton "Relecture +" (incrémente `rereadCount`, affiche le compteur)
- Bouton "★ Favori" (toggle)

Colonne droite :
- Titre (Playfair Display, grand)
- Auteur, genres (chips), tags (chips éditables), ISBN, pages
- Synopsis (collapsible si long)
- **Section Progression** : `ProgressBar` + "Page X / Y" + bouton "Mettre à jour" → `ProgressUpdateForm`
- **Section Notes** : liste de `NoteCard` + bouton "Ajouter une note" → `NoteForm`

---

## Infrastructure

### Backend — nouveaux fichiers
```
backend/src/routes/reading/
  ├── index.ts      # monte books, notes, search
  ├── books.ts
  ├── notes.ts
  └── search.ts

backend/src/lib/upload.ts   # config multer (diskStorage, filter image, max 5MB)
```

### Upload files
- `multer` avec `diskStorage` → `/app/uploads/covers/`
- Formats acceptés : JPEG, PNG, WebP
- Taille max : 5 MB
- Fichier servi via `express.static('/app/uploads', { ... })` → URL `/uploads/covers/<filename>`

### docker-compose.yml — ajout volume
```yaml
backend:
  volumes:
    - uploads_data:/app/uploads

volumes:
  uploads_data:
```

---

## Périmètre

**Inclus :**
- CRUD livres complet
- Recherche/auto-complétion Google Books
- Upload couverture + URL externe
- Statuts de lecture (5 états) + possession
- Progression (page actuelle → %)
- Notes (titre, contenu, chapitre libre, page)
- Évaluation 5 étoiles + avis rédigé
- Favoris, relectures, tags personnalisés
- Recherche/filtrage dans la bibliothèque
- Vue grille + liste switchable

**Exclus :**
- Statistiques et graphiques de lecture (module futur)
- Scan ISBN par caméra
- Partage de bibliothèque
- Import/export CSV
