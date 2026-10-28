/**
 * Wrapper around fetch that automatically includes:
 * - X-CSRFToken header (read from the csrftoken cookie) for mutating requests
 * - X-Davai-Client-ID header for WebSocket client echo suppression
 * - credentials: 'same-origin' so session cookies are sent
 */

const CLIENT_ID_STORAGE_KEY = 'davai_client_id'

export function getClientId(): string {
  try {
    let id = sessionStorage.getItem(CLIENT_ID_STORAGE_KEY)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'client-' + Math.random().toString(36).substring(2, 15)
      sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, id)
    }
    return id
  } catch {
    return 'fallback-client'
  }
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)

  if (MUTATING_METHODS.has(method)) {
    const token = getCsrfToken()
    if (token) {
      headers.set('X-CSRFToken', token)
    }
    headers.set('X-Davai-Client-ID', getClientId())
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: 'same-origin',
  })
}
