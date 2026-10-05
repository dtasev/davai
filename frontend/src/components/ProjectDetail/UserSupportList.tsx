import { useState, useMemo, useRef, useEffect, FormEvent } from 'react'
import {
  LifeBuoy,
  Plus,
  Search,
  CornerDownRight,
  User as UserIcon,
  Sparkles,
  GitCommit,
  Loader2,
  Calendar
} from 'lucide-react'
import {
  WorkItem,
  ProjectStatus,
  DEFAULT_PROJECT_STATUSES,
  SearchItemResult,
  SearchResponse
} from '../../types'
import { PriorityBadge, StatusBadge, formatStatus } from '../Common/Badge'
import { StatusFilterDropdown } from '../Common/StatusFilterDropdown'
import { Modal } from '../Common/Modal'
import { apiFetch } from '../../utils/apiFetch'
import { formatItemDates } from './WorkItemList'

interface UserSupportListProps {
  projectKey?: string
  userSupportItems: WorkItem[]
  statuses: ProjectStatus[]
  myIssuesOnly?: boolean
  onToggleMyIssues?: () => void
  currentUsername?: string
  onSelectUserSupportItem: (item: WorkItem) => void
  onCreateUserSupportItem: (data: {
    title: string
    description: string
    status: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    parent_key?: string | null
  }) => Promise<void>
}

