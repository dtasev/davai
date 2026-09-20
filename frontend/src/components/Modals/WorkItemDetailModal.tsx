import { useState, useEffect, ChangeEvent, FormEvent } from 'react'
import {
  ListTodo,
  User as UserIcon,
  Clock,
  Sparkles,
  GitCommit,
  Send,
  Edit3,
  CornerDownRight,
  Zap,
  Rocket,
  Trash2,
  AlertTriangle,
  Check
} from 'lucide-react'
import { WorkItem, Sprint, Release, ProjectStatus } from '../../types'
import { PriorityBadge, StatusBadge } from '../Common/Badge'
import { Modal } from '../Common/Modal'

interface WorkItemDetailModalProps {
  item: WorkItem | null
  sprints: Sprint[]
  releases: Release[]
  statuses: ProjectStatus[]
  onClose: () => void
  onUpdateStatus?: (key: string, newStatus: string) => Promise<void>
  onUpdateContext?: (key: string, contextText: string) => Promise<void>
  onAddProgress?: (
    key: string,
    entry: { t: string; proof: string; status: string }
  ) => Promise<void>
  onDelete?: () => Promise<void>
  onUpdateDetails?: (data: {
    title?: string
    descr?: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | string
  }) => Promise<void>
}

export function WorkItemDetailModal({
  item,
  sprints,
  releases,
  statuses,
  onClose,
  onUpdateStatus,
  onUpdateContext,
  onAddProgress,
  onDelete,
  onUpdateDetails
}: WorkItemDetailModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Edit details (title, descr & priority) state
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [editTitle, setEditTitle] = useState(item?.title || '')
  const [editDescr, setEditDescr] = useState(item?.descr || '')
  const [editPriority, setEditPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>(
    (item?.priority as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM'
  )
  const [isSavingDetails, setIsSavingDetails] = useState(false)

  // Edit context state
  const [isEditingContext, setIsEditingContext] = useState(false)
  const [contextInput, setContextInput] = useState(item?.context?.t || '')
  const [savingContext, setSavingContext] = useState(false)

  // Add progress state
  const [progressText, setProgressText] = useState('')
  const [progressProof, setProgressProof] = useState('')
  const [progressStatus, setProgressStatus] = useState(item?.status || 'COMPLETED')
  const [submittingProgress, setSubmittingProgress] = useState(false)

  useEffect(() => {
    if (item) {
      setContextInput(item.context?.t || '')
      setProgressStatus(item.status || 'COMPLETED')
      setEditTitle(item.title)
      setEditDescr(item.descr || '')
      setEditPriority((item.priority as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM')
    }
  }, [item?.key, item?.context?.t, item?.status, item?.title, item?.descr, item?.priority])

  if (!item) return null

  const handleSaveDetails = async () => {
    if (!onUpdateDetails || !editTitle.trim()) return
    setIsSavingDetails(true)
    try {
      await onUpdateDetails({
        title: editTitle.trim(),
        descr: editDescr.trim(),
        priority: editPriority
      })
      setIsEditingDetails(false)
    } finally {
      setIsSavingDetails(false)
    }
  }

  const handleCancelEditDetails = () => {
    if (item) {
      setEditTitle(item.title)
      setEditDescr(item.descr || '')
      setEditPriority((item.priority as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM')
    }
    setIsEditingDetails(false)
  }

  const handlePriorityChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newPriority = e.target.value as 'LOW' | 'MEDIUM' | 'HIGH'
    if (isEditingDetails) {
      setEditPriority(newPriority)
    } else if (onUpdateDetails) {
      await onUpdateDetails({ priority: newPriority })
    }
  }

  if (!item) return null

  const sprint = sprints.find(s => s.id === item.sprint_id)
  const release = releases.find(r => r.id === item.release_id)

  const handleStatusChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    if (onUpdateStatus) {
      await onUpdateStatus(item.key, newStatus)
    }
  }

  const handleSaveContext = async () => {
    if (!onUpdateContext) return
    setSavingContext(true)
    try {
      await onUpdateContext(item.key, contextInput)
      setIsEditingContext(false)
    } finally {
      setSavingContext(false)
    }
  }

  const handleAddProgress = async (e: FormEvent) => {
    e.preventDefault()
    if (!progressText.trim() || !onAddProgress) return

    setSubmittingProgress(true)
    try {
      await onAddProgress(item.key, {
        t: progressText.trim(),
        proof: progressProof.trim(),
        status: progressStatus
      })
      setProgressText('')
      setProgressProof('')
    } finally {
      setSubmittingProgress(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      maxWidth="max-w-2xl md:max-w-4xl lg:max-w-5xl"
      closeOnOverlayClick={!isEditingDetails}
      headerActions={
        <div className="flex items-center gap-1.5">
          {isEditingDetails && (
            <>
              <button
                type="button"
                disabled={isSavingDetails}
                onClick={handleCancelEditDetails}
                data-testid="cancel-edit-work-item-button"
                className="px-2 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingDetails || !editTitle.trim()}
                onClick={handleSaveDetails}
                data-testid="save-work-item-button"
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingDetails ? 'Saving...' : 'Save'}</span>
              </button>
            </>
          )}
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(prev => !prev)}
              title="Delete Work Item"
              aria-label="Delete Work Item"
              data-testid="delete-work-item-button"
              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      }
      title={
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ListTodo className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400">
                {item.key}
              </span>
              {item.parent_key && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 leading-none">
                  <CornerDownRight className="w-2.5 h-2.5" />
                  <span>Subtask of {item.parent_key}</span>
                </span>
              )}
            </div>
            {isEditingDetails ? (
              <input
                type="text"
                data-testid="edit-work-item-title-input"
                aria-label="Edit Work Item Title"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full px-2 py-0.5 rounded bg-zinc-950 border border-indigo-500 text-sm font-bold text-zinc-100 focus:outline-none"
                autoFocus
              />
            ) : (
              <h3
                onClick={() => onUpdateDetails && setIsEditingDetails(true)}
                title={onUpdateDetails ? 'Click to edit title' : undefined}
                data-testid="work-item-title"
                className={`font-bold text-sm sm:text-base text-zinc-100 truncate ${
                  onUpdateDetails ? 'cursor-pointer hover:text-indigo-400 transition' : ''
                }`}
              >
                {item.title}
              </h3>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {showDeleteConfirm && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-rose-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to delete this work item? This cannot be undone.</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                data-testid="confirm-delete-work-item-button"
                onClick={async () => {
                  if (!onDelete) return
                  setIsDeleting(true)
                  try {
                    await onDelete()
                  } catch {
                    setIsDeleting(false)
                  }
                }}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center gap-1"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
        {/* Meta Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Status Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Status:</span>
              {onUpdateStatus && statuses.length > 0 ? (
                <select
                  value={item.status}
                  onChange={handleStatusChange}
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 capitalize focus:outline-none focus:border-indigo-500"
                >
                  {statuses.map(st => (
                    <option key={st.id} value={st.name}>
                      {st.name}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusBadge status={item.status} />
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Priority:</span>
              {onUpdateDetails ? (
                <select
                  value={isEditingDetails ? editPriority : item.priority}
                  onChange={handlePriorityChange}
                  data-testid={isEditingDetails ? 'edit-work-item-priority-select' : 'work-item-priority-select'}
                  aria-label="Work Item Priority"
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider focus:outline-none cursor-pointer transition ${
                    (isEditingDetails ? editPriority : item.priority) === 'HIGH'
                      ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
                      : (isEditingDetails ? editPriority : item.priority) === 'MEDIUM'
                      ? 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                      : 'text-zinc-400 bg-zinc-800/40 border-zinc-800'
                  } ${isEditingDetails ? 'ring-1 ring-indigo-500 border-indigo-500' : ''}`}
                >
                  <option value="LOW" className="bg-zinc-900 text-zinc-300">LOW</option>
                  <option value="MEDIUM" className="bg-zinc-900 text-amber-400">MEDIUM</option>
                  <option value="HIGH" className="bg-zinc-900 text-rose-400">HIGH</option>
                </select>
              ) : (
                <PriorityBadge priority={item.priority} />
              )}
            </div>

            {sprint && (
              <div className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/30 leading-none">
                <Zap className="w-2.5 h-2.5" />
                <span>{sprint.name}</span>
              </div>
            )}

            {release && (
              <div className="flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-800/30 leading-none">
                <Rocket className="w-2.5 h-2.5" />
                <span>{release.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-xs text-zinc-400">
            {item.active_assignee && (
              <span className="flex items-center gap-1 text-[11px]">
                <UserIcon className="w-3 h-3 text-zinc-500" />
                <span>{item.active_assignee}</span>
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock className="w-3 h-3 text-zinc-500" />
              <span>{new Date(item.created).toLocaleDateString()}</span>
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Description
            </h4>
            {isEditingDetails && (
              <span className="text-[10px] text-indigo-400 font-mono">Editing</span>
            )}
          </div>
          {isEditingDetails ? (
            <textarea
              data-testid="edit-work-item-description-input"
              aria-label="Edit Work Item Description"
              value={editDescr}
              onChange={e => setEditDescr(e.target.value)}
              placeholder="Enter work item description..."
              rows={3}
              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-indigo-500 text-xs text-zinc-200 focus:outline-none resize-y leading-relaxed"
            />
          ) : (
            <div
              onClick={() => onUpdateDetails && setIsEditingDetails(true)}
              title={onUpdateDetails ? 'Click to edit description' : undefined}
              data-testid="work-item-description"
              className={`p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed ${
                onUpdateDetails ? 'cursor-pointer hover:border-zinc-700 transition' : ''
              }`}
            >
              {item.descr || 'No description provided for this work item.'}
            </div>
          )}
        </div>

        {/* LLM / Agent Context Section */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                LLM Agent Context (SKILL.md)
              </h4>
            </div>

            {onUpdateContext && (
              <button
                type="button"
                onClick={() => {
                  setContextInput(item.context?.t || '')
                  setIsEditingContext(!isEditingContext)
                }}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium transition"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditingContext ? 'Cancel' : 'Edit Context'}</span>
              </button>
            )}
          </div>

          {isEditingContext ? (
            <div className="space-y-2">
              <textarea
                rows={3}
                value={contextInput}
                onChange={e => setContextInput(e.target.value)}
                placeholder="Agent context, instructions, or technical specifications..."
                className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-purple-500 focus:outline-none font-mono text-xs text-zinc-200"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveContext}
                  disabled={savingContext}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition disabled:opacity-50"
                >
                  {savingContext ? 'Saving...' : 'Save Context'}
                </button>
              </div>
            </div>
          ) : item.context && item.context.t ? (
            <div className="p-3 rounded-lg bg-purple-950/10 border border-purple-900/30 text-xs font-mono text-purple-200 whitespace-pre-wrap leading-relaxed">
              {item.context.t}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 italic p-2.5 bg-zinc-950/40 rounded-lg border border-zinc-900">
              No technical or LLM agent context has been attached to this work item yet.
            </div>
          )}
        </div>

        {/* Progress & Milestones Timeline */}
        <div className="space-y-2.5 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-1.5">
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
            <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
              Progress &amp; Git Proofs ({item.progress?.length || 0})
            </h4>
          </div>

          {/* Progress list */}
          {item.progress && item.progress.length > 0 ? (
            <div className="space-y-2 max-h-44 md:max-h-64 overflow-y-auto pr-1">
              {item.progress.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-1.5"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={p.status} />
                      {p.proof && (
                        <span className="font-mono text-[10px] bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/40 leading-none">
                          {p.proof}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-300 text-xs">{p.t}</p>
                  </div>

                  <div className="text-[10px] text-zinc-500 whitespace-nowrap self-start sm:self-center">
                    {p.user && <span className="mr-1.5">by {p.user}</span>}
                    <span>{new Date(p.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 italic">
              No progress logs recorded yet.
            </div>
          )}

          {/* Add Progress form */}
          {onAddProgress && (
            <form onSubmit={handleAddProgress} className="space-y-2 pt-1 border-t border-zinc-800/50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Progress update summary..."
                  value={progressText}
                  onChange={e => setProgressText(e.target.value)}
                  className="sm:col-span-2 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Git SHA / Proof"
                  value={progressProof}
                  onChange={e => setProgressProof(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <select
                  value={progressStatus}
                  onChange={e => setProgressStatus(e.target.value)}
                  className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-300"
                >
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="BLOCKED">BLOCKED</option>
                  <option value="FAILED">FAILED</option>
                </select>

                <button
                  type="submit"
                  disabled={submittingProgress || !progressText.trim()}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1 transition disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>Log Update</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}
