import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { WorkItem } from '../types'
import { ProjectDetailOutletContext } from './ProjectDetailRoute'
import { SprintDetailModal } from '../components/Modals/SprintDetailModal'
import { ReleaseDetailModal } from '../components/Modals/ReleaseDetailModal'
import { WorkItemDetailModal } from '../components/Modals/WorkItemDetailModal'

export function SprintModalRoute() {
  const { projectKey, sprintId } = useParams<{ projectKey: string; sprintId: string }>()
  const navigate = useNavigate()
  const { sprints, releases, workItems } = useOutletContext<ProjectDetailOutletContext>()

  const sprint = sprints.find(s => String(s.id) === sprintId) || null

  return (
    <SprintDetailModal
      sprint={sprint}
      releases={releases}
      workItems={workItems}
      onClose={() => navigate(`/projects/${projectKey}`)}
      onSelectWorkItem={item => navigate(`/projects/${projectKey}/items/${item.key}`)}
    />
  )
}

export function ReleaseModalRoute() {
  const { projectKey, releaseId } = useParams<{ projectKey: string; releaseId: string }>()
  const navigate = useNavigate()
  const { releases, sprints, workItems } = useOutletContext<ProjectDetailOutletContext>()

  const release = releases.find(r => String(r.id) === releaseId) || null

  return (
    <ReleaseDetailModal
      release={release}
      sprints={sprints}
      workItems={workItems}
      onClose={() => navigate(`/projects/${projectKey}`)}
      onSelectWorkItem={item => navigate(`/projects/${projectKey}/items/${item.key}`)}
      onSelectSprint={sprint => navigate(`/projects/${projectKey}/sprints/${sprint.id}`)}
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
    handleAddProgress
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
    />
  )
}
