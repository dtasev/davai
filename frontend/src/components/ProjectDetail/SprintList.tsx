import { useState, FormEvent } from 'react'
import { Calendar, Plus, ChevronRight, Zap, Target } from 'lucide-react'
import { Sprint, Release } from '../../types'
import { Modal } from '../Common/Modal'

interface SprintListProps {
  sprints: Sprint[]
  releases: Release[]
  onSelectSprint: (sprint: Sprint) => void
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
  onCreateSprint
}: SprintListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [releaseId, setReleaseId] = useState<string>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-100 flex items-center gap-1.5">
              <span>Sprints</span>
              <span className="text-xs font-mono text-zinc-500 font-normal">
                ({sprints.length})
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Active and planned development iterations
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1 transition border border-zinc-700/60"
        >
          <Plus className="w-3 h-3" />
          <span>New Sprint</span>
        </button>
      </div>

      {sprints.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg text-xs text-zinc-500">
          No sprints created yet. Start planning by creating your first sprint.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sprints.map(s => {
            const linkedRelease = releases.find(r => r.id === s.release_id)

            return (
              <div
                key={s.id}
                onClick={() => onSelectSprint(s)}
                className="group p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-amber-500/40 transition cursor-pointer flex flex-col justify-between"
                data-testid={`sprint-card-${s.id}`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-zinc-200 group-hover:text-amber-400 transition">
                      {s.name}
                    </span>
                    {linkedRelease && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-indigo-300 font-medium flex items-center gap-1 leading-none">
                        <Target className="w-2.5 h-2.5" />
                        {linkedRelease.name}
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-1">
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

      {/* Modal: New Sprint */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
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
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-xs text-zinc-200"
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
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-xs text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Target Release (Optional)
            </label>
            <select
              value={releaseId}
              onChange={e => setReleaseId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-xs text-zinc-200"
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
                type="datetime-local"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
