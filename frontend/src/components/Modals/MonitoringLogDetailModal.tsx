import { useState, useEffect } from 'react'
import {
  Activity,
  Clock,
  Check,
  Copy,
  Trash2,
  AlertTriangle,
  Bot,
  Flame,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import { MonitoringLog, DEFAULT_MONITORING_LOG_STATUSES } from '../../types'
import { StatusBadge, formatStatus } from '../Common/Badge'
import { Modal } from '../Common/Modal'

interface MonitoringLogDetailModalProps {
  log: MonitoringLog | null
  onClose: () => void
  onSelectIncident?: (incidentKey: string) => void
  onUpdateLog?: (data: {
    who_are_you?: string
    description?: string
    status?: string
    incident_id?: string | null
    jira_url?: string
  }) => Promise<void>
  onDelete?: () => Promise<void>
}

export function MonitoringLogDetailModal({
  log,
  onClose,
  onSelectIncident,
  onUpdateLog,
  onDelete
}: MonitoringLogDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editWhoAreYou, setEditWhoAreYou] = useState(log?.who_are_you || '')
  const [editDescription, setEditDescription] = useState(log?.description || '')
  const [editStatus, setEditStatus] = useState(log?.status || 'ok')
  const [editIncidentKey, setEditIncidentKey] = useState(log?.incident_key || '')
  const [editJiraUrl, setEditJiraUrl] = useState(log?.jira_url || '')
  const [isSaving, setIsSaving] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasCopied, setHasCopied] = useState(false)

  useEffect(() => {
    if (log) {
      setEditWhoAreYou(log.who_are_you || '')
      setEditDescription(log.description || '')
      setEditStatus(log.status || 'ok')
      setEditIncidentKey(log.incident_key || '')
      setEditJiraUrl(log.jira_url || '')
      setShowDeleteConfirm(false)
    }
  }, [
    log?.key,
    log?.who_are_you,
    log?.description,
    log?.status,
    log?.incident_key,
    log?.jira_url
  ])

  if (!log) return null

  const handleSave = async () => {
    if (!onUpdateLog || !editDescription.trim()) return
    setIsSaving(true)
    try {
      await onUpdateLog({
        who_are_you: editWhoAreYou.trim(),
        description: editDescription.trim(),
        status: editStatus,
        incident_id: editIncidentKey.trim() || null,
        jira_url: editJiraUrl.trim()
      })
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditWhoAreYou(log.who_are_you || '')
    setEditDescription(log.description || '')
    setEditStatus(log.status || 'ok')
    setEditIncidentKey(log.incident_key || '')
    setEditJiraUrl(log.jira_url || '')
    setIsEditing(false)
  }

  const handleCopyDetails = () => {
    const textToCopy = [
      `ID: ${log.id}\nKey: ${log.key}\nStatus: ${log.status}\nWho Are You: ${log.who_are_you || 'N/A'}`,
      `Incident: ${log.incident_key || 'None'}\nJIRA: ${log.jira_url || 'None'}`,
      `Run Description:\n${log.description}`
    ].join('\n\n')
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).catch(() => {})
    }
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      maxWidth="max-w-2xl md:max-w-4xl lg:max-w-5xl"
      closeOnOverlayClick={!isEditing}
      headerActions={
        <div className="flex items-center gap-1.5">
          {isEditing && (
            <>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleCancelEdit}
                data-testid="cancel-edit-monitoring-log-button"
                className="px-2 py-1 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving || !editDescription.trim()}
                onClick={handleSave}
                data-testid="save-monitoring-log-button"
                className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleCopyDetails}
            title={hasCopied ? 'Copied to clipboard!' : 'Copy log details'}
            data-testid="copy-monitoring-log-button"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
          >
            {hasCopied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(prev => !prev)}
              title="Delete Monitoring Log"
              data-testid="delete-monitoring-log-button"
              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      }
      title={
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-amber-400">
                {log.key}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                (ID: {log.id})
              </span>
            </div>
            <h3 className="font-bold text-sm sm:text-base text-zinc-100 truncate">
              Monitoring Run Log
            </h3>
          </div>
        </div>
      }
    >
      <div className="space-y-4" data-testid="monitoring-log-detail-modal">
        {showDeleteConfirm && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-rose-300 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to delete this monitoring log?</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                data-testid="confirm-delete-monitoring-log-button"
                onClick={async () => {
                  if (!onDelete) return
                  setIsDeleting(true)
                  try {
                    await onDelete()
                  } catch {
                    setIsDeleting(false)
                  }
                }}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}

        {/* Meta Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Status:</span>
              {isEditing ? (
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  data-testid="edit-monitoring-log-status-select"
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200"
                >
                  {DEFAULT_MONITORING_LOG_STATUSES.map(st => (
                    <option key={st.id || st.name} value={st.name}>
                      {formatStatus(st.name)}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusBadge status={log.status} />
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Bot className="w-3 h-3 text-indigo-400" />
                <span>Who Are You:</span>
              </span>
              {isEditing ? (
                <input
                  type="text"
                  data-testid="edit-monitoring-log-who-input"
                  value={editWhoAreYou}
                  onChange={e => setEditWhoAreYou(e.target.value)}
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-indigo-500 text-xs text-zinc-200"
                />
              ) : log.who_are_you ? (
                <span
                  data-testid="monitoring-log-who-are-you"
                  className="font-mono text-xs text-indigo-300 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-800/40"
                >
                  {log.who_are_you}
                </span>
              ) : (
                <span className="text-xs text-zinc-500 italic">Not specified</span>
              )}
            </div>

            {!isEditing && log.jira_url && (
              <a
                href={log.jira_url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="monitoring-log-jira-link"
                className="flex items-center gap-1 text-xs font-mono text-sky-400 hover:text-sky-300 bg-sky-950/30 px-2 py-0.5 rounded border border-sky-800/40 transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span>{log.jira_url}</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-sm text-zinc-400">
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock className="w-3 h-3 text-zinc-500" />
              <span>{new Date(log.created_at).toLocaleString()}</span>
            </span>
          </div>
        </div>

        {/* Linked Incident & JIRA Edit Fields */}
        {isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Linked Davai Incident Key / ID
              </label>
              <input
                type="text"
                data-testid="edit-monitoring-log-incident-input"
                placeholder="e.g. DAV-INC-1"
                value={editIncidentKey}
                onChange={e => setEditIncidentKey(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-indigo-500 text-sm font-mono uppercase text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                JIRA Incident URL
              </label>
              <input
                type="text"
                data-testid="edit-monitoring-log-jira-input"
                placeholder="https://jira.example.com/browse/..."
                value={editJiraUrl}
                onChange={e => setEditJiraUrl(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-indigo-500 text-sm text-zinc-200"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                  Linked Davai Incident
                </h4>
              </div>
              {onUpdateLog && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                >
                  Edit Log
                </button>
              )}
            </div>

            {log.incident_key ? (
              <div
                onClick={() => onSelectIncident?.(log.incident_key!)}
                data-testid={`monitoring-log-linked-incident-${log.incident_key}`}
                className={`p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-2.5 text-sm group ${
                  onSelectIncident
                    ? 'hover:border-rose-500/40 hover:bg-zinc-900/40 cursor-pointer transition'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs sm:text-sm text-rose-400">
                    {log.incident_key}
                  </span>
                </div>
                {onSelectIncident && (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                )}
              </div>
            ) : (
              <div className="text-[11px] text-zinc-500 italic p-2 bg-zinc-950/40 rounded-lg border border-zinc-900">
                No Davai incident linked to this monitoring run.
              </div>
            )}
          </div>
        )}

        {/* Run Description / Log Output */}
        <div className="space-y-1 border-t border-zinc-800/80 pt-3">
          <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Run Description / Log
          </h4>
          {isEditing ? (
            <textarea
              data-testid="edit-monitoring-log-description-input"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              rows={6}
              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-indigo-500 text-sm font-mono text-zinc-200 focus:outline-none resize-y leading-relaxed"
            />
          ) : (
            <div
              onClick={() => onUpdateLog && setIsEditing(true)}
              data-testid="monitoring-log-description"
              className={`p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 text-sm font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed ${
                onUpdateLog ? 'cursor-pointer hover:border-zinc-700 transition' : ''
              }`}
            >
              {log.description}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
