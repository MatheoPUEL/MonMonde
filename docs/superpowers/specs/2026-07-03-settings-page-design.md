# Settings Page Design

**Date:** 2026-07-03
**Status:** Approved

## Overview

A `/settings` page allowing the authenticated user to update their profile picture, name, email, and password. Accessible via a link in the sidebar footer.

## Scope

- Upload/remove profile avatar (photo or initials fallback)
- Edit name and email
- Change password (requires current password)

Out of scope: interface preferences, themes, language settings.

## Backend

### Schema change
Add `avatarUrl String?` to the `User` model in `prisma/schema.prisma`. Run a new migration.

### New endpoints (all require auth middleware)

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/auth/me` | Update name and/or email |
| `POST` | `/api/auth/me/password` | Change password (requires `currentPassword`, `newPassword`) |
| `POST` | `/api/auth/me/avatar` | Upload avatar image via multer |
| `DELETE` | `/api/auth/me/avatar` | Remove avatar (sets `avatarUrl` to null) |

### Avatar storage
Reuse the existing multer setup from `backend/src/lib/upload.ts`. Store files in `/uploads/avatars/<userId>.<ext>`. Serve statically via the existing `/uploads` static route. Max 5MB, JPEG/PNG/WebP.

### `GET /api/auth/me` update
Already exists — ensure it returns `avatarUrl` in the response.

### Password change logic
1. Fetch user from DB
2. Verify `currentPassword` with `bcrypt.compare`
3. If invalid → 400 error
4. Hash `newPassword` with bcrypt (12 rounds)
5. Update user in DB

## Frontend

### AuthContext changes
- Add `avatarUrl: string | null` to the `User` interface
- Add `refreshUser()` method that re-fetches `GET /api/auth/me` and updates state
- `avatarUrl` is populated from the `/me` response on login and refresh

### New API module
`frontend/src/api/settings.ts` with:
- `updateProfile({ name, email })` → `PATCH /api/auth/me`
- `changePassword({ currentPassword, newPassword })` → `POST /api/auth/me/password`
- `uploadAvatar(file: File)` → `POST /api/auth/me/avatar` (multipart/form-data)
- `deleteAvatar()` → `DELETE /api/auth/me/avatar`

### SettingsPage component
`frontend/src/pages/SettingsPage.tsx` — single page with three glass-card sections:

**Section 1 — Avatar**
- Circle displaying avatar image, or initials fallback (same logic as sidebar)
- Click on circle → file input picker → upload on selection → `refreshUser()`
- "Supprimer la photo" button, shown only when `avatarUrl` is set

**Section 2 — Informations**
- Pre-filled `Nom` and `Email` inputs
- "Sauvegarder" button → calls `updateProfile` → `refreshUser()`
- Inline success/error feedback

**Section 3 — Mot de passe**
- Three fields: current password, new password, confirm new password
- Frontend validation: new ≠ current, confirm matches new
- "Changer le mot de passe" button → calls `changePassword`
- Inline success/error feedback

### Routing
Add `<Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />` in `App.tsx`.

### Sidebar link
In `Sidebar.tsx` footer area: add a `⚙ Paramètres` link (`<Link to="/settings">`) next to or below the user info block. Active state when on `/settings`.

### Sidebar avatar display
Update the `sidebar-avatar` element: if `user.avatarUrl` is set, render `<img>` instead of initials text. Same circle styling.

## Data flow

```
User clicks "Sauvegarder" (profile)
  → settingsApi.updateProfile()
  → PATCH /api/auth/me
  → DB updated
  → authContext.refreshUser()  [re-fetches /api/auth/me]
  → AuthContext state updated
  → Sidebar re-renders with new name/avatar
```

## Error handling

- Network errors: show inline error message below the relevant section
- 400 (wrong current password): "Mot de passe actuel incorrect"
- 409 (email already taken): "Cet email est déjà utilisé"
- File too large: client-side check before upload, error if > 5MB
