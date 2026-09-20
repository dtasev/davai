import { useState, useEffect } from 'react'
import { Rocket, Calendar, Zap, ListTodo, ChevronRight, Trash2, AlertTriangle, Check } from 'lucide-react'
import { Release, Sprint, WorkItem } from '../../types'
import { PriorityBadge, StatusBadge } from '../Common/Badge'
import { Modal } from '../Common/Modal'

interface ReleaseDetailModalProps {
  release: Release | null
  sprints: Sprint[]
  workItems: WorkItem[]
  onClose: () => void
  onSelectWorkItem: (item: WorkItem) => void
  onSelectSprint: (sprint: Sprint) => void
  onDelete?: () => Promise<void>
  onUpdate?: (data: {
    name?: string
    description?: string
    start_date?: string | null
    end_date?: string | null
  }) => Promise<void>
}

export function ReleaseDetailModal({
  release,
  sprints,
  workItems,
  onClose,
  onSelectWorkItem,
  onSelectSprint,
  onDelete,
  onUpdate
}: ReleaseDetailModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(release?.name || '')
  const [editDescription, setEditDescription] = useState(release?.description || '')
  const [editStartDate, setEditStartDate] = useState(
    release?.start_date ? release.start_date.slice(0, 10) : ''
  )
  const [editEndDate, setEditEndDate] = useState(
    release?.end_date ? release.end_date.slice(0, 10) : ''
  )
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (release) {
      setEditName(release.name)
      setEditDescription(release.description || '')
      setEditStartDate(release.start_date ? release.start_date.slice(0, 10) : '')
      setEditEndDate(release.end_date ? release.end_date.slice(0, 10) : '')
    }
  }, [release?.id, release?.name, release?.description, release?.start_date, release?.end_date])

  if (!release) return null

  const handleSave = async () => {
    if (!onUpdate || !editName.trim()) return
    setIsSaving(true)
    try {
      await onUpdate({
        name: editName.trim(),
        description: editDescription.trim(),
        start_date: editStartDate ? editStartDate : null,
        end_date: editEndDate ? editEndDate : null
      })
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (release) {
      setEditName(release.name)
      setEditDescription(release.description || '')
      setEditStartDate(release.start_date ? release.start_date.slice(0, 10) : '')
      setEditEndDate(release.end_date ? release.end_date.slice(0, 10) : '')
    }
    setIsEditing(false)
  }

  const linkedSprints = sprints.filter(s => s.release_id === release.id)
  const releaseItems = workItems.filter(item => item.release_id === release.id)

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      maxWidth="max-w-xl md:max-w-3xl lg:max-w-4xl"
      closeOnOverlayClick={!isEditing}
      headerActions={
        <div className="flex items-center gap-1.5">
          {isEditing && (
            <>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleCancelEdit}
                data-testid="cancel-edit-release-button"
                className="px-2 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving || !editName.trim()}
                onClick={handleSave}
                data-testid="save-release-button"
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </>
          )}
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(prev => !prev)}
              title="Delete Release"
              aria-label="Delete Release"
              data-testid="delete-release-button"
              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      }
      title={
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Rocket className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <input
                type="text"
                data-testid="edit-release-name-input"
                aria-label="Edit Release Name"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-2 py-0.5 rounded bg-zinc-950 border border-indigo-500 text-sm font-bold text-zinc-100 focus:outline-none"
                autoFocus
              />
            ) : (
              <h3
                onClick={() => onUpdate && setIsEditing(true)}
                title={onUpdate ? 'Click to edit release name' : undefined}
                data-testid="release-title"
                className={`font-bold text-sm sm:text-base text-zinc-100 truncate ${
                  onUpdate ? 'cursor-pointer hover:text-indigo-400 transition' : ''
                }`}
              >
                {release.name}
              </h3>
            )}
            <p className="text-[11px] text-zinc-400">Release Milestone Details</p>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5">
        {showDeleteConfirm && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-rose-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure you want to delete this release? This cannot be undone.</span>
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
                data-testid="confirm-delete-release-button"
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
        {/* Date Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-zinc-950/70 border border-zinc-800 rounded-lg text-xs">
          {isEditing ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-400">Start:</span>
                <input
                  type="date"
                  data-testid="edit-release-start-date-input"
                  aria-label="Edit Release Start Date"
                  value={editStartDate}
                  onChange={e => setEditStartDate(e.target.value)}
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-indigo-500 ring-1 ring-indigo-500 text-xs text-zinc-200 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-400">End:</span>
                <input
                  type="date"
                  data-testid="edit-release-end-date-input"
                  aria-label="Edit Release End Date"
                  value={editEndDate}
                  onChange={e => setEditEndDate(e.target.value)}
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-indigo-500 ring-1 ring-indigo-500 text-xs text-zinc-200 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div
              onClick={() => onUpdate && setIsEditing(true)}
              title={onUpdate ? 'Click to edit dates' : undefined}
              data-testid="release-date-display"
              className={`flex items-center gap-2 text-zinc-400 ${
                onUpdate ? 'cursor-pointer hover:text-indigo-400 transition' : ''
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>
                {release.start_date
                  ? `${new Date(release.start_date).toLocaleDateString()} - ${
                      release.end_date
                        ? new Date(release.end_date).toLocaleDateString()
                        : 'Ongoing'
                    }`
                  : 'Unscheduled'}
              </span>
            </div>
          )}

          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30 leading-none">
            Project: {release.project_key}
          </span>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Scope / Release Notes
            </h4>
            {isEditing && (
              <span className="text-[10px] text-indigo-400 font-mono">Editing</span>
            )}
          </div>
          {isEditing ? (
            <textarea
              data-testid="edit-release-description-input"
              aria-label="Edit Release Description"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder="Enter release notes / scope..."
              rows={3}
              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-indigo-500 text-xs text-zinc-200 focus:outline-none resize-y leading-relaxed"
            />
          ) : (
            <p
              onClick={() => onUpdate && setIsEditing(true)}
              title={onUpdate ? 'Click to edit release notes' : undefined}
              data-testid="release-description"
              className={`p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed ${
                onUpdate ? 'cursor-pointer hover:border-zinc-700 transition' : ''
              }`}
            >
              {release.description || 'No description provided for this release milestone.'}
            </p>
          )}
        </div>

        {/* Linked Sprints */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
              Included Sprints ({linkedSprints.length})
            </h4>
          </div>

          {linkedSprints.length === 0 ? (
            <div className="text-[11px] text-zinc-500 italic">
              No sprints currently targeted for this release.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {linkedSprints.map(s => (
                <div
                  key={s.id}
                  onClick={() => onSelectSprint(s)}
                  className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-amber-500/40 transition cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="font-medium text-zinc-200">{s.name}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-zinc-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Included Work Items */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center gap-1.5">
            <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
            <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
              Assigned Work Items ({releaseItems.length})
            </h4>
          </div>

          {releaseItems.length === 0 ? (
            <div className="text-center py-5 border border-dashed border-zinc-800 rounded-lg text-xs text-zinc-500">
              No work items directly tagged with this release yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 md:max-h-72 overflow-y-auto pr-1">
              {releaseItems.map(item => (
                <div
                  key={item.key}
                  onClick={() => onSelectWorkItem(item)}
                  className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 hover:border-indigo-500/40 transition cursor-pointer flex items-center justify-between gap-2.5 text-xs group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono font-bold text-indigo-400">
                      {item.key}
                    </span>
                    <span className="text-zinc-200 group-hover:text-white transition truncate">
                      {item.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <PriorityBadge priority={item.priority} />
                    <StatusBadge status={item.status} />
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
