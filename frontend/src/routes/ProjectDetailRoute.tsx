import { useState, useEffect, useCallback, startTransition, Dispatch, SetStateAction } from 'react'
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  Project,
  Sprint,
  Release,
  WorkItem,
  Incident,
  MonitoringLog,
  ProgressEntry,
  DEFAULT_PROJECT_STATUSES
} from '../types'
import { useApp } from '../context/AppContext'
import { ProjectDetailView, isUserSupportItem } from '../components/ProjectDetail/ProjectDetailView'
import { QuickJumpModal } from '../components/ProjectDetail/QuickJumpModal'
import { apiFetch } from '../utils/apiFetch'

export interface ProjectDetailOutletContext {
  project: Project
  sprints: Sprint[]
  releases: Release[]
  workItems: WorkItem[]
  userSupportItems: WorkItem[]
  incidents: Incident[]
  monitoringLogs: MonitoringLog[]
  setWorkItems: Dispatch<SetStateAction<WorkItem[]>>
  setUserSupportItems: Dispatch<SetStateAction<WorkItem[]>>
  setIncidents: Dispatch<SetStateAction<Incident[]>>
  setMonitoringLogs: Dispatch<SetStateAction<MonitoringLog[]>>
  handleUpdateStatus: (key: string, newStatus: string) => Promise<void>
  handleUpdateContext: (key: string, contextText: string) => Promise<void>
  handleAddProgress: (
    key: string,
    entry: { summary: string; proof: string; status: string; agent_id?: string; agent_hostname?: string }
  ) => Promise<void>
  handleUpdateProgress: (
    key: string,
    progressId: number,
    entry: { summary?: string; proof?: string; status?: string; agent_id?: string; agent_hostname?: string }
  ) => Promise<ProgressEntry>
  handleDeleteProgress: (key: string, progressId: number) => Promise<void>
  handleDeleteSprint: (sprintId: number) => Promise<void>
  handleDeleteRelease: (releaseId: number) => Promise<void>
  handleDeleteWorkItem: (key: string) => Promise<void>
  handleDeleteIncident: (key: string) => Promise<void>
  handleDeleteMonitoringLog: (key: string) => Promise<void>
  handleUpdateSprint: (
    sprintId: number,
    data: { name?: string; description?: string; status?: string; start_date?: string | null; end_date?: string | null }
  ) => Promise<Sprint>
  handleUpdateRelease: (
    releaseId: number,
    data: { name?: string; description?: string; status?: string; start_date?: string | null; end_date?: string | null }
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
      active_assignee_username?: string | null
    }
  ) => Promise<WorkItem>
  handleUpdateIncident: (
    key: string,
    data: {
      title?: string
      cause?: string
      investigation_note?: string
      status?: string
      work_item_keys?: string[]
    }
  ) => Promise<Incident>
  handleUpdateMonitoringLog: (
    key: string,
    data: {
      agent_id?: string
      description?: string
      status?: string
      incident_id?: string | null
      jira_url?: string
    }
  ) => Promise<MonitoringLog>
}

