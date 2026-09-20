import { useState } from 'react'
import { Rocket, Calendar, Zap, ListTodo, ChevronRight, Trash2, AlertTriangle } from 'lucide-react'
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
}

export function ReleaseDetailModal({
  release,
  sprints,
  workItems,
  onClose,
  onSelectWorkItem,
  onSelectSprint,
  onDelete
}: ReleaseDetailModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  if (!release) return null

  const linkedSprints = sprints.filter(s => s.release_id === release.id)
  const releaseItems = workItems.filter(item => item.release_id === release.id)

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      maxWidth="max-w-xl"
      headerActions={
        onDelete ? (
          <button
            onClick={() => setShowDeleteConfirm(prev => !prev)}
            title="Delete Release"
            aria-label="Delete Release"
            data-testid="delete-release-button"
            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : undefined
      }
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Rocket className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-zinc-100">{release.name}</h3>
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
        <div className="flex items-center justify-between p-2.5 bg-zinc-950/70 border border-zinc-800 rounded-lg text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
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

          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30 leading-none">
            Project: {release.project_key}
          </span>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Scope / Release Notes
          </h4>
          <p className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
            {release.description || 'No description provided for this release milestone.'}
          </p>
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
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
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
