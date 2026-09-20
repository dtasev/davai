import { Zap, Calendar, Target, ListTodo, ChevronRight } from 'lucide-react'
import { Sprint, Release, WorkItem } from '../../types'
import { PriorityBadge, StatusBadge } from '../Common/Badge'
import { Modal } from '../Common/Modal'

interface SprintDetailModalProps {
  sprint: Sprint | null
  releases: Release[]
  workItems: WorkItem[]
  onClose: () => void
  onSelectWorkItem: (item: WorkItem) => void
}

export function SprintDetailModal({
  sprint,
  releases,
  workItems,
  onClose,
  onSelectWorkItem
}: SprintDetailModalProps) {
  if (!sprint) return null

  const linkedRelease = releases.find(r => r.id === sprint.release_id)
  const sprintItems = workItems.filter(item => item.sprint_id === sprint.id)

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      maxWidth="max-w-xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-zinc-100">{sprint.name}</h3>
            <p className="text-[11px] text-zinc-400">Sprint Details &amp; Scope</p>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5">
        {/* Info Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-zinc-950/70 border border-zinc-800 rounded-lg text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <span>
              {sprint.start_date
                ? `${new Date(sprint.start_date).toLocaleDateString()} - ${
                    sprint.end_date
                      ? new Date(sprint.end_date).toLocaleDateString()
                      : 'Ongoing'
                  }`
                : 'Unscheduled'}
            </span>
          </div>

          {linkedRelease && (
            <div className="flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-800/30 leading-none">
              <Target className="w-3 h-3 text-indigo-400" />
              <span>Release: {linkedRelease.name}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1">
          <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Objective / Description
          </h4>
          <p className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
            {sprint.description || 'No description provided for this sprint iteration.'}
          </p>
        </div>

        {/* Included Work Items */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
              <h4 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                Assigned Work Items ({sprintItems.length})
              </h4>
            </div>
          </div>

          {sprintItems.length === 0 ? (
            <div className="text-center py-5 border border-dashed border-zinc-800 rounded-lg text-xs text-zinc-500">
              No work items assigned to this sprint yet.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {sprintItems.map(item => (
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
