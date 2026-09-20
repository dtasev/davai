import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react'
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { Project, Sprint, Release, WorkItem, ProgressEntry } from '../types'
import { useApp } from '../context/AppContext'
import { ProjectDetailView } from '../components/ProjectDetail/ProjectDetailView'
import { apiFetch } from '../utils/apiFetch'

export interface ProjectDetailOutletContext {
  project: Project
  sprints: Sprint[]
  releases: Release[]
  workItems: WorkItem[]
  setWorkItems: Dispatch<SetStateAction<WorkItem[]>>
  handleUpdateStatus: (key: string, newStatus: string) => Promise<void>
  handleUpdateContext: (key: string, contextText: string) => Promise<void>
  handleAddProgress: (
    key: string,
    entry: { summary: string; proof: string; status: string }
  ) => Promise<void>
  handleUpdateProgress: (
    key: string,
    progressId: number,
    entry: { summary?: string; proof?: string; status?: string }
  ) => Promise<ProgressEntry>
  handleDeleteProgress: (key: string, progressId: number) => Promise<void>
  handleDeleteSprint: (sprintId: number) => Promise<void>
  handleDeleteRelease: (releaseId: number) => Promise<void>
  handleDeleteWorkItem: (key: string) => Promise<void>
  handleUpdateSprint: (
    sprintId: number,
    data: { name?: string; description?: string; start_date?: string | null; end_date?: string | null }
  ) => Promise<Sprint>
  handleUpdateRelease: (
    releaseId: number,
    data: { name?: string; description?: string; start_date?: string | null; end_date?: string | null }
  ) => Promise<Release>
  handleUpdateWorkItemDetails: (
    key: string,
    data: {
      title?: string
      description?: string
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | string
      sprint_id?: number | null
      release_id?: number | null
      start_date?: string | null
      target_date?: string | null
    }
  ) => Promise<WorkItem>
}

