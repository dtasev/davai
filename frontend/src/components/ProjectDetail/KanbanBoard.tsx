import { useState, useMemo, FormEvent, DragEvent } from 'react'
import {
  Columns3,
  Plus,
  Search,
  CornerDownRight,
  User as UserIcon,
  Sparkles,
  GitCommit,
  Filter
} from 'lucide-react'
import { WorkItem, Sprint, Release, ProjectStatus, DEFAULT_PROJECT_STATUSES } from '../../types'
import { PriorityBadge, StatusBadge, formatStatus } from '../Common/Badge'
import { Modal } from '../Common/Modal'

interface KanbanBoardProps {
  workItems: WorkItem[]
  statuses: ProjectStatus[]
  sprints: Sprint[]
  releases: Release[]
  myIssuesOnly?: boolean
  onToggleMyIssues?: () => void
  currentUsername?: string
  onSelectWorkItem: (item: WorkItem) => void
  onUpdateStatus?: (key: string, newStatus: string) => Promise<void>
  onCreateWorkItem?: (data: {
    title: string
    description: string
    status: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    parent_key?: string | null
    sprint_id?: number | null
    release_id?: number | null
  }) => Promise<void>
}

export function KanbanBoard({
  workItems,
  statuses,
  sprints,
  releases,
  myIssuesOnly,
  onToggleMyIssues,
  currentUsername,
  onSelectWorkItem,
  onUpdateStatus,
  onCreateWorkItem
}: KanbanBoardProps) {
  const [search, setSearch] = useState('')
  const [sprintFilter, setSprintFilter] = useState<string>('ALL')
  const [draggedOverStatus, setDraggedOverStatus] = useState<string | null>(null)
  const [internalMyIssuesOnly, setInternalMyIssuesOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem('davai_filter_my_issues') === 'true'
    } catch {
      return false
    }
  })

  const isMyIssuesOnly = myIssuesOnly !== undefined ? myIssuesOnly : internalMyIssuesOnly
  const handleToggle = () => {
    if (onToggleMyIssues) {
      onToggleMyIssues()
    } else {
      setInternalMyIssuesOnly(prev => {
        const next = !prev
        try {
          localStorage.setItem('davai_filter_my_issues', String(next))
        } catch {}
        return next
      })
    }
  }

  // Create Work Item Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState(statuses[0]?.name || 'todo')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [parentKey, setParentKey] = useState('')
  const [sprintId, setSprintId] = useState<string>('')
  const [releaseId, setReleaseId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Ensure default statuses exist if project has none
  const effectiveStatuses: ProjectStatus[] = useMemo(() => {
    if (statuses && statuses.length > 0) {
      return [...statuses].sort((a, b) => a.order - b.order)
    }
    return DEFAULT_PROJECT_STATUSES
  }, [statuses])

  const filteredItems = useMemo(() => {
    return workItems.filter(item => {
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.key.toLowerCase().includes(search.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase()))

      const matchesSprint =
        sprintFilter === 'ALL'
          ? true
          : sprintFilter === 'BACKLOG'
          ? item.sprint_id == null
          : item.sprint_id === parseInt(sprintFilter, 10)

      const matchesMyIssues =
        !isMyIssuesOnly ||
        (currentUsername && (
          (item.active_assignee && item.active_assignee.toLowerCase() === currentUsername.toLowerCase()) ||
          (Array.isArray(item.assigned) && item.assigned.some(u => u.toLowerCase() === currentUsername.toLowerCase()))
        ))

      return matchesSearch && matchesSprint && matchesMyIssues
    })
  }, [workItems, search, sprintFilter, isMyIssuesOnly, currentUsername])

  // Group items by status
  const itemsByStatus = useMemo(() => {
    const map: Record<string, WorkItem[]> = {}
    effectiveStatuses.forEach(st => {
      map[st.name.toLowerCase()] = []
    })

    filteredItems.forEach(item => {
      const st = (item.status || 'todo').toLowerCase()
      if (!map[st]) {
        map[st] = []
      }
      map[st].push(item)
    })

    return map
  }, [effectiveStatuses, filteredItems])

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, itemKey: string) => {
    e.dataTransfer.setData('text/plain', itemKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>, statusName: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedOverStatus !== statusName) {
      setDraggedOverStatus(statusName)
    }
  }

  const handleDragLeave = (_e: DragEvent<HTMLDivElement>, statusName: string) => {
    // Only reset if leaving the column element itself
    if (draggedOverStatus === statusName) {
      setDraggedOverStatus(null)
    }
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetStatus: string) => {
    e.preventDefault()
    setDraggedOverStatus(null)
    const itemKey = e.dataTransfer.getData('text/plain')
    if (!itemKey || !onUpdateStatus) return

    const item = workItems.find(w => w.key === itemKey)
    if (item && item.status.toLowerCase() !== targetStatus.toLowerCase()) {
      try {
        await onUpdateStatus(itemKey, targetStatus)
      } catch {
        // Handled upstream or silently revert
      }
    }
  }

  const openCreateModalForStatus = (statusName: string) => {
    setStatus(statusName)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !onCreateWorkItem) return

    setSubmitting(true)
    try {
      await onCreateWorkItem({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        parent_key: parentKey.trim() || null,
        sprint_id: sprintId ? parseInt(sprintId, 10) : null,
        release_id: releaseId ? parseInt(releaseId, 10) : null
      })
      setIsModalOpen(false)
      setTitle('')
      setDescription('')
      setParentKey('')
      setSprintId('')
      setReleaseId('')
      setPriority('MEDIUM')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="kanban-board-section">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Columns3 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              <span>Kanban Board</span>
              <span className="text-sm font-mono text-zinc-500 font-normal">
                ({filteredItems.length} items)
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Visual workflow across status columns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 pr-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-32 sm:w-44"
            />
          </div>

          {/* My Issues Filter Toggle */}
          <button
            type="button"
            onClick={handleToggle}
            data-testid="filter-my-issues-button"
            aria-pressed={isMyIssuesOnly}
            title={isMyIssuesOnly ? 'Showing my issues (click to show all)' : 'Filter by issues assigned to me'}
            className={`px-2.5 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition shrink-0 ${
              isMyIssuesOnly
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <UserIcon className={`w-3.5 h-3.5 ${isMyIssuesOnly ? 'text-indigo-400' : 'text-zinc-500'}`} />
            <span>My Issues</span>
          </button>

          {/* Sprint Filter */}
          {sprints.length > 0 && (
            <div className="relative flex items-center">
              <Filter className="w-3 h-3 text-zinc-500 absolute left-2.5 pointer-events-none" />
              <select
                value={sprintFilter}
                onChange={e => setSprintFilter(e.target.value)}
                className="pl-7 pr-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Sprints</option>
                <option value="BACKLOG">Backlog (No Sprint)</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {onCreateWorkItem && (
            <button
              onClick={() => openCreateModalForStatus(effectiveStatuses[0]?.name || 'todo')}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium flex items-center gap-1 transition shadow-sm shrink-0"
              data-testid="kanban-create-item-button"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Board Columns Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[500px]">
        {effectiveStatuses.map(statusObj => {
          const statusLower = statusObj.name.toLowerCase()
          const colItems = itemsByStatus[statusLower] || []
          const isOver = draggedOverStatus === statusObj.name
          const slug = statusLower.replace(/\s+/g, '-')

          return (
            <div
              key={statusObj.id || statusObj.name}
              data-testid={`kanban-column-${slug}`}
              data-status={statusLower}
              onDragOver={e => handleDragOver(e, statusObj.name)}
              onDragLeave={e => handleDragLeave(e, statusObj.name)}
              onDrop={e => handleDrop(e, statusObj.name)}
              className={`w-72 sm:w-80 shrink-0 flex flex-col rounded-xl border transition-colors ${
                isOver
                  ? 'border-indigo-500/80 bg-indigo-950/20'
                  : 'border-zinc-800/80 bg-zinc-900/30'
              }`}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={statusObj.name} />
                  <span className="text-sm font-mono text-zinc-400 font-medium">
                    {colItems.length}
                  </span>
                </div>

                {onCreateWorkItem && (
                  <button
                    onClick={() => openCreateModalForStatus(statusObj.name)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
                    title={`Add item to ${formatStatus(statusObj.name)}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Items in Column */}
              <div className="p-2.5 flex-1 space-y-2.5 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
                {colItems.length === 0 ? (
                  <div className="h-24 border border-dashed border-zinc-800/80 rounded-lg flex items-center justify-center text-[11px] text-zinc-600">
                    No items in {formatStatus(statusObj.name)}
                  </div>
                ) : (
                  colItems.map(item => {
                    const sprint = sprints.find(s => s.id === item.sprint_id)
                    const release = releases.find(r => r.id === item.release_id)

                    return (
                      <div
                        key={item.key}
                        draggable
                        onDragStart={e => handleDragStart(e, item.key)}
                        onClick={() => onSelectWorkItem(item)}
                        data-testid={`kanban-item-${item.key}`}
                        className="group bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700/80 p-3 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer flex flex-col gap-2"
                      >
                        {/* Top: Key & Badges */}
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span className="font-mono text-sm font-bold text-indigo-400 group-hover:text-indigo-300 transition">
                            {item.key}
                          </span>

                          <div className="flex items-center gap-1">
                            <PriorityBadge priority={item.priority} />
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="font-medium text-sm text-zinc-200 group-hover:text-white leading-snug line-clamp-2">
                          {item.title}
                        </h4>

                        {/* Description Preview */}
                        {item.description && (
                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        {/* Parent Key Subtask Indicator */}
                        {item.parent_key && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                            <CornerDownRight className="w-2.5 h-2.5 text-zinc-600" />
                            <span>Subtask of {item.parent_key}</span>
                          </div>
                        )}

                        {/* Footer: Sprint/Release pills and Metadata */}
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                          <div className="flex items-center gap-1 flex-wrap min-w-0">
                            {sprint && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-amber-400 border border-zinc-800 leading-none truncate max-w-[100px]">
                                {sprint.name}
                              </span>
                            )}
                            {release && (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-indigo-300 border border-zinc-800 leading-none truncate max-w-[100px]">
                                {release.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            {item.context && item.context.summary && (
                              <span
                                title="Context Documented"
                                className="text-purple-400 flex items-center"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                              </span>
                            )}
                            {item.progress && item.progress.length > 0 && (
                              <span
                                title={`${item.progress.length} Progress updates`}
                                className="flex items-center gap-0.5 font-mono text-zinc-400"
                              >
                                <GitCommit className="w-2.5 h-2.5" />
                                <span>{item.progress.length}</span>
                              </span>
                            )}
                            {item.active_assignee && (
                              <span
                                title={`Assignee: ${item.active_assignee}`}
                                className="flex items-center gap-1 bg-zinc-800/60 px-1.5 py-0.5 rounded-full border border-zinc-800"
                              >
                                <UserIcon className="w-2.5 h-2.5 text-zinc-400" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: New Work Item */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        closeOnOverlayClick={false}
        title={
          <div className="flex items-center gap-2">
            <Columns3 className="w-4 h-4 text-indigo-400" />
            <span>Create New Work Item</span>
          </div>
        }
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Implement user authentication flow"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Detailed description or requirements..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              >
                {effectiveStatuses.map(st => (
                  <option key={st.id || st.name} value={st.name}>
                    {formatStatus(st.name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Assign to Sprint
              </label>
              <select
                value={sprintId}
                onChange={e => setSprintId(e.target.value)}
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              >
                <option value="">No Sprint (Backlog)</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Assign to Release
              </label>
              <select
                value={releaseId}
                onChange={e => setReleaseId(e.target.value)}
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              >
                <option value="">No Release Assigned</option>
                {releases.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
              Parent Work Item Key (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. DAV-1 (creates a subtask)"
              value={parentKey}
              onChange={e => setParentKey(e.target.value)}
              className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm font-mono uppercase text-zinc-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
