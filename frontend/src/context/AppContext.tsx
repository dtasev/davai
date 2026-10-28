import React, { createContext, useContext, useState, useEffect } from 'react'
import { Project, UserProfile, APIKeyItem, BackendInfo, TrackedItem, TrackedItemType } from '../types'
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

  // Tracked Items
  trackedItems: TrackedItem[]
  loadingTrackedItems: boolean
  isTrackingDrawerOpen: boolean
  setIsTrackingDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>
  fetchTrackedItems: () => Promise<void>
  trackItem: (
    item: { key: string; title?: string; status?: string; project_key?: string },
    type?: TrackedItemType
  ) => Promise<void>
  untrackItem: (key: string) => Promise<void>
  toggleTrackItem: (
    item: { key: string; title?: string; status?: string; project_key?: string },
    type?: TrackedItemType
  ) => Promise<void>
  clearDoneTrackedItems: (type: TrackedItemType) => Promise<void>
  isTracked: (key: string) => boolean
  updateTrackedItemStatus: (key: string, newStatus: string) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [oidcToken, setOidcToken] = useState<string | null>(() => getStoredOidcToken())
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([])
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true)
  const [authError, setAuthError] = useState<string | null>(null)

  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'error'>('checking')
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null)
  const [helloMessage, setHelloMessage] = useState<string>('')
  const [latency, setLatency] = useState<number | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true)

  const [trackedItems, setTrackedItems] = useState<TrackedItem[]>([])
  const [loadingTrackedItems, setLoadingTrackedItems] = useState<boolean>(false)
  const [isTrackingDrawerOpen, setIsTrackingDrawerOpenState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('davai_tracking_drawer_open') === 'true'
    } catch {
      return false
    }
  })

  const setIsTrackingDrawerOpen: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    setIsTrackingDrawerOpenState(prev => {
      const next = typeof value === 'function' ? (value as any)(prev) : value
      try {
        localStorage.setItem('davai_tracking_drawer_open', String(next))
      } catch {}
      return next
    })
  }

  const fetchTrackedItems = async () => {
    setLoadingTrackedItems(true)
    try {
      const res = await apiFetch('/api/tracked-items', { credentials: 'same-origin' })
      if (res.ok) {
        const data: TrackedItem[] = await res.json()
        setTrackedItems(data)
      }
    } catch {
      // ignore
    } finally {
      setLoadingTrackedItems(false)
    }
  }

  const isTracked = (key: string): boolean => {
    return trackedItems.some(i => i.key.toUpperCase() === key.toUpperCase())
  }

  const trackItem = async (
    item: { key: string; title?: string; status?: string; project_key?: string },
    type?: TrackedItemType
  ) => {
    const resolvedType: TrackedItemType =
      type ||
      (item.key.includes('-SUP-')
        ? 'user-support'
        : item.key.startsWith('INC-')
        ? 'incident'
        : 'work-item')

    const optimistic: TrackedItem = {
      key: item.key,
      title: item.title || item.key,
      status: item.status || 'todo',
      project_key: item.project_key || '',
      type: resolvedType,
      created_at: new Date().toISOString()
    }

    setTrackedItems(prev =>
      prev.some(i => i.key.toUpperCase() === item.key.toUpperCase())
        ? prev
        : [optimistic, ...prev]
    )

    try {
      const res = await apiFetch('/api/tracked-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ key: item.key })
      })
      if (res.ok) {
        const saved: TrackedItem = await res.json()
        setTrackedItems(prev =>
          prev.map(i => (i.key.toUpperCase() === item.key.toUpperCase() ? saved : i))
        )
      }
    } catch {
      // retain optimistic state
    }
  }

  const untrackItem = async (key: string) => {
    setTrackedItems(prev => prev.filter(i => i.key.toUpperCase() !== key.toUpperCase()))
    try {
      await apiFetch(`/api/tracked-items/${key}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      })
    } catch {
      // ignore
    }
  }

  const toggleTrackItem = async (
    item: { key: string; title?: string; status?: string; project_key?: string },
    type?: TrackedItemType
  ) => {
    if (isTracked(item.key)) {
      await untrackItem(item.key)
    } else {
      await trackItem(item, type)
    }
  }

  const clearDoneTrackedItems = async (type: TrackedItemType) => {
    setTrackedItems(prev =>
      prev.filter(
        i => !(i.type === type && (i.status || '').toLowerCase() === 'done')
      )
    )
    try {
      await apiFetch(`/api/tracked-items/clear-done/${type}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      })
    } catch {
      // ignore
    }
  }

  const updateTrackedItemStatus = (key: string, newStatus: string) => {
    setTrackedItems(prev =>
      prev.map(i =>
        i.key.toUpperCase() === key.toUpperCase() ? { ...i, status: newStatus } : i
      )
    )
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

        const [keysRes] = await Promise.all([
          apiFetch('/api/auth/keys', {
            credentials: 'same-origin'
          }),
          fetchProjects(),
          fetchTrackedItems()
        ])
        if (keysRes.ok) {
          const keysData = await keysRes.json()
          setApiKeys(keysData)
        }
      } else {
        setUserProfile(null)
        setApiKeys([])
        setProjects([])
        setLoadingProjects(false)
      }
    } catch (err: any) {
      setAuthError(`Connection error: ${err.message}`)
      setUserProfile(null)
      setApiKeys([])
      setProjects([])
      setLoadingProjects(false)
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
    setProjects([])
    setTrackedItems([])
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
        handleCreateProject,
        trackedItems,
        loadingTrackedItems,
        isTrackingDrawerOpen,
        setIsTrackingDrawerOpen,
        fetchTrackedItems,
        trackItem,
        untrackItem,
        toggleTrackItem,
        clearDoneTrackedItems,
        isTracked,
        updateTrackedItemStatus
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
