import React from 'react'
import { Rocket, Calendar, Zap, ListTodo, ChevronRight, Tag } from 'lucide-react'
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
}

export function ReleaseDetailModal({
  release,
  sprints,
  workItems,
  onClose,
  onSelectWorkItem,
  onSelectSprint
}: ReleaseDetailModalProps) {
  if (!release) return null

  const linkedSprints = sprints.filter(s => s.release_id === release.id)
  const releaseItems = workItems.filter(item => item.release_id === release.id)

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      maxWidth="max-w-2xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Rocket className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-base text-zinc-100">{release.name}</h3>
            <p className="text-xs text-zinc-400">Release Milestone Details</p>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Date Strip */}
        <div className="flex items-center justify-between p-3.5 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="w-4 h-4 text-zinc-500" />
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

          <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30">
            Project: {release.project_key}
          </span>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Scope / Release Notes
          </h4>
          <p className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
            {release.description || 'No description provided for this release milestone.'}
          </p>
        </div>

        {/* Linked Sprints */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Included Sprints ({linkedSprints.length})
            </h4>
          </div>

          {linkedSprints.length === 0 ? (
            <div className="text-xs text-zinc-500 italic">
              No sprints currently targeted for this release.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {linkedSprints.map(s => (
                <div
                  key={s.id}
                  onClick={() => onSelectSprint(s)}
                  className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-amber-500/40 transition cursor-pointer flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-medium text-zinc-200">{s.name}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Included Work Items */}
        <div className="space-y-2.5 border-t border-zinc-800/80 pt-4">
          <div className="flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Assigned Work Items ({releaseItems.length})
            </h4>
          </div>

          {releaseItems.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-xs text-zinc-500">
              No work items directly tagged with this release yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {releaseItems.map(item => (
                <div
                  key={item.key}
                  onClick={() => onSelectWorkItem(item)}
                  className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-indigo-500/40 transition cursor-pointer flex items-center justify-between gap-3 text-xs group"
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
