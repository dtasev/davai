import { useState, useMemo, useRef, useEffect, FormEvent } from 'react'
import {
  ListTodo,
  Plus,
  Search,
  CornerDownRight,
  User as UserIcon,
  Sparkles,
  GitCommit,
  ChevronDown,
  Loader2
} from 'lucide-react'
import {
  WorkItem,
  Sprint,
  Release,
  ProjectStatus,
  DEFAULT_PROJECT_STATUSES,
  SearchItemResult,
  SearchResponse
} from '../../types'
import { PriorityBadge, StatusBadge, formatStatus } from '../Common/Badge'
import { Modal } from '../Common/Modal'
import { apiFetch } from '../../utils/apiFetch'

interface WorkItemListProps {
  projectKey?: string
  workItems: WorkItem[]
  sprints: Sprint[]
  releases: Release[]
  statuses: ProjectStatus[]
  myIssuesOnly?: boolean
  onToggleMyIssues?: () => void
  currentUsername?: string
  onSelectWorkItem: (item: WorkItem) => void
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

export function WorkItemList({
  projectKey,
  workItems,
  sprints,
  releases,
  statuses,
  myIssuesOnly,
  onToggleMyIssues,
  currentUsername,
  onSelectWorkItem,
  onCreateWorkItem
}: WorkItemListProps) {
  const effectiveProjectKey = projectKey || workItems[0]?.project_key || 'DAV'
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<'hybrid' | 'keyword'>('hybrid')
  const [searchResults, setSearchResults] = useState<SearchItemResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)

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

