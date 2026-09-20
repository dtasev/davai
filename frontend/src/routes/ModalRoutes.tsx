import { useState, useEffect } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { WorkItem } from '../types'
import { ProjectDetailOutletContext } from './ProjectDetailRoute'
import { SprintDetailModal } from '../components/Modals/SprintDetailModal'
import { ReleaseDetailModal } from '../components/Modals/ReleaseDetailModal'
import { WorkItemDetailModal } from '../components/Modals/WorkItemDetailModal'

export function SprintModalRoute() {
  const { projectKey, sprintId } = useParams<{ projectKey: string; sprintId: string }>()
  const navigate = useNavigate()
  const { sprints, releases, workItems, handleDeleteSprint } = useOutletContext<ProjectDetailOutletContext>()

  const sprint = sprints.find(s => String(s.id) === sprintId) || null

  const handleDelete = sprint ? async () => {
    await handleDeleteSprint(sprint.id)
    navigate(`/projects/${projectKey}`)
  } : undefined

  return (
    <SprintDetailModal
      sprint={sprint}
      releases={releases}
      workItems={workItems}
      onClose={() => navigate(`/projects/${projectKey}`)}
      onSelectWorkItem={item => navigate(`/projects/${projectKey}/items/${item.key}`)}
      onDelete={handleDelete}
    />
  )
}

export function ReleaseModalRoute() {
  const { projectKey, releaseId } = useParams<{ projectKey: string; releaseId: string }>()
  const navigate = useNavigate()
  const { releases, sprints, workItems, handleDeleteRelease } = useOutletContext<ProjectDetailOutletContext>()

  const release = releases.find(r => String(r.id) === releaseId) || null

  const handleDelete = release ? async () => {
    await handleDeleteRelease(release.id)
    navigate(`/projects/${projectKey}`)
  } : undefined

  return (
    <ReleaseDetailModal
      release={release}
      sprints={sprints}
      workItems={workItems}
      onClose={() => navigate(`/projects/${projectKey}`)}
      onSelectWorkItem={item => navigate(`/projects/${projectKey}/items/${item.key}`)}
      onSelectSprint={sprint => navigate(`/projects/${projectKey}/sprints/${sprint.id}`)}
      onDelete={handleDelete}
    />
  )
}

export function WorkItemModalRoute() {
  const { projectKey, itemKey } = useParams<{ projectKey: string; itemKey: string }>()
  const navigate = useNavigate()
  const {
    project,
    workItems,
    sprints,
    releases,
    handleUpdateStatus,
    handleUpdateContext,
    handleAddProgress,
    handleDeleteWorkItem
  } = useOutletContext<ProjectDetailOutletContext>()

  const [standaloneItem, setStandaloneItem] = useState<WorkItem | null>(null)

  const foundItem =
    workItems.find(w => w.key.toUpperCase() === itemKey?.toUpperCase()) || standaloneItem

  useEffect(() => {
    // If not found in loaded work items, fetch single work item directly
    if (!foundItem && itemKey) {
      fetch(`/api/work-items/${itemKey}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data) setStandaloneItem(data)
        })
        .catch(() => {})
    }
  }, [foundItem, itemKey])

  const handleDelete = (foundItem || itemKey) ? async () => {
    const keyToDelete = foundItem?.key || itemKey!
    await handleDeleteWorkItem(keyToDelete)
    navigate(`/projects/${projectKey}`)
  } : undefined

  return (
    <WorkItemDetailModal
      item={foundItem}
      sprints={sprints}
      releases={releases}
      statuses={project?.statuses || []}
      onClose={() => navigate(`/projects/${projectKey}`)}
      onUpdateStatus={handleUpdateStatus}
      onUpdateContext={handleUpdateContext}
      onAddProgress={handleAddProgress}
      onDelete={handleDelete}
    />
  )
}
