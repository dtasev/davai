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
    handleDeleteWorkItem,
    handleUpdateWorkItemDetails
  } = useOutletContext<ProjectDetailOutletContext>()

  const [standaloneItem, setStandaloneItem] = useState<WorkItem | null>(null)

  const foundItem =
    workItems.find(w => w.key.toUpperCase() === itemKey?.toUpperCase()) || standaloneItem

  useEffect(() => {
    // If not found in loaded work items, fetch single work item directly
    if (!foundItem && itemKey) {
      apiFetch(`/api/work-items/${itemKey}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data) setStandaloneItem(data)
        })
        .catch(() => { })
    }
  }, [foundItem, itemKey])

  const handleDelete = (foundItem || itemKey) ? async () => {
    const keyToDelete = foundItem?.key || itemKey!
    await handleDeleteWorkItem(keyToDelete)
    navigate(`/projects/${projectKey}${location.search}`)
  } : undefined

  const handleUpdateDetails = (foundItem || itemKey) ? async (data: {
    title?: string
    description?: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | string
    sprint_id?: number | null
    release_id?: number | null
    start_date?: string | null
    target_date?: string | null
  }) => {
    const keyToUpdate = foundItem?.key || itemKey!
    const updated = await handleUpdateWorkItemDetails(keyToUpdate, data)
    if (standaloneItem) setStandaloneItem(updated)
  } : undefined

  return (
    <WorkItemDetailModal
      item={foundItem}
      sprints={sprints}
      releases={releases}
      statuses={project?.statuses || []}
      onClose={() => navigate(`/projects/${projectKey}${location.search}`)}
      onUpdateStatus={handleUpdateStatus}
      onUpdateContext={handleUpdateContext}
      onAddProgress={handleAddProgress}
      onDelete={handleDelete}
      onUpdateDetails={handleUpdateDetails}
    />
  )
}
