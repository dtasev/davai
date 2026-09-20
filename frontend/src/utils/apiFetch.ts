/**
 * Wrapper around fetch that automatically includes:
 * - X-CSRFToken header (read from the csrftoken cookie) for mutating requests
 * - credentials: 'same-origin' so session cookies are sent
 */

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
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: 'same-origin',
  })
}
