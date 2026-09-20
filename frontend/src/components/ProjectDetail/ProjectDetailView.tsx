import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, LayoutList, Kanban } from 'lucide-react'
import { Project, Sprint, Release, WorkItem } from '../../types'
import { ProjectListView } from './ProjectListView'
import { KanbanBoard } from './KanbanBoard'

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
  onUpdateStatus?: (key: string, newStatus: string) => Promise<void>
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
  onUpdateStatus,
  onCreateSprint,
  onCreateRelease,
  onCreateWorkItem
}: ProjectDetailViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const viewParam = searchParams.get('view')
  const activeView: 'list' | 'board' = viewParam === 'board' ? 'board' : 'list'

  const handleSelectView = (view: 'list' | 'board') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (view === 'list') {
        next.delete('view')
      } else {
        next.set('view', view)
      }
      return next
    })
  }

  // Quick stats by status
  const statuses = project.statuses && project.statuses.length > 0
    ? project.statuses
    : [
        { id: 1, name: 'todo', order: 1, is_default: true },
        { id: 2, name: 'in progress', order: 2, is_default: false },
        { id: 3, name: 'done', order: 3, is_default: false }
      ]

  return (
    <div className="space-y-6" data-testid="project-detail-view">
      {/* Top Project Navigation & Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition shadow-sm shrink-0"
            title="Back to Projects"
            data-testid="back-to-projects-button"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400">
                [{project.key}]
              </span>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-100 truncate">
                {project.name}
              </h2>
            </div>
            {project.description && (
              <p className="text-xs text-zinc-400 mt-0.5 max-w-2xl truncate">
                {project.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
              <strong className="text-zinc-200">{sprints.length}</strong> Sprints
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
              <strong className="text-zinc-200">{releases.length}</strong> Releases
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
              <strong className="text-zinc-200">{workItems.length}</strong> Items
            </span>
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
            title="Refresh Project Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Layout: Left Sidebar Menu + Content View */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left Side Navigation Menu */}
        <aside
          className="w-full md:w-52 shrink-0 space-y-4"
          data-testid="project-sidebar-menu"
        >
          {/* Views Navigation */}
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-2 space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Views
            </div>

            <button
              onClick={() => handleSelectView('list')}
              data-testid="view-option-list"
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeView === 'list'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              <span>List View</span>
            </button>

            <button
              onClick={() => handleSelectView('board')}
              data-testid="view-option-board"
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeView === 'board'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>Board View</span>
            </button>
          </div>

          {/* Quick Status Stats Card */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-3 space-y-2 hidden md:block">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Status Overview
            </div>
            <div className="space-y-1.5 text-xs">
              {statuses.map(st => {
                const count = workItems.filter(
                  item => (item.status || 'todo').toLowerCase() === st.name.toLowerCase()
                ).length
                return (
                  <div
                    key={st.id || st.name}
                    className="flex items-center justify-between text-zinc-400 text-[11px]"
                  >
                    <span className="capitalize">{st.name}</span>
                    <span className="font-mono text-zinc-300 font-medium">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        {/* Middle/Main Content Area */}
        <main className="flex-1 min-w-0 w-full">
          {activeView === 'list' ? (
            <ProjectListView
              sprints={sprints}
              releases={releases}
              workItems={workItems}
              statuses={statuses}
              onSelectSprint={onSelectSprint}
              onSelectRelease={onSelectRelease}
              onSelectWorkItem={onSelectWorkItem}
              onCreateSprint={onCreateSprint}
              onCreateRelease={onCreateRelease}
              onCreateWorkItem={onCreateWorkItem}
            />
          ) : (
            <KanbanBoard
              workItems={workItems}
              statuses={statuses}
              sprints={sprints}
              releases={releases}
              onSelectWorkItem={onSelectWorkItem}
              onUpdateStatus={onUpdateStatus}
              onCreateWorkItem={onCreateWorkItem}
            />
          )}
        </main>
      </div>
    </div>
  )
}