  // Close status dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsStatusDropdownOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsStatusDropdownOpen(false)
      }
    }
    if (isStatusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isStatusDropdownOpen])

  const toggleStatus = (statusName: string) => {
    const norm = statusName.toLowerCase()
    setSelectedStatuses(prev => {
      if (prev.includes(norm)) {
        return prev.filter(s => s !== norm)
      } else {
        return [...prev, norm]
      }
    })
  }

  const selectOnly = (statusName: string) => {
    setSelectedStatuses([statusName.toLowerCase()])
  }

  const selectAll = () => {
    setSelectedStatuses(effectiveStatuses.map(st => st.name.toLowerCase()))
  }

  const selectAllExceptDone = () => {
    setSelectedStatuses(
      effectiveStatuses.map(st => st.name.toLowerCase()).filter(name => name !== 'done')
    )
  }

  const clearAll = () => {
    setSelectedStatuses([])
  }

  const isAllSelected =
    effectiveStatuses.length > 0 &&
    effectiveStatuses.every(st => selectedStatuses.includes(st.name.toLowerCase()))
  const isDoneExcluded =
    !selectedStatuses.includes('done') &&
    effectiveStatuses.filter(s => s.name.toLowerCase() !== 'done').length > 0 &&
    effectiveStatuses
      .filter(s => s.name.toLowerCase() !== 'done')
      .every(st => selectedStatuses.includes(st.name.toLowerCase()))

  const statusButtonLabel = useMemo(() => {
    if (selectedStatuses.length === 0) return 'No Statuses'
    if (isAllSelected) return 'All Statuses'
    if (isDoneExcluded) return 'Statuses (Done hidden)'
    if (selectedStatuses.length === 1) {
      return formatStatus(selectedStatuses[0])
    }
    return `Statuses (${selectedStatuses.length})`
  }, [selectedStatuses, isAllSelected, isDoneExcluded])

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState(effectiveStatuses[0]?.name || 'todo')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [parentKey, setParentKey] = useState('')
  const [sprintId, setSprintId] = useState<string>('')
  const [releaseId, setReleaseId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Debounced semantic/hybrid search
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
          `/api/projects/${effectiveProjectKey}/search?q=${encodeURIComponent(q)}&mode=${searchMode}`,
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

    // If using backend search, take items from searchResults in relevance order
    const candidateItems = isUsingBackendSearch
      ? searchResults.map(r => r.work_item)
      : workItems

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

    // If using backend search, preserve semantic relevance ranking!
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
  }, [workItems, searchResults, search, selectedStatuses, isMyIssuesOnly, currentUsername])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

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
    <div className="space-y-3">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ListTodo className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              <span>Work Items</span>
              <span className="text-sm font-mono text-zinc-500 font-normal">
                ({workItems.length})
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Tasks, stories, and engineering issues
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar & mode toggle */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={searchMode === 'hybrid' ? 'Semantic search...' : 'Search items...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-7 pr-7 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-52"
              />
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            <button
              type="button"
              onClick={() => setSearchMode(prev => prev === 'hybrid' ? 'keyword' : 'hybrid')}
              data-testid="search-mode-toggle"
              aria-label={`Toggle search mode: current is ${searchMode}`}
              title={searchMode === 'hybrid' ? 'Semantic AI vector search active. Click to switch to keyword matching.' : 'Exact keyword search active. Click to switch to AI semantic search.'}
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

          {/* Status Multi-Select Filter */}
          <div className="relative" ref={statusDropdownRef}>
            <button
              type="button"
              data-testid="status-filter-dropdown-button"
              onClick={() => setIsStatusDropdownOpen(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={isStatusDropdownOpen}
              className={`px-2.5 py-1.5 rounded-lg border text-sm flex items-center gap-2 transition focus:outline-none ${
                isStatusDropdownOpen
                  ? 'bg-zinc-800 border-indigo-500 text-zinc-100 shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700'
              }`}
            >
              <span className="truncate max-w-[130px] sm:max-w-none">{statusButtonLabel}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ${
                  isStatusDropdownOpen ? 'rotate-180 text-indigo-400' : ''
                }`}
              />
            </button>

            {isStatusDropdownOpen && (
              <div
                data-testid="status-filter-dropdown-menu"
                className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden"
              >
                {/* Header Actions */}
                <div className="px-3 py-1.5 border-b border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="font-semibold text-zinc-300">Filter by Status</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="status-filter-select-all"
                      onClick={selectAll}
                      className="hover:text-indigo-400 transition text-[11px]"
                    >
                      All
                    </button>
                    <span className="text-zinc-700">|</span>
                    <button
                      type="button"
                      data-testid="status-filter-hide-done"
                      onClick={selectAllExceptDone}
                      className="hover:text-indigo-400 transition text-[11px]"
                      title="Hide Done statuses"
                    >
                      Hide Done
                    </button>
                    <span className="text-zinc-700">|</span>
                    <button
                      type="button"
                      data-testid="status-filter-clear"
                      onClick={clearAll}
                      className="hover:text-rose-400 transition text-[11px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Status Options */}
                <div className="max-h-60 overflow-y-auto py-1 divide-y divide-zinc-800/40">
                  {effectiveStatuses.map(st => {
                    const normSt = st.name.toLowerCase()
                    const isSelected = selectedStatuses.includes(normSt)
                    const count = workItems.filter(item => {
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

                    return (
                      <div
                        key={st.id || st.name}
                        data-testid={`status-option-${normSt.replace(/\s+/g, '-')}`}
                        onClick={() => toggleStatus(st.name)}
                        className={`flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800/60 cursor-pointer transition select-none group ${
                          isSelected ? 'bg-zinc-800/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            data-testid={`status-checkbox-${normSt.replace(/\s+/g, '-')}`}
                            checked={isSelected}
                            onChange={() => {}} // Row onClick handles toggling
                            className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer accent-indigo-600 shrink-0"
                          />
                          <span
                            className={`text-xs truncate capitalize ${
                              isSelected ? 'text-zinc-200 font-medium' : 'text-zinc-400'
                            }`}
                          >
                            {formatStatus(st.name)}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono ml-auto mr-1">
                            ({count})
                          </span>
                        </div>

                        <button
                          type="button"
                          data-testid={`status-only-${normSt.replace(/\s+/g, '-')}`}
                          onClick={e => {
                            e.stopPropagation()
                            selectOnly(st.name)
                          }}
                          className="px-1.5 py-0.5 text-[10px] font-mono lowercase text-zinc-500 hover:text-indigo-300 hover:bg-indigo-950/80 border border-zinc-800/80 hover:border-indigo-700/60 rounded transition shrink-0 ml-1.5"
                          title={`Show only ${formatStatus(st.name)}`}
                        >
                          only
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium flex items-center gap-1 transition shadow-sm"
            data-testid="create-work-item-button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Item</span>
          </button>
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl text-sm text-zinc-500 bg-zinc-900/30">
          {workItems.length === 0
            ? 'No work items created yet for this project.'
            : 'No work items match the search / filter criteria.'}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/80 overflow-hidden shadow-sm">
          {filteredItems.map(item => {
            const sprint = sprints.find(s => s.id === item.sprint_id)
            const release = releases.find(r => r.id === item.release_id)

            return (
              <div
                key={item.key}
                onClick={() => onSelectWorkItem(item)}
                className="group px-4 py-3 hover:bg-zinc-800/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                data-testid={`work-item-${item.key}`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-indigo-400 group-hover:text-indigo-300 transition">
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

                    {sprint && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-amber-400 border border-zinc-800 leading-none">
                        {sprint.name}
                      </span>
                    )}

                    {release && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-indigo-300 border border-zinc-800 leading-none">
                        {release.name}
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

      {/* Modal: New Work Item */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        closeOnOverlayClick={false}
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
