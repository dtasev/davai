export interface OidcConfig {
  issuer: string
  clientId: string
  redirectUri: string
  scope: string
  authorizationEndpoint: string
  tokenEndpoint: string
}

export function getOidcConfig(): OidcConfig {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:6477'
  const issuer = `${origin}/authelia`
  return {
    issuer,
    clientId: 'davai',
    redirectUri: `${origin}/`,
    scope: 'openid profile email groups offline_access',
    authorizationEndpoint: `${issuer}/api/oidc/authorization`,
    tokenEndpoint: `${issuer}/api/oidc/token`,
  }
}

function generateRandomString(length: number = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const array = new Uint8Array(length)
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array)
  }
  return Array.from(array, byte => charset[byte % charset.length]).join('')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return verifier
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function startOidcLogin(): Promise<void> {
  const verifier = generateRandomString(64)
  const challenge = await generateCodeChallenge(verifier)
  const state = generateRandomString(32)

  sessionStorage.setItem('davai_oidc_verifier', verifier)
  sessionStorage.setItem('davai_oidc_state', state)

  const config = getOidcConfig()
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  })

  window.location.href = `${config.authorizationEndpoint}?${params.toString()}`
}

export async function handleOidcCallback(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const state = urlParams.get('state')

  if (!code) return null

  const savedState = sessionStorage.getItem('davai_oidc_state')
  const verifier = sessionStorage.getItem('davai_oidc_verifier')

  if (state && savedState && state !== savedState) {
    console.error('OIDC error: State parameter mismatch')
    return null
  }

  const config = getOidcConfig()
  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier || '',
  })

  try {
    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    if (!response.ok) {
      console.error('Failed to exchange authorization code for OIDC token', await response.text())
      return null
    }

    const data = await response.json()
    if (data.access_token) {
      localStorage.setItem('davai_oidc_access_token', data.access_token)
      if (data.id_token) {
        localStorage.setItem('davai_oidc_id_token', data.id_token)
      }
      if (data.refresh_token) {
        localStorage.setItem('davai_oidc_refresh_token', data.refresh_token)
      }

      sessionStorage.removeItem('davai_oidc_verifier')
      sessionStorage.removeItem('davai_oidc_state')

      // Clean the ?code=...&state=... from URL without reloading
      const cleanUrl = window.location.origin + window.location.pathname
      window.history.replaceState({}, document.title, cleanUrl)

      return data.access_token
    }
  } catch (err) {
    console.error('OIDC token exchange error:', err)
  }

  return null
}

export function getStoredOidcToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('davai_oidc_access_token')
}

export function logoutOidc(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('davai_oidc_access_token')
  localStorage.removeItem('davai_oidc_id_token')
  localStorage.removeItem('davai_oidc_refresh_token')
  sessionStorage.removeItem('davai_oidc_verifier')
  sessionStorage.removeItem('davai_oidc_state')
}
