import React from 'react'
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
      maxWidth="max-w-2xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-base text-zinc-100">{sprint.name}</h3>
            <p className="text-xs text-zinc-400">Sprint Details &amp; Scope</p>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Info Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-950/70 border border-zinc-800 rounded-xl text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar className="w-4 h-4 text-zinc-500" />
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
            <div className="flex items-center gap-1 text-xs text-indigo-300 bg-indigo-950/30 px-2.5 py-1 rounded-md border border-indigo-800/30">
              <Target className="w-3 h-3 text-indigo-400" />
              <span>Target Release: {linkedRelease.name}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Objective / Description
          </h4>
          <p className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
            {sprint.description || 'No description provided for this sprint iteration.'}
          </p>
        </div>

        {/* Included Work Items */}
        <div className="space-y-2.5 border-t border-zinc-800/80 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Assigned Work Items ({sprintItems.length})
              </h4>
            </div>
          </div>

          {sprintItems.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-xs text-zinc-500">
              No work items assigned to this sprint yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {sprintItems.map(item => (
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
