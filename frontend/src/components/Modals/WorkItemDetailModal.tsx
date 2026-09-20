import { useState, ChangeEvent, FormEvent } from 'react'
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
  Rocket
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
}

export function WorkItemDetailModal({
  item,
  sprints,
  releases,
  statuses,
  onClose,
  onUpdateStatus,
  onUpdateContext,
  onAddProgress
}: WorkItemDetailModalProps) {
  if (!item) return null

  const sprint = sprints.find(s => s.id === item.sprint_id)
  const release = releases.find(r => r.id === item.release_id)

  // Edit context state
  const [isEditingContext, setIsEditingContext] = useState(false)
  const [contextInput, setContextInput] = useState(item.context?.t || '')
  const [savingContext, setSavingContext] = useState(false)

  // Add progress state
  const [progressText, setProgressText] = useState('')
  const [progressProof, setProgressProof] = useState('')
  const [progressStatus, setProgressStatus] = useState(item.status || 'COMPLETED')
  const [submittingProgress, setSubmittingProgress] = useState(false)

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
      maxWidth="max-w-2xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ListTodo className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
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
            <h3 className="font-bold text-sm sm:text-base text-zinc-100 truncate">{item.title}</h3>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
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
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 capitalize focus:outline-none focus:border-indigo-500"
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
              <PriorityBadge priority={item.priority} />
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
          <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Description
          </h4>
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
            {item.descr || 'No description provided for this work item.'}
          </div>
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
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
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
