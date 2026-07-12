import { apiClient } from './client'

interface UserProfile {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

export async function updateProfile(data: { name?: string; email?: string }) {
  return apiClient<{ user: UserProfile }>('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiClient<{ ok: boolean }>('/api/auth/me/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function uploadAvatar(file: File) {
  const formData = new FormData()
  formData.append('avatar', file)
  return apiClient<{ user: UserProfile }>('/api/auth/me/avatar', {
    method: 'POST',
    body: formData,
  })
}

export async function deleteAvatar() {
  return apiClient<{ user: UserProfile }>('/api/auth/me/avatar', { method: 'DELETE' })
}
