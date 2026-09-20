export function PriorityBadge({ priority }: { priority: string }) {
  const p = (priority || 'MEDIUM').toUpperCase()
  const styles =
    p === 'HIGH'
      ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
      : p === 'MEDIUM'
      ? 'text-amber-400 bg-amber-950/40 border-amber-800/40'
      : 'text-zinc-400 bg-zinc-800/40 border-zinc-700/40'

  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider leading-none ${styles}`}
    >
      {p}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || 'todo').toLowerCase().replace('_', ' ')
  let color = 'bg-zinc-800 text-zinc-300 border-zinc-700'
  let dot = 'bg-zinc-500'

  if (s === 'in progress') {
    color = 'bg-amber-950/40 text-amber-300 border-amber-800/40'
    dot = 'bg-amber-400'
  } else if (s === 'done') {
    color = 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
    dot = 'bg-emerald-400'
  } else if (s === 'review') {
    color = 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40'
    dot = 'bg-indigo-400'
  } else if (s === 'waiting') {
    color = 'bg-purple-950/40 text-purple-300 border-purple-800/40'
    dot = 'bg-purple-400'
  } else if (s === 'cancelled') {
    color = 'bg-rose-950/40 text-rose-300 border-rose-800/40'
    dot = 'bg-rose-500'
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize leading-none ${color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
      <span>{s}</span>
    </span>
  )
}
