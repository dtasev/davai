import { apiFetch } from '../utils/apiFetch'

export function startOidcLogin(): void {
  if (typeof window !== 'undefined') {
    window.location.assign('/api/auth/login')
  }
}

export async function handleOidcCallback(): Promise<string | null> {
  // Callback is handled server-side at /api/auth/oidc/callback
  return null
}

export function getStoredOidcToken(): string | null {
  return null
}

export async function logoutOidc(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Ignored
    }
    // Clean any legacy tokens from localStorage
    localStorage.removeItem('davai_oidc_access_token')
    localStorage.removeItem('davai_oidc_id_token')
    localStorage.removeItem('davai_oidc_refresh_token')
    sessionStorage.removeItem('davai_oidc_verifier')
    sessionStorage.removeItem('davai_oidc_state')
    window.location.assign('/')
  }
}