export function UserSupportList({
  projectKey,
  userSupportItems,
  statuses,
  myIssuesOnly,
  onToggleMyIssues,
  currentUsername,
  onSelectUserSupportItem,
  onCreateUserSupportItem
}: UserSupportListProps) {
  const effectiveProjectKey = projectKey || userSupportItems[0]?.project_key || 'DAV'
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<'hybrid' | 'keyword'>('hybrid')
  const [searchResults, setSearchResults] = useState<SearchItemResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

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

  const effectiveStatuses = useMemo(() => {
    if (statuses && statuses.length > 0) {
      return [...statuses].sort((a, b) => a.order - b.order)
    }
    return DEFAULT_PROJECT_STATUSES
  }, [statuses])

  // Multi-select status filter state (DONE hidden by default)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    return effectiveStatuses
      .map(st => st.name.toLowerCase())
      .filter(name => name !== 'done')
  })

  // Synchronize when project statuses change
  const prevStatusesRef = useRef(effectiveStatuses.map(s => s.name.toLowerCase()).join(','))
  useEffect(() => {
    const currentKeys = effectiveStatuses.map(s => s.name.toLowerCase()).join(',')
    if (prevStatusesRef.current !== currentKeys) {
      prevStatusesRef.current = currentKeys
      setSelectedStatuses(effectiveStatuses.map(s => s.name.toLowerCase()).filter(n => n !== 'done'))
    }
  }, [effectiveStatuses])

  // Form state (no sprint or release)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState(effectiveStatuses[0]?.name || 'todo')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [parentKey, setParentKey] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Debounced semantic/hybrid search over user support tickets
  useEffect(() => {
    const q = search.trim()
    if (!q) {
      setSearchResults(null)
      setIsSearching(false)
      return
    }

    if (searchMode === 'keyword') {
      setSearchResults(null)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/projects/${effectiveProjectKey}/user-support/search?q=${encodeURIComponent(q)}&mode=${searchMode}`,
          { signal: controller.signal }
        )
        if (res.ok) {
          const data: SearchResponse = await res.json()
          setSearchResults(data.results)
        } else {
          setSearchResults(null)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setSearchResults(null)
        }
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, searchMode, effectiveProjectKey])

  const searchResultMap = useMemo(() => {
    if (!searchResults) return null
    const map = new Map<string, SearchItemResult>()
    for (const r of searchResults) {
      map.set(r.work_item.key, r)
    }
    return map
  }, [searchResults])

  const filteredItems = useMemo(() => {
    const isUsingBackendSearch = searchResults !== null

    const candidateItems = isUsingBackendSearch
      ? searchResults.map(r => r.work_item)
      : userSupportItems

    const filtered = candidateItems.filter(item => {
      if (!isUsingBackendSearch && search.trim()) {
        const q = search.toLowerCase()
        const matchesSearch =
          item.title.toLowerCase().includes(q) ||
          item.key.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        if (!matchesSearch) return false
      }

      const itemStatus = (item.status || 'todo').toLowerCase()
      const matchesStatus = selectedStatuses.some(st => {
        const norm = st.toLowerCase()
        if (norm === itemStatus) return true
        if (
          (norm === 'in progress' || norm === 'step completed') &&
          (itemStatus === 'in progress' || itemStatus === 'step completed')
        ) {
          return true
        }
        return false
      })

      const matchesMyIssues =
        !isMyIssuesOnly ||
        (currentUsername && (
          (item.active_assignee && item.active_assignee.toLowerCase() === currentUsername.toLowerCase()) ||
          (Array.isArray(item.assigned) && item.assigned.some(u => u.toLowerCase() === currentUsername.toLowerCase()))
        ))

      return matchesStatus && matchesMyIssues
    })

    if (isUsingBackendSearch) {
      return filtered
    }

    return filtered.sort((a, b) => {
      const timeA = a.created ? new Date(a.created).getTime() : 0
      const timeB = b.created ? new Date(b.created).getTime() : 0
      if (timeB !== timeA) return timeB - timeA
      const idA = typeof a.id === 'number' ? a.id : parseInt(String(a.id), 10) || 0
      const idB = typeof b.id === 'number' ? b.id : parseInt(String(b.id), 10) || 0
      if (idB !== idA) return idB - idA
      return String(b.key).localeCompare(String(a.key), undefined, { numeric: true })
    })
  }, [userSupportItems, searchResults, search, selectedStatuses, isMyIssuesOnly, currentUsername])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    try {
      await onCreateUserSupportItem({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        parent_key: parentKey.trim() || null
      })
      setIsModalOpen(false)
      setTitle('')
      setDescription('')
      setParentKey('')
      setPriority('MEDIUM')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3" data-testid="user-support-list-view">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <LifeBuoy className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              <span>User Support</span>
              <span className="text-sm font-mono text-zinc-500 font-normal">
                ({userSupportItems.length})
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Support tickets and user assistance requests ({effectiveProjectKey}-SUP-NN)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search bar & mode toggle */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={searchMode === 'hybrid' ? 'Semantic search...' : 'Search tickets...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="user-support-search-input"
                className="pl-7 pr-7 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-52"
              />
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            <button
              type="button"
              onClick={() => setSearchMode(prev => (prev === 'hybrid' ? 'keyword' : 'hybrid'))}
              data-testid="user-support-search-mode-toggle"
              aria-label={`Toggle search mode: current is ${searchMode}`}
              title={
                searchMode === 'hybrid'
                  ? 'Semantic AI vector search active. Click to switch to keyword matching.'
                  : 'Exact keyword search active. Click to switch to AI semantic search.'
              }
              className={`px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition shrink-0 ${
                searchMode === 'hybrid'
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${searchMode === 'hybrid' ? 'text-purple-400' : 'text-zinc-500'}`} />
              <span className="hidden sm:inline">{searchMode === 'hybrid' ? 'Semantic' : 'Keyword'}</span>
            </button>
          </div>

          {/* My Issues Filter Toggle */}
          <button
            type="button"
            onClick={handleToggle}
            data-testid="filter-my-support-issues-button"
            aria-pressed={isMyIssuesOnly}
            title={isMyIssuesOnly ? 'Showing my tickets (click to show all)' : 'Filter by tickets assigned to me'}
            className={`px-2.5 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition shrink-0 ${
              isMyIssuesOnly
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-sm'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <UserIcon className={`w-3.5 h-3.5 ${isMyIssuesOnly ? 'text-indigo-400' : 'text-zinc-500'}`} />
            <span>My Issues</span>
          </button>

          {/* Status Multi-Select Filter */}
          <StatusFilterDropdown
            statuses={effectiveStatuses}
            selectedStatuses={selectedStatuses}
            onChangeSelectedStatuses={setSelectedStatuses}
            getCountForStatus={normSt =>
              userSupportItems.filter(item => {
                const itemStatus = (item.status || 'todo').toLowerCase()
                if (itemStatus === normSt) return true
                if (
                  (normSt === 'in progress' || normSt === 'step completed') &&
                  (itemStatus === 'in progress' || itemStatus === 'step completed')
                ) {
                  return true
                }
                return false
              }).length
            }
            excludedByDefault={['done']}
            hideExcludedLabel="Hide Done"
            hideExcludedTitle="Hide Done statuses"
            excludedButtonSummary="Statuses (Done hidden)"
          />

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium flex items-center gap-1 transition shadow-sm"
            data-testid="create-user-support-button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl text-sm text-zinc-500 bg-zinc-900/30">
          {userSupportItems.length === 0
            ? 'No user support tickets created yet for this project.'
            : 'No user support tickets match the search / filter criteria.'}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/80 overflow-hidden shadow-sm">
          {filteredItems.map(item => {
            const dateLabel = formatItemDates(item.start_date, item.target_date)

            return (
              <div
                key={item.key}
                onClick={() => onSelectUserSupportItem(item)}
                className="group px-4 py-3 hover:bg-zinc-800/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                data-testid={`user-support-item-${item.key}`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-cyan-400 group-hover:text-cyan-300 transition">
                      {item.key}
                    </span>

                    {item.parent_key && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded leading-none">
                        <CornerDownRight className="w-2.5 h-2.5 text-zinc-500" />
                        <span>Subtask of {item.parent_key}</span>
                      </span>
                    )}

                    <PriorityBadge priority={item.priority} />
                    <StatusBadge status={item.status} />

                    {dateLabel && (
                      <span
                        data-testid={`user-support-dates-${item.key}`}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-800 leading-none flex items-center gap-1"
                        title={
                          item.start_date && item.target_date
                            ? `Timeline: ${dateLabel}`
                            : item.target_date
                            ? `Target date: ${dateLabel}`
                            : `Start date: ${dateLabel}`
                        }
                      >
                        <Calendar className="w-2.5 h-2.5 text-zinc-500" />
                        <span>{dateLabel}</span>
                      </span>
                    )}

                    {searchResultMap && searchResultMap.has(item.key) && (
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/60 leading-none flex items-center gap-1"
                        title={`Match type: ${searchResultMap.get(item.key)!.match_type}, Score: ${searchResultMap.get(item.key)!.score}`}
                      >
                        <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                        <span>{Math.round(searchResultMap.get(item.key)!.score * 100)}% match</span>
                      </span>
                    )}
                  </div>

                  <h4 className="font-medium text-sm text-zinc-200 group-hover:text-white transition truncate">
                    {item.title}
                  </h4>

                  {searchResultMap && searchResultMap.has(item.key) && searchResultMap.get(item.key)!.snippet ? (
                    <p className="text-[11px] text-zinc-300 line-clamp-2 bg-zinc-950/40 px-2 py-1 rounded border border-zinc-800/60 font-mono text-[10px]">
                      <span className="text-zinc-500 mr-1.5">Snippet:</span>
                      {searchResultMap.get(item.key)!.snippet}
                    </p>
                  ) : null}
                </div>

                {/* Meta pills on right */}
                <div className="flex items-center gap-2 self-start sm:self-center text-sm text-zinc-500 shrink-0">
                  {item.context && item.context.summary && (
                    <span
                      title="LLM Agent Context Documented"
                      className="flex items-center gap-1 text-[10px] font-mono text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-800/40 leading-none"
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
                    <span className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-zinc-800 leading-none">
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

      {/* Modal: New User Support Ticket */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        closeOnOverlayClick={false}
        title={
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-cyan-400" />
            <span>Create New User Support Ticket</span>
          </div>
        }
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5" data-testid="create-user-support-form">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. User unable to access dataset export"
              value={title}
              onChange={e => setTitle(e.target.value)}
              data-testid="user-support-title-input"
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Detailed support request or issue description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              data-testid="user-support-description-input"
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
                data-testid="user-support-status-select"
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
                data-testid="user-support-priority-select"
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
              Parent Ticket Key (Optional)
            </label>
            <input
              type="text"
              placeholder={`e.g. ${effectiveProjectKey}-SUP-1 (creates a subtask)`}
              value={parentKey}
              onChange={e => setParentKey(e.target.value)}
              data-testid="user-support-parent-key-input"
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
              data-testid="submit-user-support-button"
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