export function ProjectDetailRoute() {
  const { projectKey } = useParams<{ projectKey: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { projects, fetchProjects } = useApp()

  const [sprints, setSprints] = useState<Sprint[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [userSupportItems, setUserSupportItems] = useState<WorkItem[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [monitoringLogs, setMonitoringLogs] = useState<MonitoringLog[]>([])
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [isQuickJumpOpen, setIsQuickJumpOpen] = useState(false)

  // Global 'g' keyboard shortcut to open quick jump modal on /projects/:projectKey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if modifier keys are pressed
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // Only trigger on 'g' or 'G'
      if (e.key !== 'g' && e.key !== 'G') return

      // Ignore when user is typing in an input/textarea/select or contenteditable element
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      // Check if a sub-modal route (items, user-support, sprints, releases, incidents, monitoring-logs) is currently open
      const isSubModalRoute = /^\/projects\/[^/]+\/(items|user-support|sprints|releases|incidents|monitoring-logs)(\/|$)/i.test(location.pathname)
      if (isSubModalRoute) return

      // Check if another modal has locked body scroll
      if (document.body.style.overflow === 'hidden') return

      e.preventDefault()
      setIsQuickJumpOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [location.pathname])

  const handleSelectQuickJumpItem = (item: WorkItem) => {
    startTransition(() => {
      setIsQuickJumpOpen(false)
      navigate(`/projects/${projectKey}/items/${item.key}${location.search}`)
    })
  }

  const currentProject = projects.find(p => p.key === projectKey?.toUpperCase()) || null

  const fetchDetails = useCallback(async () => {
    if (!projectKey) return
    setLoadingDetails(true)
    try {
      const [sprintsRes, releasesRes, itemsRes, supportRes, incidentsRes, logsRes] = await Promise.all([
        apiFetch(`/api/projects/${projectKey}/sprints`),
        apiFetch(`/api/projects/${projectKey}/releases`),
        apiFetch(`/api/work-items?project_key=${projectKey}`),
        apiFetch(`/api/projects/${projectKey}/user-support`).catch(() => null),
        apiFetch(`/api/projects/${projectKey}/incidents`).catch(() => null),
        apiFetch(`/api/projects/${projectKey}/monitoring-logs`).catch(() => null)
      ])

      if (sprintsRes?.ok) {
        const data = await sprintsRes.json().catch(() => null)
        if (Array.isArray(data)) setSprints(data)
      }
      if (releasesRes?.ok) {
        const data = await releasesRes.json().catch(() => null)
        if (Array.isArray(data)) setReleases(data)
      }
      let fallbackSupportFromWorkItems: WorkItem[] = []
      if (itemsRes?.ok) {
        const data = await itemsRes.json().catch(() => null)
        if (Array.isArray(data)) {
          setWorkItems(data.filter(item => !isUserSupportItem(item)))
          fallbackSupportFromWorkItems = data.filter(item => isUserSupportItem(item))
        }
      }
      if (supportRes?.ok) {
        const data = await supportRes.json().catch(() => null)
        if (Array.isArray(data)) {
          setUserSupportItems(data.filter(item => isUserSupportItem(item)))
        } else if (fallbackSupportFromWorkItems.length > 0) {
          setUserSupportItems(fallbackSupportFromWorkItems)
        }
      } else if (fallbackSupportFromWorkItems.length > 0) {
        setUserSupportItems(fallbackSupportFromWorkItems)
      }
      if (incidentsRes?.ok) {
        const data = await incidentsRes.json().catch(() => null)
        if (Array.isArray(data)) setIncidents(data)
      }
      if (logsRes?.ok) {
        const data = await logsRes.json().catch(() => null)
        if (Array.isArray(data)) setMonitoringLogs(data)
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
        'Content-Type': 'application/json'
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
        'Content-Type': 'application/json'
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
        'Content-Type': 'application/json'
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

  const handleCreateUserSupportItem = async (data: {
    title: string
    description: string
    status: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    parent_key?: string | null
  }) => {
    if (!projectKey) return
    const res = await apiFetch(`/api/projects/${projectKey}/user-support`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    })

    if (res.ok) {
      const updated: WorkItem = await res.json()
      setWorkItems(prev => prev.map(item => (item.key === key ? updated : item)))
      setUserSupportItems(prev => prev.map(item => (item.key === key ? updated : item)))
    }
  }

  const handleUpdateContext = async (key: string, contextText: string) => {
    const res = await apiFetch(`/api/work-items/${key}/context`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
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
      setUserSupportItems(prev =>
        prev.map(item =>
          item.key === key ? { ...item, context: contextData } : item
        )
      )
    }
  }

  const getEffectiveStatus = (progress: ProgressEntry[] | undefined): string => {
    if (!progress || progress.length === 0) return 'todo'
    return progress[progress.length - 1].status || 'todo'
  }

  const handleAddProgress = async (
    key: string,
    entry: { summary: string; proof: string; status: string; agent_id?: string; agent_hostname?: string }
  ) => {
    const res = await apiFetch(`/api/work-items/${key}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entry)
    })

    if (res.ok) {
      const newProgress = await res.json()
      const applyProgress = (prev: WorkItem[]) =>
        prev.map(item => {
          if (item.key !== key) return item
          const updatedList = [...(item.progress || []), newProgress]
          return {
            ...item,
            status: getEffectiveStatus(updatedList),
            progress: updatedList
          }
        })
      setWorkItems(applyProgress)
      setUserSupportItems(applyProgress)
    }
  }

  const handleUpdateProgress = async (
    key: string,
    progressId: number,
    entry: { summary?: string; proof?: string; status?: string; agent_id?: string; agent_hostname?: string }
  ) => {
    const res = await apiFetch(`/api/work-items/${key}/progress/${progressId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entry)
    })

    if (res.ok) {
      const updatedProgress: ProgressEntry = await res.json()
      const applyUpdate = (prev: WorkItem[]) =>
        prev.map(item => {
          if (item.key !== key) return item
          const updatedList = (item.progress || []).map(p =>
            p.id === progressId ? updatedProgress : p
          )
          return {
            ...item,
            status: getEffectiveStatus(updatedList),
            progress: updatedList
          }
        })
      setWorkItems(applyUpdate)
      setUserSupportItems(applyUpdate)
      return updatedProgress
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update progress entry')
    }
  }

  const handleDeleteProgress = async (key: string, progressId: number) => {
    const res = await apiFetch(`/api/work-items/${key}/progress/${progressId}`, {
      method: 'DELETE',

    })

    if (res.ok) {
      const applyDelete = (prev: WorkItem[]) =>
        prev.map(item => {
          if (item.key !== key) return item
          const updatedList = (item.progress || []).filter(p => p.id !== progressId)
          return {
            ...item,
            status: getEffectiveStatus(updatedList),
            progress: updatedList
          }
        })
      setWorkItems(applyDelete)
      setUserSupportItems(applyDelete)
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to delete progress entry')
    }
  }

  const handleDeleteSprint = async (sprintId: number) => {
    if (!projectKey) return
    const res = await apiFetch(`/api/projects/${projectKey}/sprints/${sprintId}`, {
      method: 'DELETE',

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
    data: { name?: string; description?: string; status?: string; start_date?: string | null; end_date?: string | null }
  ) => {
    if (!projectKey) throw new Error('No project selected')
    const res = await apiFetch(`/api/projects/${projectKey}/sprints/${sprintId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated: Sprint = await res.json()
      let mergedResult: Sprint = updated
      setSprints(prev =>
        prev.map(s => {
          if (s.id !== sprintId) return s
          const nextStatus = updated.status ?? data.status ?? s.status ?? 'planned'
          const isDone = nextStatus.toLowerCase() === 'done'
          const nextDoneAt = isDone
            ? updated.done_at ?? s.done_at ?? new Date().toISOString()
            : null
          mergedResult = {
            ...s,
            ...updated,
            status: nextStatus,
            done_at: nextDoneAt
          }
          return mergedResult
        })
      )
      return mergedResult
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update sprint')
    }
  }

  const handleUpdateRelease = async (
    releaseId: number,
    data: { name?: string; description?: string; status?: string; start_date?: string | null; end_date?: string | null }
  ) => {
    if (!projectKey) throw new Error('No project selected')
    const res = await apiFetch(`/api/projects/${projectKey}/releases/${releaseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated: Release = await res.json()
      let mergedResult: Release = updated
      setReleases(prev =>
        prev.map(r => {
          if (r.id !== releaseId) return r
          const nextStatus = updated.status ?? data.status ?? r.status ?? 'planned'
          const isDone = nextStatus.toLowerCase() === 'done'
          const nextDoneAt = isDone
            ? updated.done_at ?? r.done_at ?? new Date().toISOString()
            : null
          mergedResult = {
            ...r,
            ...updated,
            status: nextStatus,
            done_at: nextDoneAt
          }
          return mergedResult
        })
      )
      return mergedResult
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
      active_assignee_username?: string | null
    }
  ) => {
    const res = await apiFetch(`/api/work-items/${key}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated: WorkItem = await res.json()
      setWorkItems(prev => prev.map(item => (item.key === key ? updated : item)))
      setUserSupportItems(prev => prev.map(item => (item.key === key ? updated : item)))
      return updated
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update work item')
    }
  }

  const handleCreateIncident = async (data: {
    title: string
    cause: string
    investigation_note: string
    status: string
    work_item_keys?: string[]
  }) => {
    if (!projectKey) return
    const res = await apiFetch(`/api/projects/${projectKey}/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...data,
        project_key: projectKey
      })
    })
    if (res.ok) {
      await fetchDetails()
    }
  }

  const handleCreateMonitoringLog = async (data: {
    agent_id: string
    description: string
    status: string
    incident_id?: string | null
    jira_url?: string
  }) => {
    if (!projectKey) return
    const res = await apiFetch(`/api/projects/${projectKey}/monitoring-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...data,
        project_key: projectKey
      })
    })
    if (res.ok) {
      await fetchDetails()
    }
  }

  const handleUpdateIncident = async (
    key: string,
    data: {
      title?: string
      cause?: string
      investigation_note?: string
      status?: string
      work_item_keys?: string[]
    }
  ) => {
    const res = await apiFetch(`/api/incidents/${key}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated: Incident = await res.json()
      setIncidents(prev => prev.map(inc => (inc.key === key ? updated : inc)))
      return updated
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update incident')
    }
  }

  const handleUpdateMonitoringLog = async (
    key: string,
    data: {
      agent_id?: string
      description?: string
      status?: string
      incident_id?: string | null
      jira_url?: string
    }
  ) => {
    const res = await apiFetch(`/api/monitoring-logs/${key}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated: MonitoringLog = await res.json()
      setMonitoringLogs(prev => prev.map(log => (log.key === key ? updated : log)))
      await fetchDetails()
      return updated
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update monitoring log')
    }
  }

  const handleDeleteIncident = async (key: string) => {
    const res = await apiFetch(`/api/incidents/${key}`, {
      method: 'DELETE'
    })
    if (res.ok) {
      await fetchDetails()
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to delete incident')
    }
  }

  const handleDeleteMonitoringLog = async (key: string) => {
    const res = await apiFetch(`/api/monitoring-logs/${key}`, {
      method: 'DELETE'
    })
    if (res.ok) {
      await fetchDetails()
    } else {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to delete monitoring log')
    }
  }

  // Fallback project object if projects list is still loading
  const effectiveProject: Project = currentProject || {
    id: 0,
    key: (projectKey || '').toUpperCase(),
    name: (projectKey || '').toUpperCase(),
    description: '',
    item_count: workItems.length,
    statuses: DEFAULT_PROJECT_STATUSES
  }

  return (
    <>
      <ProjectDetailView
        project={effectiveProject}
        sprints={sprints}
        releases={releases}
        workItems={workItems}
        userSupportItems={userSupportItems}
        incidents={incidents}
        monitoringLogs={monitoringLogs}
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
        onSelectUserSupportItem={item =>
          navigate(`/projects/${projectKey}/items/${item.key}${location.search}`)
        }
        onSelectIncident={incident =>
          navigate(`/projects/${projectKey}/incidents/${incident.key}${location.search}`)
        }
        onSelectMonitoringLog={log =>
          navigate(`/projects/${projectKey}/monitoring-logs/${log.key}${location.search}`)
        }
        onUpdateStatus={handleUpdateStatus}
        onCreateSprint={handleCreateSprint}
        onCreateRelease={handleCreateRelease}
        onCreateWorkItem={handleCreateWorkItem}
        onCreateUserSupportItem={handleCreateUserSupportItem}
        onCreateIncident={handleCreateIncident}
        onCreateMonitoringLog={handleCreateMonitoringLog}
        onOpenQuickJump={() => setIsQuickJumpOpen(true)}
      />

      <QuickJumpModal
        isOpen={isQuickJumpOpen}
        onClose={() => setIsQuickJumpOpen(false)}
        projectKey={projectKey || effectiveProject.key}
        workItems={workItems}
        onSelectWorkItem={handleSelectQuickJumpItem}
      />

      <Outlet
        context={{
          project: effectiveProject,
          sprints,
          releases,
          workItems,
          userSupportItems,
          incidents,
          monitoringLogs,
          setWorkItems,
          setUserSupportItems,
          setIncidents,
          setMonitoringLogs,
          handleUpdateStatus,
          handleUpdateContext,
          handleAddProgress,
          handleUpdateProgress,
          handleDeleteProgress,
          handleDeleteSprint,
          handleDeleteRelease,
          handleDeleteWorkItem,
          handleDeleteIncident,
          handleDeleteMonitoringLog,
          handleUpdateSprint,
          handleUpdateRelease,
          handleUpdateWorkItemDetails,
          handleUpdateIncident,
          handleUpdateMonitoringLog
        }}
      />
    </>
  )
}
