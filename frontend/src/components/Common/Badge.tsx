export function PriorityBadge({ priority }: { priority: string }) {
  const p = (priority || 'MEDIUM').toUpperCase()
  const styles =
    p === 'HIGH'
      ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
      : p === 'MEDIUM'
      ? 'text-amber-400 bg-amber-950/40 border-amber-800/40'
      : 'text-zinc-400 bg-zinc-800/40 border-zinc-800'

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider leading-none ${styles}`}
    >
      {p}
    </span>
  )
}

export function formatStatus(status: string | null | undefined): string {
  if (!status) return 'Todo'
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ')
}

export function StatusBadge({
  status,
  isProgressEntry: _isProgressEntry = false
}: {
  status: string
  isProgressEntry?: boolean
}) {
  const s = (status || 'todo').toLowerCase().replace(/_/g, ' ')
  let color = 'bg-zinc-800/60 text-zinc-300 border-zinc-800'
  let dot = 'bg-zinc-500'

  if (s === 'planned') {
    color = 'bg-sky-950/40 text-sky-300 border-sky-800/40'
    dot = 'bg-sky-400'
  } else if (s === 'in progress' || s === 'step completed' || s === 'completed') {
    color = 'bg-yellow-950/40 text-yellow-300 border-yellow-800/40'
    dot = 'bg-yellow-400'
  } else if (s === 'blocked') {
    color = 'bg-orange-950/40 text-orange-300 border-orange-800/40'
    dot = 'bg-orange-400'
  } else if (s === 'review' || s === 'awaiting review' || s === 'waiting') {
    color = 'bg-purple-950/40 text-purple-300 border-purple-800/40'
    dot = 'bg-purple-400'
  } else if (s === 'done') {
    color = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
    dot = 'bg-emerald-400'
  } else if (s === 'cancelled') {
    color = 'bg-zinc-900 text-zinc-400 border-zinc-800'
    dot = 'bg-zinc-600'
  }

  const label =
    s === 'step completed' || s === 'completed' || s === 'in progress'
      ? 'In Progress'
      : s === 'awaiting review' || s === 'review'
      ? 'Review'
      : formatStatus(status)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border leading-none ${color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
      <span>{label}</span>
    </span>
  )
}
