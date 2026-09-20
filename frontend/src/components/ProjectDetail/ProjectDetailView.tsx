import React from 'react'
import { ArrowLeft, RefreshCw, Layers, FolderGit2 } from 'lucide-react'
import { Project, Sprint, Release, WorkItem } from '../../types'
import { SprintList } from './SprintList'
import { ReleaseList } from './ReleaseList'
import { WorkItemList } from './WorkItemList'

interface ProjectDetailViewProps {
  project: Project
  sprints: Sprint[]
  releases: Release[]
  workItems: WorkItem[]
  loading: boolean
  onBack: () => void
  onRefresh: () => void
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
    descr: string
    status: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    parent_key?: string | null
    sprint_id?: number | null
    release_id?: number | null
  }) => Promise<void>
}

export function ProjectDetailView({
  project,
  sprints,
  releases,
  workItems,
  loading,
  onBack,
  onRefresh,
  onSelectSprint,
  onSelectRelease,
  onSelectWorkItem,
  onCreateSprint,
  onCreateRelease,
  onCreateWorkItem
}: ProjectDetailViewProps) {
  return (
    <div className="space-y-8" data-testid="project-detail-view">
      {/* Top Project Navigation & Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition shadow-sm"
            title="Back to Projects"
            data-testid="back-to-projects-button"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400">
                [{project.key}]
              </span>
              <h2 className="text-xl font-bold tracking-tight text-zinc-100">
                {project.name}
              </h2>
            </div>
            {project.description && (
              <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
              <strong className="text-zinc-200">{sprints.length}</strong> Sprints
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
              <strong className="text-zinc-200">{releases.length}</strong> Releases
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
              <strong className="text-zinc-200">{workItems.length}</strong> Work Items
            </span>
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
            title="Refresh Project Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Strictly Top-to-Bottom Layout */}
      <div className="space-y-8">
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
            statuses={project.statuses || []}
            onSelectWorkItem={onSelectWorkItem}
            onCreateWorkItem={onCreateWorkItem}
          />
        </section>
      </div>
    </div>
  )
}
