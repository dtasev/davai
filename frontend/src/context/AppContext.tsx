import React, { createContext, useContext, useState, useEffect } from 'react'
import { Project, UserProfile, APIKeyItem, BackendInfo } from '../types'
import { GeneratedKey } from '../components/Settings/SettingsView'
import { handleOidcCallback, getStoredOidcToken, startOidcLogin, logoutOidc } from '../auth/oidc'
import { apiFetch } from '../utils/apiFetch'

interface AppContextType {
  // Auth & API Key
  userProfile: UserProfile | null
  apiKeys: APIKeyItem[]
  loadingAuth: boolean
  authError: string | null
  oidcToken: string | null
  loginWithOidc: () => Promise<void>
  logout: () => void
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

  const loadUserData = async () => {
    setLoadingAuth(true)
    setAuthError(null)
    try {
      // 1. Fetch /api/auth/me with session cookie
      const meRes = await apiFetch('/api/auth/me', {
        credentials: 'same-origin'
      })

      if (meRes.ok) {
        const meData = await meRes.json()
        setUserProfile(meData)

        const keysRes = await apiFetch('/api/auth/keys', {
          credentials: 'same-origin'
        })
        if (keysRes.ok) {
          const keysData = await keysRes.json()
          setApiKeys(keysData)
        }
      } else {
        setUserProfile(null)
        setApiKeys([])
      }
    } catch (err: any) {
      setAuthError(`Connection error: ${err.message}`)
      setUserProfile(null)
      setApiKeys([])
    } finally {
      setLoadingAuth(false)
    }
  }

  const handleCreateKey = async (name: string): Promise<GeneratedKey | null> => {
    try {
      const res = await apiFetch('/api/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name })
      })

      if (res.ok) {
        const data: GeneratedKey = await res.json()
        const keysRes = await apiFetch('/api/auth/keys', {
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
      const res = await apiFetch(`/api/auth/keys/${keyId}`, {
        method: 'DELETE',
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
    startOidcLogin()
  }

  const logout = async () => {
    await logoutOidc()
    localStorage.removeItem('davai_api_key')
    setOidcToken(null)
    setUserProfile(null)
    setApiKeys([])
  }

  const fetchProjects = async () => {
    setLoadingProjects(true)
    try {
      const res = await apiFetch('/api/projects', {
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
    const res = await apiFetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    // Proactively clean up any stale legacy browser API key
    localStorage.removeItem('davai_api_key')

    const init = async () => {
      // 1. Process OIDC callback if returning from login (?code=...)
      const exchangedToken = await handleOidcCallback()
      if (exchangedToken) {
        setOidcToken(exchangedToken)
      }

      checkBackend()
      fetchProjects()
      loadUserData()
    }

    init()
  }, [])

  return (
    <AppContext.Provider
      value={{
        userProfile,
        apiKeys,
        loadingAuth,
        authError,
        oidcToken,
        loginWithOidc,
        logout,
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

export function useOptionalApp() {
  return useContext(AppContext)
}
