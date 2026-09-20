import React, { createContext, useContext, useState, useEffect } from 'react'
import { Project, UserProfile, APIKeyItem, BackendInfo } from '../types'
import { GeneratedKey } from '../components/Settings/SettingsView'
import { handleOidcCallback, getStoredOidcToken, startOidcLogin, logoutOidc } from '../auth/oidc'

export const DEFAULT_DEV_KEY = 'dav_live_7186ea3e7362a9f418e5332be398dc7c6132bdfd'

interface AppContextType {
  // Auth & API Key
  apiKey: string
  apiKeyInput: string
  setApiKeyInput: (val: string) => void
  userProfile: UserProfile | null
  apiKeys: APIKeyItem[]
  loadingAuth: boolean
  authError: string | null
  oidcToken: string | null
  loginWithOidc: () => Promise<void>
  logout: () => void
  handleSaveApiKey: () => void
  handleCreateKey: (name: string) => Promise<GeneratedKey | null>
  handleRevokeKey: (id: number) => Promise<void>

  // Backend Info
  backendStatus: 'checking' | 'online' | 'error'
  backendInfo: BackendInfo | null
  helloMessage: string
  latency: number | null
  checkBackend: () => Promise<void>

  // Projects
  projects: Project[]
  loadingProjects: boolean
  fetchProjects: () => Promise<void>
  handleCreateProject: (key: string, name: string, description: string) => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('davai_api_key') || DEFAULT_DEV_KEY
  })
  const [apiKeyInput, setApiKeyInput] = useState<string>(apiKey)
  const [oidcToken, setOidcToken] = useState<string | null>(() => getStoredOidcToken())
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([])
  const [loadingAuth, setLoadingAuth] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'error'>('checking')
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null)
  const [helloMessage, setHelloMessage] = useState<string>('')
  const [latency, setLatency] = useState<number | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true)

  const getAuthHeaders = (extraHeaders?: Record<string, string>): Record<string, string> => {
    const headers: Record<string, string> = { ...extraHeaders }
    const token = getStoredOidcToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    } else if (apiKey) {
      headers['X-API-Key'] = apiKey
    }
    return headers
  }

  const checkBackend = async () => {
    setBackendStatus('checking')
    const start = performance.now()
    try {
      const [helloRes, infoRes] = await Promise.all([
        fetch('/api/hello'),
        fetch('/api/info')
      ])

      if (helloRes.ok && infoRes.ok) {
        const helloData = await helloRes.json()
        const infoData = await infoRes.json()
        setLatency(Math.round(performance.now() - start))
        setHelloMessage(helloData.message)
        setBackendInfo(infoData)
        setBackendStatus('online')
      } else {
        setBackendStatus('error')
      }
    } catch {
      setBackendStatus('error')
    }
  }

  const loadUserData = async (keyToUse?: string) => {
    setLoadingAuth(true)
    setAuthError(null)
    try {
      const token = getStoredOidcToken()
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      } else if (keyToUse && keyToUse.trim()) {
        headers['X-API-Key'] = keyToUse.trim()
      } else if (apiKey && apiKey.trim()) {
        headers['X-API-Key'] = apiKey.trim()
      }

      // 1. Fetch /api/auth/me with Bearer token, API key, or cookie credentials
      let meRes = await fetch('/api/auth/me', {
        headers,
        credentials: 'same-origin'
      })

      // 2. If key failed with 401 and we passed a key, retry without the key to let session authenticate
      if (meRes.status === 401 && headers['X-API-Key']) {
        const sessionRes = await fetch('/api/auth/me', {
          credentials: 'same-origin'
        })
        if (sessionRes.ok) {
          meRes = sessionRes
          localStorage.removeItem('davai_api_key')
          setApiKey('')
          setApiKeyInput('')
        }
      }

      if (meRes.ok) {
        const meData = await meRes.json()
        setUserProfile(meData)
        if (keyToUse && keyToUse.trim() && headers['X-API-Key']) {
          localStorage.setItem('davai_api_key', keyToUse.trim())
        }

        const keysRes = await fetch('/api/auth/keys', {
          headers: getAuthHeaders(),
          credentials: 'same-origin'
        })
        if (keysRes.ok) {
          const keysData = await keysRes.json()
          setApiKeys(keysData)
        }
      } else {
        setUserProfile(null)
        setAuthError('Authentication required: please log in or provide a valid API key.')
      }
    } catch (err: any) {
      setAuthError(`Connection error: ${err.message}`)
      setUserProfile(null)
    } finally {
      setLoadingAuth(false)
    }
  }

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim()
    setApiKey(trimmed)
    loadUserData(trimmed)
  }

  const handleCreateKey = async (name: string): Promise<GeneratedKey | null> => {
    try {
      const res = await fetch('/api/auth/keys', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'same-origin',
        body: JSON.stringify({ name })
      })

      if (res.ok) {
        const data: GeneratedKey = await res.json()
        const keysRes = await fetch('/api/auth/keys', {
          headers: getAuthHeaders(),
          credentials: 'same-origin'
        })
        if (keysRes.ok) {
          setApiKeys(await keysRes.json())
        }
        return data
      }
    } catch {
      // ignore
    }
    return null
  }

  const handleRevokeKey = async (keyId: number) => {
    if (
      !confirm(
        'Are you sure you want to revoke this API key? Applications using it will lose access immediately.'
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/auth/keys/${keyId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      })

      if (res.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId))
      }
    } catch {
      // ignore
    }
  }

  const loginWithOidc = async () => {
    await startOidcLogin()
  }

  const logout = () => {
    logoutOidc()
    setOidcToken(null)
    setUserProfile(null)
    setApiKeys([])
  }

  const fetchProjects = async () => {
    setLoadingProjects(true)
    try {
      const res = await fetch('/api/projects', {
        headers: getAuthHeaders(),
        credentials: 'same-origin'
      })
      if (res.ok) {
        const data: Project[] = await res.json()
        setProjects(data)
      }
    } catch {
      // ignore
    } finally {
      setLoadingProjects(false)
    }
  }

  const handleCreateProject = async (
    key: string,
    name: string,
    description: string
  ) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'same-origin',
      body: JSON.stringify({ key, name, description })
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Failed to create project')
    }

    await fetchProjects()
  }

  useEffect(() => {
    const init = async () => {
      // 1. Process OIDC callback if returning from login (?code=...)
      const exchangedToken = await handleOidcCallback()
      if (exchangedToken) {
        setOidcToken(exchangedToken)
      }

      checkBackend()
      fetchProjects()
      loadUserData(apiKey)
    }

    init()
  }, [])

  return (
    <AppContext.Provider
      value={{
        apiKey,
        apiKeyInput,
        setApiKeyInput,
        userProfile,
        apiKeys,
        loadingAuth,
        authError,
        oidcToken,
        loginWithOidc,
        logout,
        handleSaveApiKey,
        handleCreateKey,
        handleRevokeKey,
        backendStatus,
        backendInfo,
        helloMessage,
        latency,
        checkBackend,
        projects,
        loadingProjects,
        fetchProjects,
        handleCreateProject
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
