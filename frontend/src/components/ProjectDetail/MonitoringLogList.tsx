import { useState, useMemo, FormEvent } from 'react'
import {
  Activity,
  Plus,
  Search,
  Sparkles,
  Bot,
  Flame,
  ExternalLink,
  Clock
} from 'lucide-react'
import {
  MonitoringLog,
  DEFAULT_MONITORING_LOG_STATUSES
} from '../../types'
import { StatusBadge, formatStatus } from '../Common/Badge'
import { StatusFilterDropdown } from '../Common/StatusFilterDropdown'
import { Modal } from '../Common/Modal'

interface MonitoringLogListProps {
  projectKey: string
  monitoringLogs: MonitoringLog[]
  onSelectMonitoringLog: (log: MonitoringLog) => void
  onCreateMonitoringLog: (data: {
    agent_id: string
    description: string
    status: string
    incident_id?: string | null
    jira_url?: string
  }) => Promise<void>
}

export function MonitoringLogList({
  monitoringLogs,
  onSelectMonitoringLog,
  onCreateMonitoringLog
}: MonitoringLogListProps) {
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<'hybrid' | 'keyword'>('keyword')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() =>
    DEFAULT_MONITORING_LOG_STATUSES.map(st => st.name.toLowerCase())
  )

  // Form state
  const [agentId, setAgentId] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('ok')
  const [incidentIdInput, setIncidentIdInput] = useState('')
  const [jiraUrl, setJiraUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filteredLogs = useMemo(() => {
    return monitoringLogs
      .filter(log => {
        if (search.trim()) {
          const q = search.toLowerCase()
          const matchesSearch =
            log.key.toLowerCase().includes(q) ||
            (log.agent_id && log.agent_id.toLowerCase().includes(q)) ||
            (log.description && log.description.toLowerCase().includes(q)) ||
            (log.incident_key && log.incident_key.toLowerCase().includes(q)) ||
            (log.jira_url && log.jira_url.toLowerCase().includes(q))
          if (!matchesSearch) return false
        }

        const logStatus = (log.status || 'ok').toLowerCase()
        return selectedStatuses.includes(logStatus)
      })
      .sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
        if (timeB !== timeA) return timeB - timeA
        return (b.id || 0) - (a.id || 0)
      })
  }, [monitoringLogs, search, selectedStatuses])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return

    setSubmitting(true)
    try {
      await onCreateMonitoringLog({
        agent_id: agentId.trim(),
        description: description.trim(),
        status,
        incident_id: incidentIdInput.trim() || null,
        jira_url: jiraUrl.trim()
      })
      setIsModalOpen(false)
      setAgentId('')
      setDescription('')
      setStatus('ok')
      setIncidentIdInput('')
      setJiraUrl('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3" data-testid="monitoring-log-list-view">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              <span>Monitoring Logs</span>
              <span className="text-sm font-mono text-zinc-500 font-normal">
                ({monitoringLogs.length})
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Automated check runs, agent identity reports, and incident evidence
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar & mode toggle */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search logs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="monitoring-log-search-input"
                className="pl-7 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-full sm:w-52"
              />
            </div>

            <button
              type="button"
              onClick={() => setSearchMode(prev => (prev === 'hybrid' ? 'keyword' : 'hybrid'))}
              data-testid="search-mode-toggle"
              aria-label={`Toggle search mode: current is ${searchMode}`}
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

          <StatusFilterDropdown
            statuses={DEFAULT_MONITORING_LOG_STATUSES}
            selectedStatuses={selectedStatuses}
            onChangeSelectedStatuses={setSelectedStatuses}
            getCountForStatus={normSt =>
              monitoringLogs.filter(log => (log.status || 'ok').toLowerCase() === normSt).length
            }
            excludedByDefault={[]}
          />

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium flex items-center gap-1 transition shadow-sm shrink-0"
            data-testid="create-monitoring-log-button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Log</span>
          </button>
        </div>
      </div>

      {/* Monitoring Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl text-sm text-zinc-500 bg-zinc-900/30">
          {monitoringLogs.length === 0
            ? 'No monitoring logs recorded yet for this project.'
            : 'No monitoring logs match the search / filter criteria.'}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/80 overflow-hidden shadow-sm">
          {filteredLogs.map(log => (
            <div
              key={log.key}
              onClick={() => onSelectMonitoringLog(log)}
              className="group px-4 py-3 hover:bg-zinc-800/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              data-testid={`monitoring-log-item-${log.key}`}
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-amber-400 group-hover:text-amber-300 transition">
                    {log.key}
                  </span>

                  <StatusBadge status={log.status} />

                  {log.agent_id && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-indigo-300 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-800/40 leading-none">
                      <Bot className="w-2.5 h-2.5 text-indigo-400" />
                      <span>{log.agent_id}</span>
                    </span>
                  )}

                  {log.incident_key && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-rose-300 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-800/40 leading-none">
                      <Flame className="w-2.5 h-2.5 text-rose-400" />
                      <span>{log.incident_key}</span>
                    </span>
                  )}

                  {log.jira_url && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-sky-300 bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-800/40 leading-none">
                      <ExternalLink className="w-2.5 h-2.5 text-sky-400" />
                      <span>JIRA</span>
                    </span>
                  )}
                </div>

                <p className="text-sm text-zinc-200 group-hover:text-white transition truncate font-mono">
                  {log.description}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center text-sm text-zinc-500 shrink-0">
                <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New Monitoring Log */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        closeOnOverlayClick={false}
        title={
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <span>Record Monitoring Log</span>
          </div>
        }
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5" data-testid="create-monitoring-log-form">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                data-testid="create-monitoring-log-status-select"
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              >
                {DEFAULT_MONITORING_LOG_STATUSES.map(st => (
                  <option key={st.id || st.name} value={st.name}>
                    {formatStatus(st.name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Agent ID (agent/model/session-id)
              </label>
              <input
                type="text"
                placeholder="e.g. agent/model/session-id"
                value={agentId}
                onChange={e => setAgentId(e.target.value)}
                data-testid="create-monitoring-log-agent-id-input"
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Run Description / Log
            </label>
            <textarea
              required
              rows={4}
              placeholder="Output or description of the monitoring check run..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              data-testid="create-monitoring-log-description-input"
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm font-mono text-zinc-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Linked Davai Incident (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. DAV-INC-1"
                value={incidentIdInput}
                onChange={e => setIncidentIdInput(e.target.value)}
                data-testid="create-monitoring-log-incident-input"
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm font-mono uppercase text-zinc-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                JIRA Incident URL (Optional)
              </label>
              <input
                type="text"
                placeholder="https://jira.example.com/browse/..."
                value={jiraUrl}
                onChange={e => setJiraUrl(e.target.value)}
                data-testid="create-monitoring-log-jira-input"
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
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
              disabled={submitting || !description.trim()}
              data-testid="submit-create-monitoring-log-button"
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Log'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
