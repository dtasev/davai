import React, { useEffect, useState } from 'react'
import {
  Project,
  Sprint,
  Release,
  WorkItem,
  UserProfile,
  APIKeyItem,
  BackendInfo
} from './types'
import { Header } from './components/Header'
import { DashboardView } from './components/Dashboard/DashboardView'
import { ProjectDetailView } from './components/ProjectDetail/ProjectDetailView'
import { SettingsView, GeneratedKey } from './components/Settings/SettingsView'
import { SprintDetailModal } from './components/Modals/SprintDetailModal'
import { ReleaseDetailModal } from './components/Modals/ReleaseDetailModal'
import { WorkItemDetailModal } from './components/Modals/WorkItemDetailModal'

const DEFAULT_DEV_KEY = 'dav_live_7186ea3e7362a9f418e5332be398dc7c6132bdfd'

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard')
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'error'>('checking')
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null)
  const [helloMessage, setHelloMessage] = useState<string>('')
  const [latency, setLatency] = useState<number | null>(null)

  // Auth & API Key
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('davai_api_key') || DEFAULT_DEV_KEY
  })
  const [apiKeyInput, setApiKeyInput] = useState<string>(apiKey)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([])
  const [loadingAuth, setLoadingAuth] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Projects & Navigation
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null)
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true)

  // Detail data for selected project
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false)

  // Modals for details view
  const [activeSprintDetail, setActiveSprintDetail] = useState<Sprint | null>(null)
  const [activeReleaseDetail, setActiveReleaseDetail] = useState<Release | null>(null)
  const [activeWorkItemDetail, setActiveWorkItemDetail] = useState<WorkItem | null>(null)

  // -------------------------------------------------------------------------
  // Backend & Auth
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Projects & Project Details
  // -------------------------------------------------------------------------
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

  const fetchProjectDetails = async (projKey: string) => {
    setLoadingDetails(true)
    try {
      const [sprintsRes, releasesRes, itemsRes] = await Promise.all([
        fetch(`/api/projects/${projKey}/sprints`),
        fetch(`/api/projects/${projKey}/releases`),
        fetch(`/api/work-items?project_key=${projKey}`)
      ])

      if (sprintsRes.ok) {
        setSprints(await sprintsRes.json())
      }
      if (releasesRes.ok) {
        setReleases(await releasesRes.json())
      }
      if (itemsRes.ok) {
        setWorkItems(await itemsRes.json())
      }
    } catch {
      // ignore
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleSelectProject = (key: string) => {
    setSelectedProjectKey(key)
    fetchProjectDetails(key)
  }

  const handleClearProject = () => {
    setSelectedProjectKey(null)
    setSprints([])
    setReleases([])
    setWorkItems([])
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

  const handleCreateSprint = async (
    name: string,
    description: string,
    releaseId: number | null,
    startDate: string | null,
    endDate: string | null
  ) => {
    if (!selectedProjectKey) return

    const res = await fetch(`/api/projects/${selectedProjectKey}/sprints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        name,
        description,
        release_id: releaseId,
        start_date: startDate,
        end_date: endDate
      })
    })

    if (res.ok) {
      await fetchProjectDetails(selectedProjectKey)
    }
  }

  const handleCreateRelease = async (
    name: string,
    description: string,
    startDate: string | null,
    endDate: string | null
  ) => {
    if (!selectedProjectKey) return

    const res = await fetch(`/api/projects/${selectedProjectKey}/releases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        name,
        description,
        start_date: startDate,
        end_date: endDate
      })
    })

    if (res.ok) {
      await fetchProjectDetails(selectedProjectKey)
    }
  }

  const handleCreateWorkItem = async (data: {
    title: string
    descr: string
    status: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    parent_key?: string | null
    sprint_id?: number | null
    release_id?: number | null
  }) => {
    if (!selectedProjectKey) return

    const res = await fetch('/api/work-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        ...data,
        project_key: selectedProjectKey
      })
    })

    if (res.ok) {
      await fetchProjectDetails(selectedProjectKey)
      await fetchProjects() // update item_count
    }
  }

  const handleUpdateStatus = async (key: string, newStatus: string) => {
    const res = await fetch(`/api/work-items/${key}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ status: newStatus })
    })

    if (res.ok) {
      const updated: WorkItem = await res.json()
      setWorkItems(prev => prev.map(item => (item.key === key ? updated : item)))
      if (activeWorkItemDetail?.key === key) {
        setActiveWorkItemDetail(updated)
      }
    }
  }

  const handleUpdateContext = async (key: string, contextText: string) => {
    const res = await fetch(`/api/work-items/${key}/context`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ t: contextText })
    })

    if (res.ok) {
      const contextData = await res.json()
      setWorkItems(prev =>
        prev.map(item =>
          item.key === key ? { ...item, context: contextData } : item
        )
      )
      if (activeWorkItemDetail?.key === key) {
        setActiveWorkItemDetail(prev =>
          prev ? { ...prev, context: contextData } : null
        )
      }
    }
  }

  const handleAddProgress = async (
    key: string,
    entry: { t: string; proof: string; status: string }
  ) => {
    const res = await fetch(`/api/work-items/${key}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(entry)
    })

    if (res.ok) {
      const newProgress = await res.json()
      setWorkItems(prev =>
        prev.map(item =>
          item.key === key
            ? { ...item, progress: [...(item.progress || []), newProgress] }
            : item
        )
      )
      if (activeWorkItemDetail?.key === key) {
        setActiveWorkItemDetail(prev =>
          prev
            ? { ...prev, progress: [...(prev.progress || []), newProgress] }
            : null
        )
      }
    }
  }

  useEffect(() => {
    checkBackend()
    fetchProjects()
    loadUserData(apiKey)
  }, [])

  const selectedProject =
    projects.find(p => p.key === selectedProjectKey) || null

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedProject={selectedProject}
        onClearProject={handleClearProject}
        userProfile={userProfile}
        apiKey={apiKey}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'settings' ? (
          <SettingsView
            apiKey={apiKey}
            apiKeyInput={apiKeyInput}
            setApiKeyInput={setApiKeyInput}
            handleSaveApiKey={handleSaveApiKey}
            userProfile={userProfile}
            apiKeys={apiKeys}
            loadingAuth={loadingAuth}
            authError={authError}
            handleRevokeKey={handleRevokeKey}
            onCreateKey={handleCreateKey}
          />
        ) : selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            sprints={sprints}
            releases={releases}
            workItems={workItems}
            loading={loadingDetails}
            onBack={handleClearProject}
            onRefresh={() => fetchProjectDetails(selectedProject.key)}
            onSelectSprint={sprint => setActiveSprintDetail(sprint)}
            onSelectRelease={release => setActiveReleaseDetail(release)}
            onSelectWorkItem={item => setActiveWorkItemDetail(item)}
            onCreateSprint={handleCreateSprint}
            onCreateRelease={handleCreateRelease}
            onCreateWorkItem={handleCreateWorkItem}
          />
        ) : (
          <DashboardView
            projects={projects}
            loading={loadingProjects}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            backendInfo={backendInfo}
            helloMessage={helloMessage}
            backendStatus={backendStatus}
            latency={latency}
            onRefresh={fetchProjects}
          />
        )}
      </main>

      {/* Detail Modals */}
      {activeSprintDetail && (
        <SprintDetailModal
          sprint={activeSprintDetail}
          releases={releases}
          workItems={workItems}
          onClose={() => setActiveSprintDetail(null)}
          onSelectWorkItem={item => {
            setActiveSprintDetail(null)
            setActiveWorkItemDetail(item)
          }}
        />
      )}

      {activeReleaseDetail && (
        <ReleaseDetailModal
          release={activeReleaseDetail}
          sprints={sprints}
          workItems={workItems}
          onClose={() => setActiveReleaseDetail(null)}
          onSelectWorkItem={item => {
            setActiveReleaseDetail(null)
            setActiveWorkItemDetail(item)
          }}
          onSelectSprint={sprint => {
            setActiveReleaseDetail(null)
            setActiveSprintDetail(sprint)
          }}
        />
      )}

      {activeWorkItemDetail && (
        <WorkItemDetailModal
          item={activeWorkItemDetail}
          sprints={sprints}
          releases={releases}
          statuses={selectedProject?.statuses || []}
          onClose={() => setActiveWorkItemDetail(null)}
          onUpdateStatus={handleUpdateStatus}
          onUpdateContext={handleUpdateContext}
          onAddProgress={handleAddProgress}
        />
      )}
    </div>
  )
}
