import { useState, useEffect, useRef, useMemo, ChangeEvent, FormEvent } from 'react'
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
  Check,
  Copy,
  Calendar,
  ListTree,
  ChevronRight
} from 'lucide-react'
import { WorkItem, Sprint, Release, ProjectStatus, UserSummary, PROGRESS_STATUS_OPTIONS } from '../../types'
import { PriorityBadge, StatusBadge, formatStatus } from '../Common/Badge'
import { Modal } from '../Common/Modal'
import { apiFetch } from '../../utils/apiFetch'

const PROGRESS_LIST_HEIGHT_KEY = 'davai_progress_list_height'
const DEFAULT_PROGRESS_HEIGHT = 320

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  } catch {
    return dateStr
  }
}

interface WorkItemDetailModalProps {
  item: WorkItem | null
  itemKey?: string
  projectKey?: string
  sprints: Sprint[]
  releases: Release[]
  statuses?: ProjectStatus[]
  onClose: () => void
  onSelectWorkItem?: (key: string) => void
  onUpdateStatus?: (key: string, newStatus: string) => Promise<void>
  onUpdateContext?: (key: string, contextText: string) => Promise<void>
  onAddProgress?: (
    key: string,
    entry: { summary: string; proof: string; status: string }
  ) => Promise<void>
  onUpdateProgress?: (
    key: string,
    progressId: number,
    entry: { summary?: string; proof?: string; status?: string }
  ) => Promise<any>
  onDeleteProgress?: (key: string, progressId: number) => Promise<void>
  onDelete?: () => Promise<void>
  onUpdateDetails?: (data: {
    title?: string
    description?: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | string
    sprint_id?: number | null
    release_id?: number | null
    start_date?: string | null
    target_date?: string | null
    active_assignee_username?: string | null
  }) => Promise<void>
}

