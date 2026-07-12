import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfile, changePassword, uploadAvatar, deleteAvatar } from '../api/settings'

export function SettingsPage() {
  const { user, refreshUser } = useAuth()

  // Profile section
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // Password section
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  // Avatar section
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = user?.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  async function handleSaveProfile() {
    setSavingProfile(true)
    setProfileFeedback(null)
    try {
      await updateProfile({ name, email })
      await refreshUser()
      setProfileFeedback({ type: 'success', msg: 'Profil mis à jour.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      setProfileFeedback({ type: 'error', msg: msg.includes('409') ? 'Cet email est déjà utilisé.' : msg })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', msg: 'Les mots de passe ne correspondent pas.' })
      return
    }
    if (newPassword === currentPassword) {
      setPasswordFeedback({ type: 'error', msg: 'Le nouveau mot de passe doit être différent de l\'actuel.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', msg: 'Le nouveau mot de passe doit faire au moins 8 caractères.' })
      return
    }
    setSavingPassword(true)
    setPasswordFeedback(null)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordFeedback({ type: 'success', msg: 'Mot de passe changé.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      setPasswordFeedback({ type: 'error', msg: msg.includes('400') ? 'Mot de passe actuel incorrect.' : msg })
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setAvatarFeedback({ type: 'error', msg: "L'image ne doit pas dépasser 5 Mo." })
      return
    }
    setAvatarFeedback(null)
    try {
      await uploadAvatar(file)
      await refreshUser()
      setAvatarFeedback({ type: 'success', msg: 'Photo mise à jour.' })
    } catch {
      setAvatarFeedback({ type: 'error', msg: "Erreur lors de l'upload." })
    }
  }

  async function handleDeleteAvatar() {
    setAvatarFeedback(null)
    try {
      await deleteAvatar()
      await refreshUser()
      setAvatarFeedback({ type: 'success', msg: 'Photo supprimée.' })
    } catch {
      setAvatarFeedback({ type: 'error', msg: 'Erreur lors de la suppression.' })
    }
  }

  return (
    <div className="settings-page">
      <h1 className="settings-title">Paramètres</h1>

      {/* Avatar */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">Photo de profil</div>
        <div className="settings-avatar-section">
          <div className="settings-avatar" onClick={() => fileInputRef.current?.click()}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="Avatar" />
              : initials}
          </div>
          <div className="settings-avatar-actions">
            <button
              className="btn btn-secondary"
              style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              onClick={() => fileInputRef.current?.click()}
            >
              Changer la photo
            </button>
            {user?.avatarUrl && (
              <button
                className="btn btn-ghost btn-ghost--danger"
                style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                onClick={handleDeleteAvatar}
              >
                Supprimer la photo
              </button>
            )}
            <span className="settings-avatar-hint">JPEG, PNG ou WebP · 5 Mo max</span>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />
        {avatarFeedback && (
          <div className={`settings-feedback settings-feedback--${avatarFeedback.type}`}>{avatarFeedback.msg}</div>
        )}
      </div>

      {/* Informations */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">Informations</div>
        <div className="input-group">
          <label className="input-label" htmlFor="settings-name">Nom</label>
          <input id="settings-name" className="input-field" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="settings-email">Email</label>
          <input id="settings-email" className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {profileFeedback && (
          <div className={`settings-feedback settings-feedback--${profileFeedback.type}`}>{profileFeedback.msg}</div>
        )}
        <div className="settings-card-footer">
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '0.5rem 1.25rem' }}
            onClick={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Mot de passe */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">Mot de passe</div>
        <div className="input-group">
          <label className="input-label" htmlFor="settings-current-password">Mot de passe actuel</label>
          <input id="settings-current-password" className="input-field" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="settings-new-password">Nouveau mot de passe</label>
          <input id="settings-new-password" className="input-field" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="settings-confirm-password">Confirmer le nouveau mot de passe</label>
          <input id="settings-confirm-password" className="input-field" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </div>
        {passwordFeedback && (
          <div className={`settings-feedback settings-feedback--${passwordFeedback.type}`}>{passwordFeedback.msg}</div>
        )}
        <div className="settings-card-footer">
          <button
            className="btn btn-primary"
            style={{ width: 'auto', padding: '0.5rem 1.25rem' }}
            onClick={handleChangePassword}
            disabled={savingPassword}
          >
            {savingPassword ? 'Enregistrement…' : 'Changer le mot de passe'}
          </button>
        </div>
      </div>
    </div>
  )
}
