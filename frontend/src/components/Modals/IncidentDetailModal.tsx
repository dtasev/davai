import { useState, useEffect, ChangeEvent } from 'react'
import {
  Flame,
  Clock,
  Check,
  Copy,
  Trash2,
  AlertTriangle,
  ListTree,
  Activity,
  ChevronRight,
  Ban,
  Bot
} from 'lucide-react'
import { Incident, DEFAULT_INCIDENT_STATUSES } from '../../types'
import { StatusBadge, formatStatus } from '../Common/Badge'
import { Modal } from '../Common/Modal'

interface IncidentDetailModalProps {
  incident: Incident | null
  onClose: () => void
  onSelectWorkItem?: (key: string) => void
  onSelectMonitoringLog?: (key: string) => void
  onUpdateIncident?: (data: {
    title?: string
    cause?: string
    investigation_note?: string
    status?: string
    work_item_keys?: string[]
  }) => Promise<void>
  onDelete?: () => Promise<void>
}

export function IncidentDetailModal({
  incident,
  onClose,
  onSelectWorkItem,
  onSelectMonitoringLog,
  onUpdateIncident,
  onDelete
}: IncidentDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(incident?.title || '')
  const [editCause, setEditCause] = useState(incident?.cause || '')
  const [editNote, setEditNote] = useState(incident?.investigation_note || '')
  const [editStatus, setEditStatus] = useState(incident?.status || 'reported')
  const [editWorkItemKeys, setEditWorkItemKeys] = useState(
    (incident?.work_item_keys || []).join(', ')
  )
  const [isSaving, setIsSaving] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [hasCopied, setHasCopied] = useState(false)

  useEffect(() => {
    if (incident) {
      setEditTitle(incident.title)
      setEditCause(incident.cause || '')
      setEditNote(incident.investigation_note || '')
      setEditStatus(incident.status || 'reported')
      setEditWorkItemKeys((incident.work_item_keys || []).join(', '))
      setShowDeleteConfirm(false)
    }
  }, [
    incident?.key,
    incident?.title,
    incident?.cause,
    incident?.investigation_note,
    incident?.status,
    incident?.work_item_keys
  ])

  if (!incident) return null

  const handleSave = async () => {
    if (!onUpdateIncident || !editTitle.trim()) return
    setIsSaving(true)
    try {
      const parsedKeys = editWorkItemKeys
        .split(',')
        .map(k => k.trim().toUpperCase())
        .filter(Boolean)
      await onUpdateIncident({
        title: editTitle.trim(),
        cause: editCause.trim(),
        investigation_note: editNote.trim(),
        status: editStatus,
        work_item_keys: parsedKeys
      })
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditTitle(incident.title)
    setEditCause(incident.cause || '')
    setEditNote(incident.investigation_note || '')
    setEditStatus(incident.status || 'reported')
    setEditWorkItemKeys((incident.work_item_keys || []).join(', '))
    setIsEditing(false)
  }

  const handleStatusChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    if (isEditing) {
      setEditStatus(newStatus)
    } else if (onUpdateIncident) {
      await onUpdateIncident({ status: newStatus })
    }
  }

  const handleCopyDetails = () => {
    const textToCopy = [
      `ID: ${incident.id}\nKey: ${incident.key}\nTitle: ${incident.title}\nStatus: ${incident.status}`,
      `Investigation Cause:\n${incident.cause || ''}`,
      `Investigation Note:\n${incident.investigation_note || ''}`
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
                data-testid="cancel-edit-incident-button"
                className="px-2 py-1 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving || !editTitle.trim()}
                onClick={handleSave}
                data-testid="save-incident-button"
                className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </>
          )}
          {onUpdateIncident && (
            <>
              <button
                type="button"
                disabled={incident.status?.toLowerCase() === 'done'}
                onClick={() => onUpdateIncident({ status: 'done' })}
                title="Mark incident as Done (Human-only)"
                data-testid="mark-incident-done-button"
                className={`p-1.5 rounded-lg transition ${
                  incident.status?.toLowerCase() === 'done'
                    ? 'text-emerald-400 cursor-default'
                    : 'text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 cursor-pointer'
                }`}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={incident.status?.toLowerCase() === 'no longer relevant'}
                onClick={() => onUpdateIncident({ status: 'no longer relevant' })}
                title="Mark incident as No Longer Relevant (Human-only, excludes from all searches)"
                data-testid="mark-incident-irrelevant-button"
                className={`p-1.5 rounded-lg transition ${
                  incident.status?.toLowerCase() === 'no longer relevant'
                    ? 'text-zinc-300 cursor-default'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer'
                }`}
              >
                <Ban className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleCopyDetails}
            title={hasCopied ? 'Copied to clipboard!' : 'Copy incident details'}
            data-testid="copy-incident-button"
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
              title="Delete Incident"
              data-testid="delete-incident-button"
              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      }
      title={
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <Flame className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-rose-400">
                {incident.key}
              </span>
            </div>
            {isEditing ? (
              <input
                type="text"
                data-testid="edit-incident-title-input"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full px-2 py-0.5 rounded bg-zinc-950 border border-indigo-500 text-sm font-bold text-zinc-100 focus:outline-none"
                autoFocus
              />
            ) : (
              <h3
                onClick={() => onUpdateIncident && setIsEditing(true)}
                title={onUpdateIncident ? 'Click to edit incident' : undefined}
                data-testid="incident-title"
                className={`font-bold text-sm sm:text-base text-zinc-100 truncate ${
                  onUpdateIncident ? 'cursor-pointer hover:text-indigo-400 transition' : ''
                }`}
              >
                {incident.title}
              </h3>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4" data-testid="incident-detail-modal">
        {showDeleteConfirm && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-rose-300 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to delete this incident? This cannot be undone.</span>
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
                data-testid="confirm-delete-incident-button"
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
              {onUpdateIncident ? (
                <select
                  value={isEditing ? editStatus : incident.status}
                  onChange={handleStatusChange}
                  data-testid="incident-status-select"
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                >
                  {DEFAULT_INCIDENT_STATUSES.map(st => (
                    <option key={st.id || st.name} value={st.name}>
                      {formatStatus(st.name)}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusBadge status={incident.status} />
              )}
            </div>

            <StatusBadge status={isEditing ? editStatus : incident.status} />
          </div>

          <div className="flex items-center gap-2.5 text-sm text-zinc-400">
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock className="w-3 h-3 text-zinc-500" />
              <span>
                Created {new Date(incident.created_at).toLocaleString()}
                {incident.created_by ? ` by ${incident.created_by}` : ''}
              </span>
            </span>
          </div>
        </div>

        {/* Investigation Cause */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Investigation Cause &amp; Details
            </h4>
            {isEditing && (
              <span className="text-[10px] text-indigo-400 font-mono">Editing</span>
            )}
          </div>
          {isEditing ? (
            <textarea
              data-testid="edit-incident-cause-input"
              value={editCause}
              onChange={e => setEditCause(e.target.value)}
              placeholder="Investigation cause and details..."
              rows={3}
              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-indigo-500 text-sm text-zinc-200 focus:outline-none resize-y leading-relaxed"
            />
          ) : (
            <div
              onClick={() => onUpdateIncident && setIsEditing(true)}
              data-testid="incident-cause"
              className={`p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed ${
                onUpdateIncident ? 'cursor-pointer hover:border-zinc-700 transition' : ''
              }`}
            >
              {incident.cause || 'No investigation cause recorded yet.'}
            </div>
          )}
        </div>

        {/* Quick Investigation Note */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Quick Investigation Note (Recurrence Check)
            </h4>
          </div>
          {isEditing ? (
            <textarea
              data-testid="edit-incident-note-input"
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              placeholder="Specific checks to confirm or deny that this incident is happening again..."
              rows={2}
              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-indigo-500 text-sm text-zinc-200 focus:outline-none resize-y leading-relaxed"
            />
          ) : (
            <div
              onClick={() => onUpdateIncident && setIsEditing(true)}
              data-testid="incident-investigation-note"
              className={`p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed font-mono ${
                onUpdateIncident ? 'cursor-pointer hover:border-zinc-700 transition' : ''
              }`}
            >
              {incident.investigation_note || 'No quick investigation note recorded yet.'}
            </div>
          )}
        </div>

        {/* Linked Work Items (Mitigation) - Styled like Sub-tasks */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ListTree className="w-3.5 h-3.5 text-indigo-400" />
              <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Linked Work Items ({incident.work_items?.length || 0})
              </h4>
            </div>
            {!isEditing && onUpdateIncident && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
              >
                Edit Links
              </button>
            )}
          </div>

          {isEditing && (
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Linked Work Item Keys (comma-separated)
              </label>
              <input
                type="text"
                data-testid="edit-incident-work-items-input"
                placeholder="e.g. DAV-1, DAV-2"
                value={editWorkItemKeys}
                onChange={e => setEditWorkItemKeys(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-indigo-500 text-sm font-mono uppercase text-zinc-200 focus:outline-none"
              />
            </div>
          )}

          {incident.work_items && incident.work_items.length > 0 ? (
            <div className="space-y-1.5" data-testid="incident-work-items-list">
              {incident.work_items.map(wi => (
                <div
                  key={wi.key}
                  data-testid={`incident-work-item-${wi.key}`}
                  onClick={() => onSelectWorkItem?.(wi.key)}
                  className={`p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-2.5 text-sm group ${
                    onSelectWorkItem
                      ? 'hover:border-indigo-500/40 hover:bg-zinc-900/40 cursor-pointer transition'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-bold text-xs sm:text-sm text-indigo-400 shrink-0">
                      {wi.key}
                    </span>
                    <span className="text-zinc-200 group-hover:text-white transition text-xs sm:text-sm truncate">
                      {wi.title}
                    </span>
                  </div>
                  {onSelectWorkItem && (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              className="text-[11px] text-zinc-500 italic p-2.5 bg-zinc-950/40 rounded-lg border border-zinc-900"
              data-testid="no-incident-work-items-message"
            >
              No mitigation work items linked to this incident.
            </div>
          )}
        </div>

        {/* Linked Monitoring Logs - Styled like Sub-tasks */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
              Linked Monitoring Logs ({incident.monitoring_logs?.length || 0})
            </h4>
          </div>

          {incident.monitoring_logs && incident.monitoring_logs.length > 0 ? (
            <div className="space-y-1.5" data-testid="incident-monitoring-logs-list">
              {incident.monitoring_logs.map(log => (
                <div
                  key={log.id || log.key}
                  data-testid={`incident-monitoring-log-${log.key}`}
                  onClick={() => onSelectMonitoringLog?.(log.key)}
                  className={`p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-2.5 text-sm group ${
                    onSelectMonitoringLog
                      ? 'hover:border-amber-500/40 hover:bg-zinc-900/40 cursor-pointer transition'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <span className="font-mono font-bold text-xs sm:text-sm text-amber-400 shrink-0">
                      {log.key}
                    </span>
                    <StatusBadge status={log.status} />
                    {log.agent_id && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-indigo-300 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-800/40 leading-none">
                        <Bot className="w-2.5 h-2.5 text-indigo-400" />
                        <span>{log.agent_id}</span>
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-zinc-400">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  {onSelectMonitoringLog && (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              className="text-[11px] text-zinc-500 italic p-2.5 bg-zinc-950/40 rounded-lg border border-zinc-900"
              data-testid="no-incident-monitoring-logs-message"
            >
              No monitoring logs linked to this incident.
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