export function ProjectDetailRoute() {
  const { projectKey } = useParams<{ projectKey: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { apiKey, projects, fetchProjects } = useApp()

  const [sprints, setSprints] = useState<Sprint[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [loadingDetails, setLoadingDetails] = useState(true)

  const currentProject = projects.find(p => p.key === projectKey?.toUpperCase()) || null

  const fetchDetails = useCallback(async () => {
    if (!projectKey) return
    setLoadingDetails(true)
    try {
      const [sprintsRes, releasesRes, itemsRes] = await Promise.all([
        apiFetch(`/api/projects/${projectKey}/sprints`),
        apiFetch(`/api/projects/${projectKey}/releases`),
        apiFetch(`/api/work-items?project_key=${projectKey}`)
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
  }, [projectKey])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  const handleCreateSprint = async (
    name: string,
    description: string,
    releaseId: number | null,
    startDate: string | null,
    endDate: string | null
  ) => {
    if (!projectKey) return
    const res = await apiFetch(`/api/projects/${projectKey}/sprints`, {
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
      await fetchDetails()
    }
  }

  const handleCreateRelease = async (
    name: string,
    description: string,
    startDate: string | null,
    endDate: string | null
  ) => {
    if (!projectKey) return
    const res = await apiFetch(`/api/projects/${projectKey}/releases`, {
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
      await fetchDetails()
    }
  }

  const handleCreateWorkItem = async (data: {
    title: string
    description: string
    status: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    parent_key?: string | null
    sprint_id?: number | null
    release_id?: number | null
  }) => {
    if (!projectKey) return
    const res = await apiFetch('/api/work-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        ...data,
        project_key: projectKey
      })
    })

    if (res.ok) {
      await fetchDetails()
      await fetchProjects()
    }
  }

  const handleUpdateStatus = async (key: string, newStatus: string) => {
    const res = await apiFetch(`/api/work-items/${key}`, {
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
    }
  }

  const handleUpdateContext = async (key: string, contextText: string) => {
    const res = await apiFetch(`/api/work-items/${key}/context`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ summary: contextText })
    })

    if (res.ok) {
      const contextData = await res.json()
      setWorkItems(prev =>
        prev.map(item =>
          item.key === key ? { ...item, context: contextData } : item
        )
      )
    }
  }

  const handleAddProgress = async (
    key: string,
    entry: { summary: string; proof: string; status: string }
  ) => {
    const res = await apiFetch(`/api/work-items/${key}/progress`, {
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
    }
  }

  const handleUpdateProgress = async (
    key: string,
    progressId: number,
    entry: { summary?: string; proof?: string; status?: string }
  ) => {
    const res = await apiFetch(`/api/work-items/${key}/progress/${progressId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(entry)
    })

    if (res.ok) {
      const updatedProgress: ProgressEntry = await res.json()
      setWorkItems(prev =>
        prev.map(item =>
          item.key === key
            ? {
                ...item,
                progress: (item.progress || []).map(p =>
                  p.id === progressId ? updatedProgress : p
                )
              }
            : item
        )
      )
      return updatedProgress
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update progress entry')
    }
  }

  const handleDeleteProgress = async (key: string, progressId: number) => {
    const res = await apiFetch(`/api/work-items/${key}/progress/${progressId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': apiKey
      }
    })

    if (res.ok) {
      setWorkItems(prev =>
        prev.map(item =>
          item.key === key
            ? {
                ...item,
                progress: (item.progress || []).filter(p => p.id !== progressId)
              }
            : item
        )
      )
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to delete progress entry')
    }
  }

  const handleDeleteSprint = async (sprintId: number) => {
    if (!projectKey) return
    const res = await apiFetch(`/api/projects/${projectKey}/sprints/${sprintId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': apiKey
      }
    })
    if (res.ok) {
      await fetchDetails()
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to delete sprint')
    }
  }

  const handleDeleteRelease = async (releaseId: number) => {
    if (!projectKey) return
    const res = await apiFetch(`/api/projects/${projectKey}/releases/${releaseId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': apiKey
      }
    })
    if (res.ok) {
      await fetchDetails()
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to delete release')
    }
  }

  const handleDeleteWorkItem = async (key: string) => {
    const res = await apiFetch(`/api/work-items/${key}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': apiKey
      }
    })
    if (res.ok) {
      await fetchDetails()
      await fetchProjects()
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to delete work item')
    }
  }

  const handleUpdateSprint = async (
    sprintId: number,
    data: { name?: string; description?: string; start_date?: string | null; end_date?: string | null }
  ) => {
    if (!projectKey) throw new Error('No project selected')
    const res = await apiFetch(`/api/projects/${projectKey}/sprints/${sprintId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated: Sprint = await res.json()
      setSprints(prev => prev.map(s => (s.id === sprintId ? updated : s)))
      return updated
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update sprint')
    }
  }

  const handleUpdateRelease = async (
    releaseId: number,
    data: { name?: string; description?: string; start_date?: string | null; end_date?: string | null }
  ) => {
    if (!projectKey) throw new Error('No project selected')
    const res = await apiFetch(`/api/projects/${projectKey}/releases/${releaseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated: Release = await res.json()
      setReleases(prev => prev.map(r => (r.id === releaseId ? updated : r)))
      return updated
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update release')
    }
  }

  const handleUpdateWorkItemDetails = async (
    key: string,
    data: {
      title?: string
      description?: string
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | string
      sprint_id?: number | null
      release_id?: number | null
      start_date?: string | null
      target_date?: string | null
    }
  ) => {
    const res = await apiFetch(`/api/work-items/${key}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated: WorkItem = await res.json()
      setWorkItems(prev => prev.map(item => (item.key === key ? updated : item)))
      return updated
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update work item')
    }
  }

  // Fallback project object if projects list is still loading
  const effectiveProject: Project = currentProject || {
    id: 0,
    key: (projectKey || '').toUpperCase(),
    name: (projectKey || '').toUpperCase(),
    description: '',
    item_count: workItems.length,
    statuses: [
      { id: 1, name: 'todo', order: 1, is_default: true },
      { id: 2, name: 'in progress', order: 2, is_default: false },
      { id: 3, name: 'done', order: 3, is_default: false }
    ]
  }

  return (
    <>
      <ProjectDetailView
        project={effectiveProject}
        sprints={sprints}
        releases={releases}
        workItems={workItems}
        loading={loadingDetails}
        onBack={() => navigate('/')}
        onRefresh={fetchDetails}
        onSelectSprint={sprint =>
          navigate(`/projects/${projectKey}/sprints/${sprint.id}${location.search}`)
        }
        onSelectRelease={release =>
          navigate(`/projects/${projectKey}/releases/${release.id}${location.search}`)
        }
        onSelectWorkItem={item =>
          navigate(`/projects/${projectKey}/items/${item.key}${location.search}`)
        }
        onUpdateStatus={handleUpdateStatus}
        onCreateSprint={handleCreateSprint}
        onCreateRelease={handleCreateRelease}
        onCreateWorkItem={handleCreateWorkItem}
      />

      <Outlet
        context={{
          project: effectiveProject,
          sprints,
          releases,
          workItems,
          setWorkItems,
          handleUpdateStatus,
          handleUpdateContext,
          handleAddProgress,
          handleUpdateProgress,
          handleDeleteProgress,
          handleDeleteSprint,
          handleDeleteRelease,
          handleDeleteWorkItem,
          handleUpdateSprint,
          handleUpdateRelease,
          handleUpdateWorkItemDetails
        }}
      />
    </>
  )
}
