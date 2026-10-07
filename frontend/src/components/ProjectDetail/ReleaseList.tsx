import { useState, startTransition, FormEvent } from 'react'
import { Calendar, Plus, ChevronRight, Rocket, Tag, CheckCircle2 } from 'lucide-react'
import { Release } from '../../types'
import { Modal } from '../Common/Modal'
import { StatusBadge } from '../Common/Badge'

interface AllReleasesModalProps {
  isOpen: boolean
  onClose: () => void
  releases: Release[]
  onSelectRelease: (release: Release) => void
}

export function AllReleasesModal({
  isOpen,
  onClose,
  releases,
  onSelectRelease
}: AllReleasesModalProps) {
  const sortedReleases = [...releases].sort((a, b) => {
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
          <Rocket className="w-4 h-4 text-indigo-400" />
          <span>All Releases ({releases.length})</span>
        </div>
      }
      maxWidth="max-w-2xl"
    >
      <div className="space-y-2" data-testid="all-releases-list">
        {sortedReleases.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg text-sm text-zinc-500">
            No releases defined yet.
          </div>
        ) : (
          sortedReleases.map(r => {
            const currentStatus = r.status || 'planned'

            return (
              <div
                key={r.id}
                onClick={() => {
                  startTransition(() => {
                    onClose()
                    onSelectRelease(r)
                  })
                }}
                className="group p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-indigo-500/40 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                data-testid={`all-release-item-${r.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-zinc-200 group-hover:text-indigo-400 transition flex items-center gap-1.5 truncate">
                      <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <StatusBadge status={currentStatus} />
                  </div>
                  {r.description && (
                    <p className="text-xs text-zinc-400 truncate mt-1">
                      {r.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0 text-[11px] text-zinc-500">
                  {r.done_at && (
                    <span
                      className="flex items-center gap-1 text-emerald-400 font-mono"
                      data-testid={`all-release-done-at-${r.id}`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Done {new Date(r.done_at).toLocaleDateString()}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-400" />
                    <span>
                      {r.start_date
                        ? `${new Date(r.start_date).toLocaleDateString()} - ${
                            r.end_date
                              ? new Date(r.end_date).toLocaleDateString()
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

interface ReleaseListProps {
  releases: Release[]
  onSelectRelease: (release: Release) => void
  onOpenAllReleases?: () => void
  onCreateRelease: (
    name: string,
    description: string,
    startDate: string | null,
    endDate: string | null
  ) => Promise<void>
}

export function ReleaseList({
  releases,
  onSelectRelease,
  onOpenAllReleases,
  onCreateRelease
}: ReleaseListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [internalAllOpen, setInternalAllOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeReleases = releases.filter(
    r => (r.status || 'planned').toLowerCase() !== 'done'
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await onCreateRelease(
        name.trim(),
        description.trim(),
        startDate || null,
        endDate || null
      )
      setIsModalOpen(false)
      setName('')
      setDescription('')
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
            onOpenAllReleases ? onOpenAllReleases() : setInternalAllOpen(true)
          }
          className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
          data-testid="open-all-releases-modal"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:border-indigo-500/50 transition shrink-0">
            <Rocket className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-zinc-100 group-hover:text-indigo-400 transition flex items-center gap-1.5">
              <span>Releases</span>
              <span className="text-sm font-mono text-zinc-500 font-normal">
                ({activeReleases.length})
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Milestones and target deployment deliverables
            </p>
          </div>
        </button>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium flex items-center gap-1 transition border border-zinc-700/60 shrink-0"
          data-testid="create-release-button"
        >
          <Plus className="w-3 h-3" />
          <span>New Release</span>
        </button>
      </div>

      {activeReleases.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg text-sm text-zinc-500">
          {releases.length === 0
            ? 'No releases defined yet. Group sprints and work items into version milestones.'
            : 'No active releases. Click Releases above to view completed releases.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeReleases.map(r => (
            <div
              key={r.id}
              onClick={() => onSelectRelease(r)}
              className="group p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-indigo-500/40 transition cursor-pointer flex flex-col justify-between"
              data-testid={`release-card-${r.id}`}
            >
              <div>
                <div className="flex items-center justify-between text-sm mb-1 gap-2">
                  <span className="font-bold text-zinc-200 group-hover:text-indigo-400 transition flex items-center gap-1.5 truncate">
                    <Tag className="w-3 h-3 text-indigo-400 shrink-0" />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={r.status || 'planned'} />
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono leading-none">
                      Milestone
                    </span>
                  </div>
                </div>
                {r.description && (
                  <p className="text-sm text-zinc-400 line-clamp-2 mt-1">
                    {r.description}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-400" />
                  <span>
                    {r.start_date
                      ? `${new Date(r.start_date).toLocaleDateString()} - ${
                          r.end_date
                            ? new Date(r.end_date).toLocaleDateString()
                            : 'Ongoing'
                        }`
                      : 'Unscheduled'}
                  </span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-zinc-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!onOpenAllReleases && (
        <AllReleasesModal
          isOpen={internalAllOpen}
          onClose={() => setInternalAllOpen(false)}
          releases={releases}
          onSelectRelease={onSelectRelease}
        />
      )}

      {/* Modal: New Release */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        closeOnOverlayClick={false}
        title={
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-indigo-400" />
            <span>Create New Release</span>
          </div>
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Release Version / Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. v1.0.0 or MVP Release"
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
              placeholder="Release targets or deliverable scope..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Target Start
              </label>
              <input
                type="date"
                aria-label="Target Start"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                Target Release Date
              </label>
              <input
                type="date"
                aria-label="Target Release Date"
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
              {submitting ? 'Creating...' : 'Create Release'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
