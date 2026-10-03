import { useState, useMemo, useEffect, FormEvent } from 'react'
import {
  Flame,
  Plus,
  Search,
  Sparkles,
  Loader2,
  ListTree,
  Activity,
  Clock
} from 'lucide-react'
import {
  Incident,
  DEFAULT_INCIDENT_STATUSES,
  IncidentSearchResult,
  IncidentSearchResponse
} from '../../types'
import { StatusBadge, formatStatus } from '../Common/Badge'
import { StatusFilterDropdown } from '../Common/StatusFilterDropdown'
import { Modal } from '../Common/Modal'
import { apiFetch } from '../../utils/apiFetch'

interface IncidentListProps {
  projectKey: string
  incidents: Incident[]
  onSelectIncident: (incident: Incident) => void
  onCreateIncident: (data: {
    title: string
    cause: string
    investigation_note: string
    status: string
    work_item_keys?: string[]
  }) => Promise<void>
}

export function IncidentList({
  projectKey,
  incidents,
  onSelectIncident,
  onCreateIncident
}: IncidentListProps) {
  const effectiveProjectKey = projectKey || incidents[0]?.project_key || 'DAV'
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<'hybrid' | 'keyword'>('hybrid')
  const [searchResults, setSearchResults] = useState<IncidentSearchResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // "no longer relevant" disabled by default
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() =>
    DEFAULT_INCIDENT_STATUSES
      .map(st => st.name.toLowerCase())
      .filter(name => name !== 'no longer relevant')
  )

  // Create form state
  const [title, setTitle] = useState('')
  const [cause, setCause] = useState('')
  const [investigationNote, setInvestigationNote] = useState('')
  const [status, setStatus] = useState('reported')
  const [workItemKeysInput, setWorkItemKeysInput] = useState('')
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
          `/api/projects/${effectiveProjectKey}/incidents/search?q=${encodeURIComponent(q)}&mode=${searchMode}`,
          { signal: controller.signal }
        )
        if (res.ok) {
          const data: IncidentSearchResponse = await res.json()
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
    const map = new Map<string, IncidentSearchResult>()
    for (const r of searchResults) {
      map.set(r.incident.key, r)
    }
    return map
  }, [searchResults])

  const filteredIncidents = useMemo(() => {
    const isUsingBackendSearch = searchResults !== null

    const candidateItems = isUsingBackendSearch
      ? searchResults.map(r => r.incident)
      : incidents

    const filtered = candidateItems.filter(inc => {
      // If searching via keyword or semantic, "no longer relevant" is always excluded from searches
      if (search.trim() && (inc.status || '').toLowerCase() === 'no longer relevant') {
        return false
      }

      if (!isUsingBackendSearch && search.trim()) {
        const q = search.toLowerCase()
        const matchesSearch =
          inc.title.toLowerCase().includes(q) ||
          inc.key.toLowerCase().includes(q) ||
          (inc.cause && inc.cause.toLowerCase().includes(q)) ||
          (inc.investigation_note && inc.investigation_note.toLowerCase().includes(q))
        if (!matchesSearch) return false
      }

      const incStatus = (inc.status || 'reported').toLowerCase()
      return selectedStatuses.includes(incStatus)
    })

    if (isUsingBackendSearch) {
      return filtered
    }

    return [...filtered].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
      if (timeB !== timeA) return timeB - timeA
      return (b.id || 0) - (a.id || 0)
    })
  }, [incidents, searchResults, search, selectedStatuses])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    try {
      const keys = workItemKeysInput
        .split(',')
        .map(k => k.trim().toUpperCase())
        .filter(Boolean)

      await onCreateIncident({
        title: title.trim(),
        cause: cause.trim(),
        investigation_note: investigationNote.trim(),
        status,
        work_item_keys: keys.length > 0 ? keys : undefined
      })
      setIsModalOpen(false)
      setTitle('')
      setCause('')
      setInvestigationNote('')
      setStatus('reported')
      setWorkItemKeysInput('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3" data-testid="incident-list-view">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              <span>Incidents</span>
              <span className="text-sm font-mono text-zinc-500 font-normal">
                ({incidents.length})
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Tracked operational incidents, root causes, and recurrence checks
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
                placeholder={searchMode === 'hybrid' ? 'Semantic search...' : 'Search incidents...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="incident-search-input"
                className="pl-7 pr-7 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-52"
              />
              {isSearching && (
                <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            <button
              type="button"
              onClick={() => setSearchMode(prev => (prev === 'hybrid' ? 'keyword' : 'hybrid'))}
              data-testid="search-mode-toggle"
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
              <Sparkles
                className={`w-3.5 h-3.5 ${
                  searchMode === 'hybrid' ? 'text-purple-400' : 'text-zinc-500'
                }`}
              />
              <span className="hidden sm:inline">
                {searchMode === 'hybrid' ? 'Semantic' : 'Keyword'}
              </span>
            </button>
          </div>

          {/* Status Multi-Select Filter ("no longer relevant" disabled by default) */}
          <StatusFilterDropdown
            statuses={DEFAULT_INCIDENT_STATUSES}
            selectedStatuses={selectedStatuses}
            onChangeSelectedStatuses={setSelectedStatuses}
            getCountForStatus={normSt =>
              incidents.filter(inc => (inc.status || 'reported').toLowerCase() === normSt).length
            }
            excludedByDefault={['no longer relevant']}
            hideExcludedLabel="Hide Irrelevant"
            hideExcludedTitle="Hide No Longer Relevant incidents"
            excludedButtonSummary="Statuses (Relevant)"
          />

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium flex items-center gap-1 transition shadow-sm"
            data-testid="create-incident-button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Incident</span>
          </button>
        </div>
      </div>

      {/* Incidents List */}
      {filteredIncidents.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl text-sm text-zinc-500 bg-zinc-900/30">
          {incidents.length === 0
            ? 'No incidents reported yet for this project.'
            : 'No incidents match the search / filter criteria.'}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/80 overflow-hidden shadow-sm">
          {filteredIncidents.map(inc => {
            const matchInfo = searchResultMap?.get(inc.key)
            return (
              <div
                key={inc.key}
                onClick={() => onSelectIncident(inc)}
                className="group px-4 py-3 hover:bg-zinc-800/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                data-testid={`incident-item-${inc.key}`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-rose-400 group-hover:text-rose-300 transition">
                      {inc.key}
                    </span>

                    <StatusBadge status={inc.status} />

                    {matchInfo && (
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/60 leading-none flex items-center gap-1"
                        title={`Match type: ${matchInfo.match_type}, Score: ${matchInfo.score}`}
                      >
                        <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                        <span>{Math.round(matchInfo.score * 100)}% match</span>
                      </span>
                    )}
                  </div>

                  <h4 className="font-medium text-sm text-zinc-200 group-hover:text-white transition truncate">
                    {inc.title}
                  </h4>

                  {matchInfo && matchInfo.snippet ? (
                    <p className="text-[11px] text-zinc-300 line-clamp-2 bg-zinc-950/40 px-2 py-1 rounded border border-zinc-800/60 font-mono text-[10px]">
                      <span className="text-zinc-500 mr-1.5">Snippet:</span>
                      {matchInfo.snippet}
                    </p>
                  ) : inc.investigation_note ? (
                    <p className="text-[11px] text-zinc-400 truncate">
                      <span className="text-zinc-500 mr-1">Check:</span>
                      {inc.investigation_note}
                    </p>
                  ) : inc.cause ? (
                    <p className="text-[11px] text-zinc-400 truncate">
                      {inc.cause}
                    </p>
                  ) : null}
                </div>

                {/* Meta pills on right */}
                <div className="flex items-center gap-2 self-start sm:self-center text-sm text-zinc-500 shrink-0">
                  {inc.work_items && inc.work_items.length > 0 && (
                    <span
                      title={`${inc.work_items.length} Linked Work Items`}
                      className="flex items-center gap-1 text-[10px] font-mono text-indigo-400 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-800/40 leading-none"
                    >
                      <ListTree className="w-2.5 h-2.5" />
                      <span>{inc.work_items.length}</span>
                    </span>
                  )}

                  {inc.monitoring_logs && inc.monitoring_logs.length > 0 && (
                    <span
                      title={`${inc.monitoring_logs.length} Linked Monitoring Logs`}
                      className="flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40 leading-none"
                    >
                      <Activity className="w-2.5 h-2.5" />
                      <span>{inc.monitoring_logs.length}</span>
                    </span>
                  )}

                  <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{new Date(inc.created_at).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: New Incident */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        closeOnOverlayClick={false}
        title={
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400" />
            <span>Create New Incident</span>
          </div>
        }
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5" data-testid="create-incident-form">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Redis connection pool exhaustion on worker nodes"
              value={title}
              onChange={e => setTitle(e.target.value)}
              data-testid="create-incident-title-input"
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Investigation Cause &amp; Details
            </label>
            <textarea
              rows={3}
              placeholder="Root cause analysis, symptoms, and timeline details..."
              value={cause}
              onChange={e => setCause(e.target.value)}
              data-testid="create-incident-cause-input"
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Quick Investigation Note (Recurrence Check)
            </label>
            <textarea
              rows={2}
              placeholder="Specific checks to confirm or deny whether this incident is happening again..."
              value={investigationNote}
              onChange={e => setInvestigationNote(e.target.value)}
              data-testid="create-incident-note-input"
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
                data-testid="create-incident-status-select"
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              >
                {DEFAULT_INCIDENT_STATUSES.map(st => (
                  <option key={st.id || st.name} value={st.name}>
                    {formatStatus(st.name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Linked Work Items (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. DAV-1, DAV-2"
                value={workItemKeysInput}
                onChange={e => setWorkItemKeysInput(e.target.value)}
                data-testid="create-incident-work-items-input"
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm font-mono uppercase text-zinc-200"
              />
            </div>
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
              data-testid="submit-create-incident-button"
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Incident'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
