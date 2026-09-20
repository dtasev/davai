import { Sprint, Release, WorkItem, ProjectStatus } from '../../types'
import { SprintList } from './SprintList'
import { ReleaseList } from './ReleaseList'
import { WorkItemList } from './WorkItemList'

interface ProjectListViewProps {
  sprints: Sprint[]
  releases: Release[]
  workItems: WorkItem[]
  statuses: ProjectStatus[]
  onSelectSprint: (sprint: Sprint) => void
  onSelectRelease: (release: Release) => void
  onSelectWorkItem: (item: WorkItem) => void
  onCreateSprint: (
    name: string,
    description: string,
    releaseId: number | null,
    startDate: string | null,
    endDate: string | null
  ) => Promise<void>
  onCreateRelease: (
    name: string,
    description: string,
    startDate: string | null,
    endDate: string | null
  ) => Promise<void>
  onCreateWorkItem: (data: {
    title: string
    description: string
    status: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    parent_key?: string | null
    sprint_id?: number | null
    release_id?: number | null
  }) => Promise<void>
}

export function ProjectListView({
  sprints,
  releases,
  workItems,
  statuses,
  onSelectSprint,
  onSelectRelease,
  onSelectWorkItem,
  onCreateSprint,
  onCreateRelease,
  onCreateWorkItem
}: ProjectListViewProps) {
  return (
    <div className="space-y-8" data-testid="project-list-view">
      {/* 1. TOP: List of Sprints */}
      <section data-testid="sprint-list-section">
        <SprintList
          sprints={sprints}
          releases={releases}
          onSelectSprint={onSelectSprint}
          onCreateSprint={onCreateSprint}
        />
      </section>

      {/* 2. MIDDLE: List of Releases */}
      <section data-testid="release-list-section">
        <ReleaseList
          releases={releases}
          onSelectRelease={onSelectRelease}
          onCreateRelease={onCreateRelease}
        />
      </section>

      {/* 3. BOTTOM: List of Work Items */}
      <section data-testid="work-item-list-section">
        <WorkItemList
          workItems={workItems}
          sprints={sprints}
          releases={releases}
          statuses={statuses}
          onSelectWorkItem={onSelectWorkItem}
          onCreateWorkItem={onCreateWorkItem}
        />
      </section>
    </div>
  )
}
