import React, { createContext, useContext, useState, useEffect } from 'react'
import { Project, UserProfile, APIKeyItem, BackendInfo } from '../types'
import { GeneratedKey } from '../components/Settings/SettingsView'

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

  const loadUserData = async (keyToUse: string) => {
    if (!keyToUse.trim()) {
      setUserProfile(null)
      setApiKeys([])
      return
    }

    setLoadingAuth(true)
    setAuthError(null)
    try {
      const [meRes, keysRes] = await Promise.all([
        fetch('/api/auth/me', { headers: { 'X-API-Key': keyToUse } }),
        fetch('/api/auth/keys', { headers: { 'X-API-Key': keyToUse } })
      ])

      if (meRes.ok) {
        const meData = await meRes.json()
        setUserProfile(meData)
        localStorage.setItem('davai_api_key', keyToUse)

        if (keysRes.ok) {
          const keysData = await keysRes.json()
          setApiKeys(keysData)
        }
      } else {
        setUserProfile(null)
        setAuthError('Authentication failed: Invalid API key')
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
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ name })
      })

      if (res.ok) {
        const data: GeneratedKey = await res.json()
        const keysRes = await fetch('/api/auth/keys', {
          headers: { 'X-API-Key': apiKey }
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
        headers: { 'X-API-Key': apiKey }
      })

      if (res.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId))
      }
    } catch {
      // ignore
    }
  }

  const fetchProjects = async () => {
    setLoadingProjects(true)
    try {
      const res = await fetch('/api/projects')
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
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ key, name, description })
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Failed to create project')
    }

    await fetchProjects()
  }

  useEffect(() => {
    checkBackend()
    fetchProjects()
    loadUserData(apiKey)
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
