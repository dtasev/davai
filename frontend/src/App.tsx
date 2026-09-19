import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Activity,
  Kanban,
  Clock,
  ArrowRight,
  Network,
  Bot
} from 'lucide-react'

interface BackendInfo {
  python?: string
  django?: string
  ninja?: string
  database?: string
  ingress_port?: number
}

interface WorkItem {
  id: string
  key: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  assignee: string
}

export default function App() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'error'>('checking')
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null)
  const [helloMessage, setHelloMessage] = useState<string>('')
  const [latency, setLatency] = useState<number | null>(null)
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [loadingItems, setLoadingItems] = useState<boolean>(true)

  const checkBackend = async () => {
    setBackendStatus('checking')
    const start = performance.now()
    try {
      const [helloRes, infoRes] = await Promise.all([
        fetch('/api/hello'),
        fetch('/api/info')
      ])

      if (helloRes.ok && infoRes.ok) {
        const helloData = await helloRes.json()
        const infoData = await infoRes.json()
        setLatency(Math.round(performance.now() - start))
        setHelloMessage(helloData.message)
        setBackendInfo(infoData)
        setBackendStatus('online')
      } else {
        setBackendStatus('error')
      }
    } catch {
      setBackendStatus('error')
    }
  }

  const fetchWorkItems = async () => {
    setLoadingItems(true)
    try {
      const res = await fetch('/api/work-items/preview')
      if (res.ok) {
        const data = await res.json()
        setWorkItems(data)
      }
    } catch {
      // fallback
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => {
    checkBackend()
    fetchWorkItems()
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                  Davai
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Hello World
                </span>
              </div>
              <p className="text-xs text-zinc-400">Lean Jira-like Work Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>127.0.0.1:6477 (Cloudflared Ingress)</span>
            </div>

            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>OpenAPI Docs</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>

            <a
              href="/graphql"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-950/40 hover:bg-pink-900/40 text-pink-300 border border-pink-700/50 transition"
            >
              <Network className="w-3.5 h-3.5 text-pink-400" />
              <span>GraphiQL IDE</span>
              <ExternalLink className="w-3 h-3 text-pink-400" />
            </a>

            <a
              href="/mcp/sse"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 transition"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span>MCP Server</span>
              <ExternalLink className="w-3 h-3 text-emerald-400" />
            </a>

            <a
              href="/authelia"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Authelia Portal</span>
              <ExternalLink className="w-3 h-3 text-indigo-200" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner / Status Card */}
        <section className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-6 sm:p-8 shadow-xl">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-800/80 text-zinc-300 text-xs font-medium border border-zinc-700/50">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Modern Containerized Stack Active</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Stack Initialized Successfully
              </h1>
              <p className="text-zinc-400 text-sm max-w-2xl">
                All 4 internal services are wired through the Nginx ingress on port <code className="text-indigo-300 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-800/40">6477</code>. Backend is responding via Django Ninja ASGI.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl">
              <div className="text-right">
                <div className="text-xs text-zinc-400 uppercase font-semibold">Backend Link</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      backendStatus === 'online'
                        ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                        : backendStatus === 'checking'
                        ? 'bg-amber-400 animate-ping'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span className="text-sm font-semibold capitalize text-zinc-200">
                    {backendStatus === 'online' ? 'Online' : backendStatus}
                  </span>
                  {latency !== null && (
                    <span className="text-xs text-zinc-500">({latency}ms)</span>
                  )}
                </div>
              </div>

              <button
                onClick={checkBackend}
                disabled={backendStatus === 'checking'}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/70 text-zinc-300 hover:text-white transition disabled:opacity-50"
                title="Refresh Health"
              >
                <RefreshCw className={`w-4 h-4 ${backendStatus === 'checking' ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* System Spec Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 mt-6 pt-6 border-t border-zinc-800/80">
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              <div className="text-[11px] text-zinc-400 uppercase font-medium">REST API</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">Django Ninja</div>
              <div className="text-xs text-indigo-400">v{backendInfo?.ninja || '1.7.1'}</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              <div className="text-[11px] text-zinc-400 uppercase font-medium">GraphQL API</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">Strawberry</div>
              <div className="text-xs text-pink-400">v0.327.7</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              <div className="text-[11px] text-zinc-400 uppercase font-medium">LLM Interface</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">MCP Server</div>
              <div className="text-xs text-emerald-400">SSE + Stdio Ready</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              <div className="text-[11px] text-zinc-400 uppercase font-medium">Django Core</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">Django</div>
              <div className="text-xs text-indigo-400">v{backendInfo?.django || '6.1.1'}</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              <div className="text-[11px] text-zinc-400 uppercase font-medium">Python Runtime</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">Python</div>
              <div className="text-xs text-indigo-400">v{backendInfo?.python || '3.14.5'}</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              <div className="text-[11px] text-zinc-400 uppercase font-medium">Frontend UI</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">React 19.3</div>
              <div className="text-xs text-indigo-400">Vite 8.3 & Tailwind 4</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              <div className="text-[11px] text-zinc-400 uppercase font-medium">Identity / Passkey</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">Authelia</div>
              <div className="text-xs text-emerald-400">WebAuthn Ready</div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              <div className="text-[11px] text-zinc-400 uppercase font-medium">Database</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">SQLite 3</div>
              <div className="text-xs text-emerald-400">Volume Persisted</div>
            </div>
          </div>
        </section>

        {/* Hello World Live API response box */}
        <section className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-zinc-400">Live API Probe response (<code className="text-zinc-200">/api/hello</code>):</span>
            <span className="font-mono text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
              {helloMessage || 'Connecting to backend...'}
            </span>
          </div>
          <div className="text-zinc-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Ready for Cloudflare tunnel on 127.0.0.1:6477</span>
          </div>
        </section>

        {/* Concentrated Jira-like Kanban Preview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Kanban className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold tracking-tight text-zinc-100">
                Work Item Board (Preview)
              </h2>
              <span className="text-xs text-zinc-400">
                Fed dynamically from Django Ninja <code className="text-zinc-300">/api/work-items/preview</code>
              </span>
            </div>
            <button
              onClick={fetchWorkItems}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingItems ? 'animate-spin' : ''}`} />
              <span>Refresh Board</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* TODO Column */}
            <div className="bg-zinc-900/40 border border-zinc-800/70 rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-500"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">To Do</span>
                </div>
                <span className="text-xs font-mono text-zinc-500">
                  {workItems.filter(i => i.status === 'TODO').length}
                </span>
              </div>
              <div className="space-y-2.5 flex-1">
                {workItems
                  .filter(item => item.status === 'TODO')
                  .map(item => (
                    <WorkCard key={item.id} item={item} />
                  ))}
              </div>
            </div>

            {/* IN PROGRESS Column */}
            <div className="bg-zinc-900/40 border border-zinc-800/70 rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">In Progress</span>
                </div>
                <span className="text-xs font-mono text-zinc-500">
                  {workItems.filter(i => i.status === 'IN_PROGRESS').length}
                </span>
              </div>
              <div className="space-y-2.5 flex-1">
                {workItems
                  .filter(item => item.status === 'IN_PROGRESS')
                  .map(item => (
                    <WorkCard key={item.id} item={item} />
                  ))}
              </div>
            </div>

            {/* DONE Column */}
            <div className="bg-zinc-900/40 border border-zinc-800/70 rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">Done</span>
                </div>
                <span className="text-xs font-mono text-zinc-500">
                  {workItems.filter(i => i.status === 'DONE').length}
                </span>
              </div>
              <div className="space-y-2.5 flex-1">
                {workItems
                  .filter(item => item.status === 'DONE')
                  .map(item => (
                    <WorkCard key={item.id} item={item} />
                  ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <div>Davai &copy; 2026 &bull; Concentrated Jira Alternative</div>
          <div className="flex items-center gap-4">
            <span>Auth: Authelia (File & Passkey DB) &rarr; Keycloak Migration Ready</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function WorkCard({ item }: { item: WorkItem }) {
  const priorityColor =
    item.priority === 'HIGH'
      ? 'text-rose-400 bg-rose-950/40 border-rose-800/40'
      : item.priority === 'MEDIUM'
      ? 'text-amber-400 bg-amber-950/40 border-amber-800/40'
      : 'text-zinc-400 bg-zinc-800/40 border-zinc-700/40'

  return (
    <div className="group p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition cursor-pointer shadow-sm hover:shadow-md">
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <span className="font-mono font-semibold text-indigo-400">{item.key}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${priorityColor}`}>
          {item.priority}
        </span>
      </div>
      <p className="text-xs text-zinc-200 font-medium leading-snug group-hover:text-white transition">
        {item.title}
      </p>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/50 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-300">
            {item.assignee.slice(0, 1)}
          </span>
          <span>{item.assignee}</span>
        </span>
        {item.status === 'DONE' && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        )}
      </div>
    </div>
  )
}
