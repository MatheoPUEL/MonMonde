# Import / Export — Design Spec

**Date:** 2026-06-14  
**Status:** Approved

---

## Objectif

Permettre à l'utilisateur d'exporter et d'importer les données de chaque module (Journal, Reading, Routines, Citations) en JSON, ainsi qu'un export global couvrant tous les modules.

---

## Architecture

### Approche

Routes backend dédiées, protégées par le middleware auth existant. L'UI déclenche un téléchargement (export) ou envoie un fichier (import). La logique de sérialisation et de merge vit entièrement côté backend.

### Nouvelles routes

```
GET  /api/export/all          → JSON global
GET  /api/export/journal
GET  /api/export/reading
GET  /api/export/routines
GET  /api/export/citations

POST /api/import/journal
POST /api/import/reading
POST /api/import/routines
POST /api/import/citations
```

Toutes les routes passent par le middleware `requireAuth` existant.

---

## Format JSON exporté

Chaque fichier d'export contient un en-tête de métadonnées :

```json
{
  "exportedAt": "2026-06-14T10:00:00.000Z",
  "version": "1",
  "module": "journal",
  "entries": [ ... ]
}
```

Pour l'export global (`/api/export/all`) :

```json
{
  "exportedAt": "2026-06-14T10:00:00.000Z",
  "version": "1",
  "module": "all",
  "journal": { "entries": [...] },
  "reading": { "books": [...] },
  "routines": { "routines": [...] },
  "citations": { "citations": [...] }
}
```

Les IDs originaux sont inclus dans l'export pour référence mais **ne sont pas réutilisés** à l'import — de nouveaux `cuid()` sont générés pour éviter les conflits.

### Données imbriquées incluses

| Module    | Données principales | Données imbriquées            |
|-----------|--------------------|-----------------------------|
| Journal   | JournalEntry       | tags                        |
| Reading   | Book               | tags, notes (avec leurs tags) |
| Routines  | Routine            | completions                 |
| Citations | Citation           | tags                        |

---

## Logique d'import (merge)

Comportement : **fusion** — les données importées s'ajoutent aux données existantes. Les doublons sont ignorés silencieusement.

### Règles de déduplication par module

| Module    | Critère de doublon              |
|-----------|---------------------------------|
| Journal   | `title` + `createdAt` (même jour) |
| Reading   | `isbn` si présent, sinon `title` + `author` |
| Routines  | `name` + `rruleString`          |
| Citations | `text` + `author`               |

### Traitement transactionnel

Chaque import s'exécute dans une **transaction Prisma** : si une erreur survient à mi-parcours, toutes les insertions sont rollback (tout ou rien).

### Réponse de l'endpoint import

```json
{
  "imported": 12,
  "skipped": 3,
  "total": 15
}
```

---

## Contraintes techniques

- **Limite de taille fichier** : 10 MB (configuré via Express `json({ limit: '10mb' })`)
- **Content-Type import** : `application/json`
- **Nom des fichiers export** : `{module}-YYYY-MM-DD.json` (ex: `journal-2026-06-14.json`), `monmonde-YYYY-MM-DD.json` pour le global

---

## UI

### Par module (Journal, Reading, Routines, Citations)

Dans le header de chaque page de module, deux icônes discrets à droite du titre :
- **Icône download** → déclenche `GET /api/export/{module}` et télécharge le fichier JSON
- **Icône upload** → ouvre un `<input type="file" accept=".json">` caché

Flux d'import :
1. L'utilisateur sélectionne un fichier JSON
2. Le frontend parse le JSON localement et affiche une modale : "X éléments trouvés dans ce fichier. Importer ?"
3. L'utilisateur confirme → `POST /api/import/{module}` avec le JSON en body
4. Le backend renvoie `{imported, skipped, total}` → toast "Import réussi — X ajoutés, Y ignorés"

### Dashboard (export global)

Un bouton "Exporter tout" dans le Dashboard (section sous les ModuleCards existantes), qui déclenche `GET /api/export/all` et télécharge `monmonde-YYYY-MM-DD.json`.

---

## Gestion des erreurs

| Cas                         | Comportement                                  |
|-----------------------------|-----------------------------------------------|
| JSON malformé               | 400 `{ error: "Invalid JSON format" }`        |
| `version` manquante/inconnue | 400 `{ error: "Unsupported export version" }` |
| Fichier > 10 MB             | 413 `{ error: "File too large" }`             |
| Erreur DB partielle         | Rollback complet, 500 avec message            |
| Module inconnu              | 404                                           |

Toast UI en cas d'erreur : message d'erreur lisible (pas de stacktrace).

---

## Fichiers à créer / modifier

### Backend

- `src/routes/export/index.ts` — routeur export
- `src/routes/export/exportAll.ts`
- `src/routes/export/exportJournal.ts`
- `src/routes/export/exportReading.ts`
- `src/routes/export/exportRoutines.ts`
- `src/routes/export/exportCitations.ts`
- `src/routes/import/index.ts` — routeur import
- `src/routes/import/importJournal.ts`
- `src/routes/import/importReading.ts`
- `src/routes/import/importRoutines.ts`
- `src/routes/import/importCitations.ts`
- `src/app.ts` — enregistrer les nouveaux routeurs

### Frontend

- `src/api/export.ts` — fonctions `exportModule(module)` et `exportAll()`
- `src/api/import.ts` — fonction `importModule(module, file)`
- `src/components/ui/ImportExportButtons.tsx` — composant réutilisable (download + upload icons)
- `src/components/ui/ImportResultModal.tsx` — modale de confirmation/résultat
- Modifier chaque page de module pour inclure `<ImportExportButtons module="journal" />`
- Modifier `Dashboard.tsx` pour ajouter le bouton "Exporter tout"