export function WorkItemDetailModal({
  item,
  itemKey,
  projectKey,
  sprints,
  releases,
  onClose,
  onSelectWorkItem,
  onUpdateContext,
  onAddProgress,
  onUpdateProgress,
  onDeleteProgress,
  onDelete,
  onUpdateDetails
}: WorkItemDetailModalProps) {
  const activeKey = item?.key || (itemKey ? itemKey.toUpperCase() : '')
  const originalTitleRef = useRef<string>(
    typeof document !== 'undefined' && document.title && !document.title.includes(' | Davai')
      ? document.title
      : 'Davai - Work Management'
  )

  useEffect(() => {
    if (activeKey) {
      document.title = `${activeKey} | Davai`
    }
  }, [activeKey])

  useEffect(() => {
    const originalTitle = originalTitleRef.current
    return () => {
      document.title = originalTitle
    }
  }, [])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDoneConfirm, setShowDoneConfirm] = useState(false)
  const [isMarkingDone, setIsMarkingDone] = useState(false)

  // Edit details (title, description, priority, sprint, release, start_date & target_date) state
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [editTitle, setEditTitle] = useState(item?.title || '')
  const [editDescription, setEditDescription] = useState(item?.description || '')
  const [editPriority, setEditPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>(
    (item?.priority as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM'
  )
  const [editSprintId, setEditSprintId] = useState<number | null>(item?.sprint_id || null)
  const [editReleaseId, setEditReleaseId] = useState<number | null>(item?.release_id || null)
  const [editStartDate, setEditStartDate] = useState(
    item?.start_date ? item.start_date.slice(0, 10) : ''
  )
  const [editTargetDate, setEditTargetDate] = useState(
    item?.target_date ? item.target_date.slice(0, 10) : ''
  )
  const [editAssignee, setEditAssignee] = useState<string>(item?.active_assignee || '')
  const [isSavingDetails, setIsSavingDetails] = useState(false)

  // Users lazy loading state
  const [availableUsers, setAvailableUsers] = useState<UserSummary[] | null>(null)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

  const handleLoadUsers = async () => {
    if (availableUsers !== null || isLoadingUsers) return
    setIsLoadingUsers(true)
    try {
      const proj = projectKey || item?.project_key || ''
      const res = await apiFetch(`/api/users?project=${encodeURIComponent(proj)}`)
      if (res.ok) {
        const data: UserSummary[] = await res.json()
        setAvailableUsers(data)
      }
    } catch (err) {
      console.error('Failed to load users', err)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  // Edit context state
  const [isEditingContext, setIsEditingContext] = useState(false)
  const [contextInput, setContextInput] = useState(item?.context?.summary || '')
  const [savingContext, setSavingContext] = useState(false)

  // Add progress state
  const [progressText, setProgressText] = useState('')
  const [progressProof, setProgressProof] = useState('')
  const [progressStatus, setProgressStatus] = useState('in progress')
  const [submittingProgress, setSubmittingProgress] = useState(false)

  // Edit / Delete progress state
  const [editingProgressId, setEditingProgressId] = useState<number | null>(null)
  const [editProgressSummary, setEditProgressSummary] = useState('')
  const [editProgressProof, setEditProgressProof] = useState('')
  const [editProgressStatus, setEditProgressStatus] = useState('in progress')
  const [savingProgressId, setSavingProgressId] = useState<number | null>(null)
  const [deletingProgressId, setDeletingProgressId] = useState<number | null>(null)
  const [isDeletingProgress, setIsDeletingProgress] = useState(false)

  // Progress list height & resizing state with localStorage persistence
  const [progressListHeight, setProgressListHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(PROGRESS_LIST_HEIGHT_KEY)
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= 120 && parsed <= 1200) {
          return parsed
        }
      }
    } catch {}
    return DEFAULT_PROGRESS_HEIGHT
  })
  const progressListRef = useRef<HTMLDivElement>(null)
  const hasProgress = Boolean(item?.progress && item.progress.length > 0)

  useEffect(() => {
    const el = progressListRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    let timeoutId: ReturnType<typeof setTimeout>
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const newHeight = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? el.clientHeight)
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          if (newHeight >= 120 && newHeight <= 1200) {
            try {
              localStorage.setItem(PROGRESS_LIST_HEIGHT_KEY, String(newHeight))
            } catch {}
            setProgressListHeight(newHeight)
          }
        }, 100)
      }
    })

    observer.observe(el)
    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
    }
  }, [hasProgress])

  // Sort progress by newest created first
  const sortedProgress = useMemo(() => {
    if (!item?.progress) return []
    return [...item.progress].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime()
      const timeB = new Date(b.created_at).getTime()
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA // newest first
      }
      return (b.id || 0) - (a.id || 0)
    })
  }, [item?.progress])

  const startEditProgress = (p: { id: number; summary: string; proof?: string; status: string }) => {
    setEditingProgressId(p.id)
    setEditProgressSummary(p.summary)
    setEditProgressProof(p.proof || '')
    setEditProgressStatus(p.status || 'in progress')
  }

  const cancelEditProgress = () => {
    setEditingProgressId(null)
  }

  const handleSaveProgressEdit = async (progressId: number) => {
    if (!onUpdateProgress || !editProgressSummary.trim() || !item) return
    setSavingProgressId(progressId)
    try {
      await onUpdateProgress(item.key, progressId, {
        summary: editProgressSummary.trim(),
        proof: editProgressProof.trim(),
        status: editProgressStatus
      })
      setEditingProgressId(null)
    } finally {
      setSavingProgressId(null)
    }
  }

  const handleConfirmDeleteProgress = async (progressId: number) => {
    if (!onDeleteProgress || !item) return
    setIsDeletingProgress(true)
    try {
      await onDeleteProgress(item.key, progressId)
      setDeletingProgressId(null)
    } finally {
      setIsDeletingProgress(false)
    }
  }

  // Copy details state
  const [hasCopied, setHasCopied] = useState(false)

  const handleCopyDetails = () => {
    if (!item) return
    const title = isEditingDetails ? editTitle : item.title
    const description = isEditingDetails ? editDescription : (item.description || '')
    const context = isEditingContext ? contextInput : (item.context?.summary || '')

    const textToCopy = [
      `ID: ${item.id}\nKey: ${item.key}\nTitle: ${title}`,
      `Description:\n${description}`,
      `Context:\n${context}`
    ].join('\n\n')

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).catch(() => {})
    }
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }

  useEffect(() => {
    if (item) {
      setShowDoneConfirm(false)
      setShowDeleteConfirm(false)
      setContextInput(item.context?.summary || '')
      setProgressStatus('in progress')
      setEditTitle(item.title)
      setEditDescription(item.description || '')
      setEditPriority((item.priority as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM')
      setEditSprintId(item.sprint_id ?? null)
      setEditReleaseId(item.release_id ?? null)
      setEditStartDate(item.start_date ? item.start_date.slice(0, 10) : '')
      setEditTargetDate(item.target_date ? item.target_date.slice(0, 10) : '')
      setEditAssignee(item.active_assignee || '')
    }
  }, [
    item?.key,
    item?.context?.summary,
    item?.status,
    item?.title,
    item?.description,
    item?.priority,
    item?.sprint_id,
    item?.release_id,
    item?.start_date,
    item?.target_date,
    item?.active_assignee
  ])

  if (!item) return null

  const handleSaveDetails = async () => {
    if (!onUpdateDetails || !editTitle.trim()) return
    setIsSavingDetails(true)
    try {
      await onUpdateDetails({
        title: editTitle.trim(),
        description: editDescription.trim(),
        priority: editPriority,
        sprint_id: editSprintId === null ? 0 : editSprintId,
        release_id: editReleaseId === null ? 0 : editReleaseId,
        start_date: editStartDate ? editStartDate : null,
        target_date: editTargetDate ? editTargetDate : null,
        active_assignee_username: editAssignee
      })
      setIsEditingDetails(false)
    } finally {
      setIsSavingDetails(false)
    }
  }

  const handleCancelEditDetails = () => {
    if (item) {
      setEditTitle(item.title)
      setEditDescription(item.description || '')
      setEditPriority((item.priority as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM')
      setEditSprintId(item.sprint_id ?? null)
      setEditReleaseId(item.release_id ?? null)
      setEditStartDate(item.start_date ? item.start_date.slice(0, 10) : '')
      setEditTargetDate(item.target_date ? item.target_date.slice(0, 10) : '')
      setEditAssignee(item.active_assignee || '')
    }
    setIsEditingDetails(false)
  }

  const handleAssigneeChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newAssignee = e.target.value
    if (isEditingDetails) {
      setEditAssignee(newAssignee)
    } else if (onUpdateDetails) {
      await onUpdateDetails({ active_assignee_username: newAssignee })
    }
  }

  const handlePriorityChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newPriority = e.target.value as 'LOW' | 'MEDIUM' | 'HIGH'
    if (isEditingDetails) {
      setEditPriority(newPriority)
    } else if (onUpdateDetails) {
      await onUpdateDetails({ priority: newPriority })
    }
  }

  const handleSprintChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const newSprintId = val === '' ? 0 : Number(val)
    if (isEditingDetails) {
      setEditSprintId(val === '' ? null : Number(val))
    } else if (onUpdateDetails) {
      await onUpdateDetails({ sprint_id: newSprintId })
    }
  }

  const handleReleaseChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    const newReleaseId = val === '' ? 0 : Number(val)
    if (isEditingDetails) {
      setEditReleaseId(val === '' ? null : Number(val))
    } else if (onUpdateDetails) {
      await onUpdateDetails({ release_id: newReleaseId })
    }
  }

  const handleStartDateChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (isEditingDetails) {
      setEditStartDate(val)
    } else if (onUpdateDetails) {
      await onUpdateDetails({ start_date: val ? val : null })
    }
  }

  const handleTargetDateChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (isEditingDetails) {
      setEditTargetDate(val)
    } else if (onUpdateDetails) {
      await onUpdateDetails({ target_date: val ? val : null })
    }
  }

  if (!item) return null

  const sprint = sprints.find(s => s.id === item.sprint_id)
  const release = releases.find(r => r.id === item.release_id)


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
        summary: progressText.trim(),
        proof: progressProof.trim(),
        status: progressStatus
      })
      setProgressText('')
      setProgressProof('')
    } finally {
      setSubmittingProgress(false)
    }
  }

  const handleConfirmMarkDone = async () => {
    if (!onAddProgress || !item) return
    setIsMarkingDone(true)
    try {
      await onAddProgress(item.key, {
        summary: 'Done',
        proof: '',
        status: 'done'
      })
      setShowDoneConfirm(false)
    } catch (err) {
      console.error('Failed to mark work item as done', err)
    } finally {
      setIsMarkingDone(false)
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
                className="px-2 py-1 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingDetails || !editTitle.trim()}
                onClick={handleSaveDetails}
                data-testid="save-work-item-button"
                className="px-2.5 py-1 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingDetails ? 'Saving...' : 'Save'}</span>
              </button>
            </>
          )}
          {onAddProgress && (
            <button
              type="button"
              disabled={isMarkingDone || item.status?.toLowerCase() === 'done'}
              onClick={() => {
                if (item.status?.toLowerCase() !== 'done') {
                  setShowDoneConfirm(prev => !prev)
                }
              }}
              title={item.status?.toLowerCase() === 'done' ? 'Work item is Done' : 'Mark work item as Done'}
              aria-label={item.status?.toLowerCase() === 'done' ? 'Work item is Done' : 'Mark work item as Done'}
              data-testid="mark-done-button"
              className={`p-1.5 rounded-lg transition ${
                item.status?.toLowerCase() === 'done'
                  ? 'text-emerald-400 cursor-default'
                  : 'text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 cursor-pointer'
              }`}
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyDetails}
            title={hasCopied ? 'Copied to clipboard!' : 'Copy work item details'}
            aria-label="Copy work item details"
            data-testid="copy-work-item-button"
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
              <span className="font-mono text-sm font-bold text-indigo-400">
                {item.key}
              </span>
              {item.parent_key && (
                onSelectWorkItem ? (
                  <button
                    type="button"
                    onClick={() => onSelectWorkItem(item.parent_key!)}
                    data-testid="parent-work-item-link"
                    title={`Go to parent work item ${item.parent_key}`}
                    className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-indigo-400 leading-none cursor-pointer transition"
                  >
                    <CornerDownRight className="w-2.5 h-2.5" />
                    <span>Subtask of {item.parent_key}</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 leading-none">
                    <CornerDownRight className="w-2.5 h-2.5" />
                    <span>Subtask of {item.parent_key}</span>
                  </span>
                )
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
      <div className="space-y-4" data-testid="work-item-detail-modal">
        {showDeleteConfirm && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-rose-300 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to delete this work item? This cannot be undone.</span>
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
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center gap-1"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
        {showDoneConfirm && (
          <div
            data-testid="mark-done-confirm"
            className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Are you sure you want to mark this work item as Done?</span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                disabled={isMarkingDone}
                onClick={() => setShowDoneConfirm(false)}
                data-testid="cancel-mark-done-button"
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMarkingDone}
                data-testid="confirm-mark-done-button"
                onClick={handleConfirmMarkDone}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
              >
                {isMarkingDone ? 'Marking Done...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
        {/* Meta Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Status:</span>
              <StatusBadge status={item.status} />
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

            {/* Assignee Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <UserIcon className="w-3 h-3 text-zinc-400" />
                <span>Assignee:</span>
              </span>
              {onUpdateDetails ? (
                <select
                  value={isEditingDetails ? editAssignee : (item.active_assignee || '')}
                  onChange={handleAssigneeChange}
                  onFocus={handleLoadUsers}
                  onClick={handleLoadUsers}
                  onMouseDown={handleLoadUsers}
                  data-testid={isEditingDetails ? 'edit-work-item-assignee-select' : 'work-item-assignee-select'}
                  aria-label="Work Item Assignee"
                  className={`px-2 py-0.5 rounded text-sm border focus:outline-none cursor-pointer transition ${
                    (isEditingDetails ? editAssignee : item.active_assignee)
                      ? 'text-indigo-300 bg-indigo-950/30 border-indigo-800/40'
                      : 'text-zinc-400 bg-zinc-900 border-zinc-800'
                  } ${isEditingDetails ? 'ring-1 ring-indigo-500 border-indigo-500' : ''}`}
                >
                  <option value="" className="bg-zinc-900 text-zinc-400">
                    Unassigned
                  </option>
                  {availableUsers === null ? (
                    (isEditingDetails ? editAssignee : item.active_assignee) ? (
                      <option
                        value={isEditingDetails ? editAssignee : item.active_assignee!}
                        className="bg-zinc-900 text-zinc-200"
                      >
                        {isEditingDetails ? editAssignee : item.active_assignee}
                      </option>
                    ) : null
                  ) : (
                    <>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.username} className="bg-zinc-900 text-zinc-200">
                          {u.username}
                        </option>
                      ))}
                      {(isEditingDetails ? editAssignee : item.active_assignee) &&
                        !availableUsers.some(
                          u => u.username === (isEditingDetails ? editAssignee : item.active_assignee)
                        ) && (
                          <option
                            value={isEditingDetails ? editAssignee : item.active_assignee!}
                            className="bg-zinc-900 text-zinc-200"
                          >
                            {isEditingDetails ? editAssignee : item.active_assignee}
                          </option>
                        )}
                    </>
                  )}
                </select>
              ) : item.active_assignee ? (
                <div className="flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-800/30 leading-none">
                  <UserIcon className="w-2.5 h-2.5" />
                  <span>{item.active_assignee}</span>
                </div>
              ) : (
                <span className="text-sm text-zinc-500 italic">Unassigned</span>
              )}
            </div>

            {/* Sprint Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Sprint:</span>
              </span>
              {onUpdateDetails ? (
                <select
                  value={isEditingDetails ? (editSprintId ?? '') : (item.sprint_id ?? '')}
                  onChange={handleSprintChange}
                  data-testid={isEditingDetails ? 'edit-work-item-sprint-select' : 'work-item-sprint-select'}
                  aria-label="Work Item Sprint"
                  className={`px-2 py-0.5 rounded text-sm border focus:outline-none cursor-pointer transition ${
                    (isEditingDetails ? editSprintId : item.sprint_id)
                      ? 'text-amber-300 bg-amber-950/30 border-amber-800/40'
                      : 'text-zinc-400 bg-zinc-900 border-zinc-800'
                  } ${isEditingDetails ? 'ring-1 ring-indigo-500 border-indigo-500' : ''}`}
                >
                  <option value="" className="bg-zinc-900 text-zinc-400">No Sprint</option>
                  {sprints.map(sp => (
                    <option key={sp.id} value={sp.id} className="bg-zinc-900 text-zinc-200">
                      {sp.name}
                    </option>
                  ))}
                </select>
              ) : sprint ? (
                <div className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-800/30 leading-none">
                  <Zap className="w-2.5 h-2.5" />
                  <span>{sprint.name}</span>
                </div>
              ) : (
                <span className="text-sm text-zinc-500 italic">None</span>
              )}
            </div>

            {/* Release Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Rocket className="w-3 h-3 text-indigo-400" />
                <span>Release:</span>
              </span>
              {onUpdateDetails ? (
                <select
                  value={isEditingDetails ? (editReleaseId ?? '') : (item.release_id ?? '')}
                  onChange={handleReleaseChange}
                  data-testid={isEditingDetails ? 'edit-work-item-release-select' : 'work-item-release-select'}
                  aria-label="Work Item Release"
                  className={`px-2 py-0.5 rounded text-sm border focus:outline-none cursor-pointer transition ${
                    (isEditingDetails ? editReleaseId : item.release_id)
                      ? 'text-indigo-300 bg-indigo-950/30 border-indigo-800/40'
                      : 'text-zinc-400 bg-zinc-900 border-zinc-800'
                  } ${isEditingDetails ? 'ring-1 ring-indigo-500 border-indigo-500' : ''}`}
                >
                  <option value="" className="bg-zinc-900 text-zinc-400">No Release</option>
                  {releases.map(rel => (
                    <option key={rel.id} value={rel.id} className="bg-zinc-900 text-zinc-200">
                      {rel.name}
                    </option>
                  ))}
                </select>
              ) : release ? (
                <div className="flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-800/30 leading-none">
                  <Rocket className="w-2.5 h-2.5" />
                  <span>{release.name}</span>
                </div>
              ) : (
                <span className="text-sm text-zinc-500 italic">None</span>
              )}
            </div>

            {/* Start Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-zinc-500" />
                <span>Start:</span>
              </span>
              {onUpdateDetails ? (
                <input
                  type="date"
                  value={isEditingDetails ? editStartDate : (item.start_date ? item.start_date.slice(0, 10) : '')}
                  onChange={handleStartDateChange}
                  data-testid={isEditingDetails ? 'edit-work-item-start-date-input' : 'work-item-start-date-input'}
                  aria-label="Work Item Start Date"
                  className={`px-2 py-0.5 rounded text-sm border focus:outline-none cursor-pointer transition ${
                    (isEditingDetails ? editStartDate : item.start_date)
                      ? 'text-zinc-200 bg-zinc-900 border-zinc-700'
                      : 'text-zinc-500 bg-zinc-900 border-zinc-800'
                  } ${isEditingDetails ? 'ring-1 ring-indigo-500 border-indigo-500' : ''}`}
                />
              ) : item.start_date ? (
                <span className="text-sm text-zinc-300">
                  {new Date(item.start_date).toLocaleDateString()}
                </span>
              ) : (
                <span className="text-sm text-zinc-500 italic">None</span>
              )}
            </div>

            {/* Target Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-zinc-500" />
                <span>Target:</span>
              </span>
              {onUpdateDetails ? (
                <input
                  type="date"
                  value={isEditingDetails ? editTargetDate : (item.target_date ? item.target_date.slice(0, 10) : '')}
                  onChange={handleTargetDateChange}
                  data-testid={isEditingDetails ? 'edit-work-item-target-date-input' : 'work-item-target-date-input'}
                  aria-label="Work Item Target Date"
                  className={`px-2 py-0.5 rounded text-sm border focus:outline-none cursor-pointer transition ${
                    (isEditingDetails ? editTargetDate : item.target_date)
                      ? 'text-zinc-200 bg-zinc-900 border-zinc-700'
                      : 'text-zinc-500 bg-zinc-900 border-zinc-800'
                  } ${isEditingDetails ? 'ring-1 ring-indigo-500 border-indigo-500' : ''}`}
                />
              ) : item.target_date ? (
                <span className="text-sm text-zinc-300">
                  {new Date(item.target_date).toLocaleDateString()}
                </span>
              ) : (
                <span className="text-sm text-zinc-500 italic">None</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-sm text-zinc-400">
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
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder="Enter work item description..."
              rows={3}
              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-indigo-500 text-sm text-zinc-200 focus:outline-none resize-y leading-relaxed"
            />
          ) : (
            <div
              onClick={() => onUpdateDetails && setIsEditingDetails(true)}
              title={onUpdateDetails ? 'Click to edit description' : undefined}
              data-testid="work-item-description"
              className={`p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed ${
                onUpdateDetails ? 'cursor-pointer hover:border-zinc-700 transition' : ''
              }`}
            >
              {item.description || 'No description provided for this work item.'}
            </div>
          )}
        </div>

        {/* Sub-tasks Section */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-1.5">
            <ListTree className="w-3.5 h-3.5 text-indigo-400" />
            <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
              Sub-tasks ({item.subtasks?.length || 0})
            </h4>
          </div>

          {item.subtasks && item.subtasks.length > 0 ? (
            <div className="space-y-1.5" data-testid="work-item-subtasks-list">
              {item.subtasks.map(subtask => (
                <div
                  key={subtask.key}
                  data-testid={`subtask-item-${subtask.key}`}
                  onClick={() => onSelectWorkItem?.(subtask.key)}
                  className={`p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between gap-2.5 text-sm group ${
                    onSelectWorkItem ? 'hover:border-indigo-500/40 hover:bg-zinc-900/40 cursor-pointer transition' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-bold text-xs sm:text-sm text-indigo-400 shrink-0">
                      {subtask.key}
                    </span>
                    <span className="text-zinc-200 group-hover:text-white transition text-xs sm:text-sm truncate">
                      {subtask.title}
                    </span>
                  </div>
                  {onSelectWorkItem && (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 italic p-2.5 bg-zinc-950/40 rounded-lg border border-zinc-900" data-testid="no-subtasks-message">
              No sub-tasks attached to this work item.
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

          {/* Add Progress form */}
          {onAddProgress && (
            <form onSubmit={handleAddProgress} className="space-y-2 pb-1" data-testid="add-progress-form">
              <textarea
                required
                placeholder="Progress update summary..."
                value={progressText}
                onChange={e => setProgressText(e.target.value)}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault()
                    handleAddProgress(e)
                  }
                }}
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-y leading-relaxed"
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <input
                  type="text"
                  placeholder="Git SHA / Proof"
                  value={progressProof}
                  onChange={e => setProgressProof(e.target.value)}
                  className="sm:w-64 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                />

                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <select
                    value={progressStatus}
                    onChange={e => setProgressStatus(e.target.value)}
                    className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-sm text-zinc-300"
                  >
                    {PROGRESS_STATUS_OPTIONS.map(st => (
                      <option key={st} value={st}>
                        {formatStatus(st)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    disabled={submittingProgress || !progressText.trim()}
                    className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>Log Update</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Progress list */}
          {item.progress && item.progress.length > 0 ? (
            <div
              ref={progressListRef}
              style={{ height: `${progressListHeight}px`, resize: 'vertical' }}
              className="space-y-2 overflow-y-auto pr-1 min-h-[160px] max-h-[70vh] border border-zinc-800/40 rounded-lg p-1.5"
            >
              {sortedProgress.map((p, idx) => {
                if (editingProgressId === p.id) {
                  return (
                    <div
                      key={p.id || idx}
                      className="p-3 rounded-lg bg-zinc-950 border border-indigo-500/80 space-y-2.5"
                      data-testid={`edit-progress-form-${p.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
                          Edit Progress Entry
                        </span>
                        <select
                          value={editProgressStatus}
                          onChange={e => setEditProgressStatus(e.target.value)}
                          data-testid={`edit-progress-status-${p.id}`}
                          className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-sm text-zinc-300"
                        >
                          {PROGRESS_STATUS_OPTIONS.map(st => (
                            <option key={st} value={st}>
                              {formatStatus(st)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        required
                        placeholder="Progress summary..."
                        value={editProgressSummary}
                        onChange={e => setEditProgressSummary(e.target.value)}
                        onKeyDown={e => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault()
                            handleSaveProgressEdit(p.id)
                          }
                        }}
                        data-testid={`edit-progress-summary-${p.id}`}
                        rows={2}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-y leading-relaxed"
                      />

                      <input
                        type="text"
                        placeholder="Git SHA / Proof"
                        value={editProgressProof}
                        onChange={e => setEditProgressProof(e.target.value)}
                        data-testid={`edit-progress-proof-${p.id}`}
                        className="w-full px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          disabled={savingProgressId === p.id}
                          onClick={cancelEditProgress}
                          data-testid={`cancel-edit-progress-${p.id}`}
                          className="px-2.5 py-1 rounded text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingProgressId === p.id || !editProgressSummary.trim()}
                          onClick={() => handleSaveProgressEdit(p.id)}
                          data-testid={`save-progress-${p.id}`}
                          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition disabled:opacity-50"
                        >
                          {savingProgressId === p.id ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )
                }

                if (deletingProgressId === p.id) {
                  return (
                    <div
                      key={p.id || idx}
                      className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                      data-testid={`delete-progress-confirm-${p.id}`}
                    >
                      <span className="text-sm text-rose-300 font-medium">
                        Delete this progress entry? This cannot be undone.
                      </span>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          disabled={isDeletingProgress}
                          onClick={() => setDeletingProgressId(null)}
                          data-testid={`cancel-delete-progress-${p.id}`}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isDeletingProgress}
                          onClick={() => handleConfirmDeleteProgress(p.id)}
                          data-testid={`confirm-delete-progress-${p.id}`}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition disabled:opacity-50"
                        >
                          {isDeletingProgress ? 'Deleting...' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={p.id || idx}
                    data-testid={`progress-entry-${p.id}`}
                    className="group p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-sm flex flex-col sm:flex-row sm:items-start justify-between gap-2 hover:border-zinc-700 transition"
                  >
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={p.status} isProgressEntry />
                        {p.proof && (
                          <span
                            data-testid={`progress-proof-${p.id}`}
                            className="font-mono text-[10px] bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/40 leading-none"
                          >
                            {p.proof}
                          </span>
                        )}
                      </div>
                      <p data-testid={`progress-summary-${p.id}`} className="text-zinc-300 text-sm break-words whitespace-pre-wrap leading-relaxed">
                        {p.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 text-[10px] text-zinc-500 shrink-0 self-start sm:self-center">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {p.created_by && <span>by {p.created_by}</span>}
                        <span>{formatDateTime(p.created_at)}</span>
                        {p.updated_by && (
                          <span
                            className="text-zinc-500 italic"
                            title={`Edited ${p.updated_at ? formatDateTime(p.updated_at) : ''}${
                              p.updated_by ? ` by ${p.updated_by}` : ''
                            }`}
                          >
                            (edited)
                          </span>
                        )}
                      </div>

                      {(onUpdateProgress || onDeleteProgress) && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                          {onUpdateProgress && (
                            <button
                              type="button"
                              onClick={() => startEditProgress(p)}
                              title="Edit progress entry"
                              data-testid={`edit-progress-button-${p.id}`}
                              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                          {onDeleteProgress && (
                            <button
                              type="button"
                              onClick={() => setDeletingProgressId(p.id)}
                              title="Delete progress entry"
                              data-testid={`delete-progress-button-${p.id}`}
                              className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 italic">
              No progress logs recorded yet.
            </div>
          )}
        </div>

        {/* LLM / Agent Context Section */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                  LLM Agent Context (SKILL.md)
                </h4>
              </div>
              <span className="text-[10px] text-zinc-500 font-sans hidden sm:inline">
                · Unversioned, latest facts only
              </span>
            </div>

            <div className="flex items-center gap-3">
              {item.context && item.context.timestamp && (
                <span
                  data-testid="context-staleness"
                  className="text-[10px] text-zinc-500 font-mono flex items-center gap-1"
                  title={`Last updated: ${new Date(item.context.timestamp).toLocaleString()}${
                    item.context.updated_by || item.context.user ? ` by ${item.context.updated_by || item.context.user}` : ''
                  }`}
                >
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <span>
                    Updated {new Date(item.context.timestamp).toLocaleDateString()}
                    {(item.context.updated_by || item.context.user) && ` by ${item.context.updated_by || item.context.user}`}
                  </span>
                </span>
              )}
              {onUpdateContext && (
                <button
                  type="button"
                  onClick={() => {
                    setContextInput(item.context?.summary || '')
                    setIsEditingContext(!isEditingContext)
                  }}
                  className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium transition cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isEditingContext ? 'Cancel' : 'Edit Context'}</span>
                </button>
              )}
            </div>
          </div>

          {isEditingContext ? (
            <div className="space-y-2">
              <textarea
                rows={3}
                value={contextInput}
                onChange={e => setContextInput(e.target.value)}
                placeholder="Agent context, instructions, or technical specifications (unversioned, overwrites previous context)..."
                className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-purple-500 focus:outline-none font-mono text-sm text-zinc-200"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">
                  Overwrites existing context. Latest facts only.
                </span>
                <button
                  type="button"
                  onClick={handleSaveContext}
                  disabled={savingContext}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition disabled:opacity-50 cursor-pointer"
                >
                  {savingContext ? 'Saving...' : 'Save Context'}
                </button>
              </div>
            </div>
          ) : item.context && item.context.summary ? (
            <div className="space-y-1.5">
              <div className="p-3 rounded-lg bg-purple-950/10 border border-purple-900/30 text-sm font-mono text-purple-200 whitespace-pre-wrap leading-relaxed">
                {item.context.summary}
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1 font-mono">
                <span>SKILL.md style · State only (no changelog)</span>
                {item.context.timestamp && (
                  <span>
                    Last updated: {new Date(item.context.timestamp).toLocaleDateString()}
                    {(item.context.updated_by || item.context.user) && ` by ${item.context.updated_by || item.context.user}`}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 italic p-2.5 bg-zinc-950/40 rounded-lg border border-zinc-900">
              No technical or LLM agent context has been attached to this work item yet.
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
