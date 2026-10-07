import { useState, startTransition, FormEvent } from 'react'
import { Calendar, Plus, ChevronRight, Zap, Target, CheckCircle2 } from 'lucide-react'
import { Sprint, Release } from '../../types'
import { Modal } from '../Common/Modal'
import { StatusBadge } from '../Common/Badge'

interface AllSprintsModalProps {
  isOpen: boolean
  onClose: () => void
  sprints: Sprint[]
  releases: Release[]
  onSelectSprint: (sprint: Sprint) => void
}

export function AllSprintsModal({
  isOpen,
  onClose,
  sprints,
  releases,
  onSelectSprint
}: AllSprintsModalProps) {
  const sortedSprints = [...sprints].sort((a, b) => {
    if (!a.done_at && b.done_at) return -1
    if (a.done_at && !b.done_at) return 1
    if (a.done_at && b.done_at) {
      return new Date(b.done_at).getTime() - new Date(a.done_at).getTime()
    }
    return 0
  })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>All Sprints ({sprints.length})</span>
        </div>
      }
      maxWidth="max-w-2xl"
    >
      <div className="space-y-2" data-testid="all-sprints-list">
        {sortedSprints.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg text-sm text-zinc-500">
            No sprints created yet.
          </div>
        ) : (
          sortedSprints.map(s => {
            const linkedRelease = releases.find(r => r.id === s.release_id)
            const currentStatus = s.status || 'planned'

            return (
              <div
                key={s.id}
                onClick={() => {
                  startTransition(() => {
                    onClose()
                    onSelectSprint(s)
                  })
                }}
                className="group p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                data-testid={`all-sprint-item-${s.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-zinc-200 group-hover:text-amber-400 transition truncate">
                      {s.name}
                    </span>
                    <StatusBadge status={currentStatus} />
                    {linkedRelease && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-indigo-300 font-medium flex items-center gap-1 leading-none">
                        <Target className="w-2.5 h-2.5" />
                        {linkedRelease.name}
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-xs text-zinc-400 truncate mt-1">
                      {s.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0 text-[11px] text-zinc-500">
                  {s.done_at && (
                    <span
                      className="flex items-center gap-1 text-emerald-400 font-mono"
                      data-testid={`all-sprint-done-at-${s.id}`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Done {new Date(s.done_at).toLocaleDateString()}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-400" />
                    <span>
                      {s.start_date
                        ? `${new Date(s.start_date).toLocaleDateString()} - ${
                            s.end_date
                              ? new Date(s.end_date).toLocaleDateString()
                              : 'Ongoing'
                          }`
                        : 'Unscheduled'}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-zinc-400 ml-auto sm:ml-0" />
                </div>
              </div>
            )
          })
        )}
      </div>
    </Modal>
  )
}

interface SprintListProps {
  sprints: Sprint[]
  releases: Release[]
  onSelectSprint: (sprint: Sprint) => void
  onOpenAllSprints?: () => void
  onCreateSprint: (
    name: string,
    description: string,
    releaseId: number | null,
    startDate: string | null,
    endDate: string | null
  ) => Promise<void>
}

export function SprintList({
  sprints,
  releases,
  onSelectSprint,
  onOpenAllSprints,
  onCreateSprint
}: SprintListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [internalAllOpen, setInternalAllOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [releaseId, setReleaseId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeSprints = sprints.filter(
    s => (s.status || 'planned').toLowerCase() !== 'done'
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await onCreateSprint(
        name.trim(),
        description.trim(),
        releaseId ? parseInt(releaseId, 10) : null,
        startDate || null,
        endDate || null
      )
      setIsModalOpen(false)
      setName('')
      setDescription('')
      setReleaseId('')
      setStartDate('')
      setEndDate('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() =>
            onOpenAllSprints ? onOpenAllSprints() : setInternalAllOpen(true)
          }
          className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
          data-testid="open-all-sprints-modal"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:border-amber-500/50 transition shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-zinc-100 group-hover:text-amber-400 transition flex items-center gap-1.5">
              <span>Sprints</span>
              <span className="text-sm font-mono text-zinc-500 font-normal">
                ({activeSprints.length})
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Active and planned development iterations
            </p>
          </div>
        </button>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium flex items-center gap-1 transition border border-zinc-700/60 shrink-0"
          data-testid="create-sprint-button"
        >
          <Plus className="w-3 h-3" />
          <span>New Sprint</span>
        </button>
      </div>

      {activeSprints.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg text-sm text-zinc-500">
          {sprints.length === 0
            ? 'No sprints created yet. Start planning by creating your first sprint.'
            : 'No active sprints. Click Sprints above to view completed sprints.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeSprints.map(s => {
            const linkedRelease = releases.find(r => r.id === s.release_id)

            return (
              <div
                key={s.id}
                onClick={() => onSelectSprint(s)}
                className="group p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/40 transition cursor-pointer flex flex-col justify-between"
                data-testid={`sprint-card-${s.id}`}
              >
                <div>
                  <div className="flex items-center justify-between text-sm mb-1 gap-2">
                    <span className="font-bold text-zinc-200 group-hover:text-amber-400 transition truncate">
                      {s.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={s.status || 'planned'} />
                      {linkedRelease && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-indigo-300 font-medium flex items-center gap-1 leading-none">
                          <Target className="w-2.5 h-2.5" />
                          {linkedRelease.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {s.description && (
                    <p className="text-sm text-zinc-400 line-clamp-2 mt-1">
                      {s.description}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-400" />
                    <span>
                      {s.start_date
                        ? `${new Date(s.start_date).toLocaleDateString()} - ${
                            s.end_date
                              ? new Date(s.end_date).toLocaleDateString()
                              : 'Ongoing'
                          }`
                        : 'Unscheduled'}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-zinc-400" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!onOpenAllSprints && (
        <AllSprintsModal
          isOpen={internalAllOpen}
          onClose={() => setInternalAllOpen(false)}
          sprints={sprints}
          releases={releases}
          onSelectSprint={onSelectSprint}
        />
      )}

      {/* Modal: New Sprint */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        closeOnOverlayClick={false}
        title={
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Create New Sprint</span>
          </div>
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Sprint Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sprint 1 - Foundation"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Sprint objective or goals..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Target Release (Optional)
            </label>
            <select
              value={releaseId}
              onChange={e => setReleaseId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            >
              <option value="">No Release Assigned</option>
              {releases.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                aria-label="Start Date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                End Date
              </label>
              <input
                type="date"
                aria-label="End Date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
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
              disabled={submitting || !name.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
