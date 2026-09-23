import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom'
import { WorkItem } from '../types'
import { apiFetch } from '../utils/apiFetch'
import { ProjectDetailOutletContext } from './ProjectDetailRoute'
import { SprintDetailModal } from '../components/Modals/SprintDetailModal'
import { ReleaseDetailModal } from '../components/Modals/ReleaseDetailModal'
import { WorkItemDetailModal } from '../components/Modals/WorkItemDetailModal'

export function SprintModalRoute() {
  const { projectKey, sprintId } = useParams<{ projectKey: string; sprintId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    sprints,
    releases,
    workItems,
    handleDeleteSprint,
    handleUpdateSprint
  } = useOutletContext<ProjectDetailOutletContext>()

  const sprint = sprints.find(s => String(s.id) === sprintId) || null

  const handleDelete = sprint ? async () => {
    await handleDeleteSprint(sprint.id)
    navigate(`/projects/${projectKey}${location.search}`)
  } : undefined

  const handleUpdate = sprint ? async (data: {
    name?: string
    description?: string
    start_date?: string | null
    end_date?: string | null
  }) => {
    await handleUpdateSprint(sprint.id, data)
  } : undefined

  return (
    <SprintDetailModal
      sprint={sprint}
      releases={releases}
      workItems={workItems}
      onClose={() => navigate(`/projects/${projectKey}${location.search}`)}
      onSelectWorkItem={item => navigate(`/projects/${projectKey}/items/${item.key}${location.search}`)}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
    />
  )
}

export function ReleaseModalRoute() {
  const { projectKey, releaseId } = useParams<{ projectKey: string; releaseId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    releases,
    sprints,
    workItems,
    handleDeleteRelease,
    handleUpdateRelease
  } = useOutletContext<ProjectDetailOutletContext>()

  const release = releases.find(r => String(r.id) === releaseId) || null

  const handleDelete = release ? async () => {
    await handleDeleteRelease(release.id)
    navigate(`/projects/${projectKey}${location.search}`)
  } : undefined

  const handleUpdate = release ? async (data: {
    name?: string
    description?: string
    start_date?: string | null
    end_date?: string | null
  }) => {
    await handleUpdateRelease(release.id, data)
  } : undefined

  return (
    <ReleaseDetailModal
      release={release}
      sprints={sprints}
      workItems={workItems}
      onClose={() => navigate(`/projects/${projectKey}${location.search}`)}
      onSelectWorkItem={item => navigate(`/projects/${projectKey}/items/${item.key}${location.search}`)}
      onSelectSprint={sprint => navigate(`/projects/${projectKey}/sprints/${sprint.id}${location.search}`)}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
    />
  )
}

export function WorkItemModalRoute() {
  const { projectKey, itemKey } = useParams<{ projectKey: string; itemKey: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    project,
    workItems,
    sprints,
    releases,
    handleUpdateStatus,
    handleUpdateContext,
    handleAddProgress,
    handleUpdateProgress,
    handleDeleteProgress,
    handleDeleteWorkItem,
    handleUpdateWorkItemDetails
  } = useOutletContext<ProjectDetailOutletContext>()

  const [detailItem, setDetailItem] = useState<WorkItem | null>(null)

  const foundItem =
    workItems.find(w => w.key.toUpperCase() === itemKey?.toUpperCase())
  const activeItem = (detailItem && detailItem.key.toUpperCase() === itemKey?.toUpperCase())
    ? detailItem
    : ((foundItem as unknown as WorkItem) || null)

  useEffect(() => {
    if (itemKey) {
      apiFetch(`/api/work-items/${itemKey}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data) setDetailItem(data)
        })
        .catch(() => { })
    }
  }, [itemKey])

  const handleDelete = (activeItem || itemKey) ? async () => {
    const keyToDelete = activeItem?.key || itemKey!
    await handleDeleteWorkItem(keyToDelete)
    navigate(`/projects/${projectKey}${location.search}`)
  } : undefined

  const handleUpdateDetails = (activeItem || itemKey) ? async (data: {
    title?: string
    description?: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | string
    sprint_id?: number | null
    release_id?: number | null
    start_date?: string | null
    target_date?: string | null
    active_assignee_username?: string | null
  }) => {
    const keyToUpdate = activeItem?.key || itemKey!
    const updated = await handleUpdateWorkItemDetails(keyToUpdate, data)
    if (updated) setDetailItem(updated)
  } : undefined

  return (
    <WorkItemDetailModal
      item={activeItem}
      projectKey={projectKey}
      sprints={sprints}
      releases={releases}
      statuses={project?.statuses || []}
      onClose={() => navigate(`/projects/${projectKey}${location.search}`)}
      onUpdateStatus={async (key, status) => {
        await handleUpdateStatus(key, status)
        setDetailItem(prev => prev && prev.key.toUpperCase() === key.toUpperCase() ? { ...prev, status: status as any } : prev)
      }}
      onUpdateContext={async (key, text) => {
        await handleUpdateContext(key, text)
        setDetailItem(prev => prev && prev.key.toUpperCase() === key.toUpperCase() ? {
          ...prev,
          context: {
            id: prev.context?.id || 0,
            work_item_key: key,
            user: prev.context?.user || '',
            summary: text,
            timestamp: new Date().toISOString()
          }
        } : prev)
      }}
      onAddProgress={async (key, entry) => {
        await handleAddProgress(key, entry)
        apiFetch(`/api/work-items/${key}`)
          .then(res => (res.ok ? res.json() : null))
          .then(data => { if (data) setDetailItem(data) })
          .catch(() => {})
      }}
      onUpdateProgress={async (key, id, entry) => {
        await handleUpdateProgress(key, id, entry)
        apiFetch(`/api/work-items/${key}`)
          .then(res => (res.ok ? res.json() : null))
          .then(data => { if (data) setDetailItem(data) })
          .catch(() => {})
      }}
      onDeleteProgress={async (key, id) => {
        await handleDeleteProgress(key, id)
        apiFetch(`/api/work-items/${key}`)
          .then(res => (res.ok ? res.json() : null))
          .then(data => { if (data) setDetailItem(data) })
          .catch(() => {})
      }}
      onDelete={handleDelete}
      onUpdateDetails={handleUpdateDetails}
    />
  )
}
