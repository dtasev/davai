import { useState, useMemo, FormEvent } from 'react'
import {
  ListTodo,
  Plus,
  Search,
  CornerDownRight,
  User as UserIcon,
  Sparkles,
  GitCommit
} from 'lucide-react'
import { WorkItem, Sprint, Release, ProjectStatus } from '../../types'
import { PriorityBadge, StatusBadge } from '../Common/Badge'
import { Modal } from '../Common/Modal'

interface WorkItemListProps {
  workItems: WorkItem[]
  sprints: Sprint[]
  releases: Release[]
  statuses: ProjectStatus[]
  onSelectWorkItem: (item: WorkItem) => void
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

export function WorkItemList({
  workItems,
  sprints,
  releases,
  statuses,
  onSelectWorkItem,
  onCreateWorkItem
}: WorkItemListProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [descr, setDescr] = useState('')
  const [status, setStatus] = useState(statuses[0]?.name || 'todo')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [parentKey, setParentKey] = useState('')
  const [sprintId, setSprintId] = useState<string>('')
  const [releaseId, setReleaseId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const filteredItems = useMemo(() => {
    return workItems.filter(item => {
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.key.toLowerCase().includes(search.toLowerCase()) ||
        (item.descr && item.descr.toLowerCase().includes(search.toLowerCase()))

      const matchesStatus =
        filterStatus === 'ALL' ||
        item.status.toLowerCase() === filterStatus.toLowerCase()

      return matchesSearch && matchesStatus
    })
  }, [workItems, search, filterStatus])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    try {
      await onCreateWorkItem({
        title: title.trim(),
        descr: descr.trim(),
        status,
        priority,
        parent_key: parentKey.trim() || null,
        sprint_id: sprintId ? parseInt(sprintId, 10) : null,
        release_id: releaseId ? parseInt(releaseId, 10) : null
      })
      setIsModalOpen(false)
      setTitle('')
      setDescr('')
      setParentKey('')
      setSprintId('')
      setReleaseId('')
      setPriority('MEDIUM')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-3.5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ListTodo className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              <span>Work Items</span>
              <span className="text-xs font-mono text-zinc-500 font-normal">
                ({workItems.length})
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Tasks, stories, and engineering issues
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 pr-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-32 sm:w-40"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              {statuses.map(st => (
                <option key={st.id} value={st.name}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1 transition shadow-sm"
            data-testid="create-work-item-button"
          >
            <Plus className="w-3 h-3" />
            <span>New Item</span>
          </button>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg text-xs text-zinc-500">
          {workItems.length === 0
            ? 'No work items created yet for this project.'
            : 'No work items match the search / filter criteria.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => {
            const sprint = sprints.find(s => s.id === item.sprint_id)
            const release = releases.find(r => r.id === item.release_id)

            return (
              <div
                key={item.key}
                onClick={() => onSelectWorkItem(item)}
                className="group px-3.5 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-850/60 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                data-testid={`work-item-${item.key}`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-indigo-400 group-hover:text-indigo-300 transition">
                      {item.key}
                    </span>

                    {item.parent_key && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded leading-none">
                        <CornerDownRight className="w-2.5 h-2.5" />
                        <span>Subtask of {item.parent_key}</span>
                      </span>
                    )}

                    <PriorityBadge priority={item.priority} />
                    <StatusBadge status={item.status} />

                    {sprint && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 leading-none">
                        {sprint.name}
                      </span>
                    )}

                    {release && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 leading-none">
                        {release.name}
                      </span>
                    )}
                  </div>

                  <h4 className="font-medium text-xs sm:text-sm text-zinc-200 group-hover:text-white transition truncate">
                    {item.title}
                  </h4>

                  {item.descr && (
                    <p className="text-[11px] text-zinc-400 line-clamp-1">
                      {item.descr}
                    </p>
                  )}
                </div>

                {/* Meta pills on right */}
                <div className="flex items-center gap-2.5 self-start sm:self-center text-xs text-zinc-500 shrink-0">
                  {item.context && item.context.t && (
                    <span
                      title="LLM Agent Context Documented"
                      className="flex items-center gap-1 text-[10px] font-mono text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-800/30 leading-none"
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Context</span>
                    </span>
                  )}

                  {item.progress && item.progress.length > 0 && (
                    <span
                      title={`${item.progress.length} Progress updates`}
                      className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded leading-none"
                    >
                      <GitCommit className="w-2.5 h-2.5 text-zinc-400" />
                      <span>{item.progress.length}</span>
                    </span>
                  )}

                  {item.active_assignee && (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-zinc-700/40 leading-none">
                      <UserIcon className="w-2.5 h-2.5 text-zinc-500" />
                      <span>{item.active_assignee}</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: New Work Item */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-emerald-400" />
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
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-xs text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Detailed description or requirements..."
              value={descr}
              onChange={e => setDescr(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-xs text-zinc-200"
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
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
              >
                {statuses.map(st => (
                  <option key={st.id} value={st.name}>
                    {st.name}
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
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
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
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
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
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
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
              className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono uppercase text-zinc-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
