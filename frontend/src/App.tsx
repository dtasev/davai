import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Layers,
  RefreshCw,
  Terminal,
  Activity,
  Kanban,
  Clock,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  User as UserIcon,
  Shield,
  Code2,
  AlertTriangle,
  ExternalLink
} from 'lucide-react'

interface BackendInfo {
  python?: string
  django?: string
  ninja?: string
  database?: string
  ingress_port?: number
}

interface WorkItem {
  id: string | number
  key: string
  parent_key?: string | null
  title: string
  descr?: string
  status: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  active_assignee?: string | null
  created_by?: string
}

interface UserProfile {
  id: number
  username: string
  email: string
  is_staff: boolean
}

interface APIKeyItem {
  id: number
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  is_active: boolean
}

interface GeneratedKey {
  id: number
  name: string
  prefix: string
  raw_key: string
  message: string
}

const DEFAULT_DEV_KEY = 'dav_live_7186ea3e7362a9f418e5332be398dc7c6132bdfd'

export default function App() {
  const [activeTab, setActiveTab] = useState<'board' | 'settings'>('board')
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'error'>('checking')
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null)
  const [helloMessage, setHelloMessage] = useState<string>('')
  const [latency, setLatency] = useState<number | null>(null)
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [loadingItems, setLoadingItems] = useState<boolean>(true)

  // API Key & Auth State
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('davai_api_key') || DEFAULT_DEV_KEY
  })
  const [apiKeyInput, setApiKeyInput] = useState<string>(apiKey)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([])
  const [loadingAuth, setLoadingAuth] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // New Key Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [newKeyName, setNewKeyName] = useState<string>('')
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null)
  const [creatingKey, setCreatingKey] = useState<boolean>(false)
  const [copiedKey, setCopiedKey] = useState<boolean>(false)
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

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

  const loadUserData = async (keyToUse: string) => {
    if (!keyToUse.trim()) {
      setUserProfile(null)
      setApiKeys([])
      return
    }

    setLoadingAuth(true)
    setAuthError(null)
    try {
      const [meRes, keysRes] = await Promise.all([
        fetch('/api/auth/me', { headers: { 'X-API-Key': keyToUse } }),
        fetch('/api/auth/keys', { headers: { 'X-API-Key': keyToUse } })
      ])

      if (meRes.ok) {
        const meData = await meRes.json()
        setUserProfile(meData)
        localStorage.setItem('davai_api_key', keyToUse)

        if (keysRes.ok) {
          const keysData = await keysRes.json()
          setApiKeys(keysData)
        }
      } else {
        setUserProfile(null)
        setAuthError('Authentication failed: Invalid API key')
      }
    } catch (err: any) {
      setAuthError(`Connection error: ${err.message}`)
      setUserProfile(null)
    } finally {
      setLoadingAuth(false)
    }
  }

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim()
    setApiKey(trimmed)
    loadUserData(trimmed)
  }

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    setCreatingKey(true)
    try {
      const res = await fetch('/api/auth/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ name: newKeyName.trim() })
      })

      if (res.ok) {
        const data: GeneratedKey = await res.json()
        setGeneratedKey(data)
        setNewKeyName('')
        // Refresh keys list
        const keysRes = await fetch('/api/auth/keys', { headers: { 'X-API-Key': apiKey } })
        if (keysRes.ok) {
          setApiKeys(await keysRes.json())
        }
      }
    } catch {
      // error handling
    } finally {
      setCreatingKey(false)
    }
  }

  const handleRevokeKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to revoke this API key? Applications using it will lose access immediately.')) {
      return
    }

    try {
      const res = await fetch(`/api/auth/keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey }
      })

      if (res.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId))
      }
    } catch {
      // error
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    if (id === 'key') {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      setCopiedSnippet(id)
      setTimeout(() => setCopiedSnippet(null), 2000)
    }
  }

  useEffect(() => {
    checkBackend()
    fetchWorkItems()
    loadUserData(apiKey)
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
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
                    Tracker
                  </span>
                </div>
                <p className="text-xs text-zinc-400 hidden sm:block">AI-Native Jira Alternative</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setActiveTab('board')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  activeTab === 'board'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Work Board</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  activeTab === 'settings'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Settings & API Keys</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* User Pill / Status */}
            {userProfile ? (
              <div
                onClick={() => setActiveTab('settings')}
                className="cursor-pointer flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition text-xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-medium text-zinc-200">{userProfile.username}</span>
                {userProfile.is_staff && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                    Admin
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Connect Key</span>
              </button>
            )}

            <a
              href={`/graphql/?api_key=${encodeURIComponent(apiKey)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition"
              data-testid="graphql-link"
            >
              <Code2 className="w-3.5 h-3.5 text-pink-400" />
              <span>GraphQL IDE</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>

            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition"
              data-testid="swagger-link"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Swagger API</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === 'board' ? (
          <BoardView
            backendStatus={backendStatus}
            backendInfo={backendInfo}
            helloMessage={helloMessage}
            latency={latency}
            workItems={workItems}
            loadingItems={loadingItems}
            fetchWorkItems={fetchWorkItems}
          />
        ) : (
          <SettingsView
            apiKey={apiKey}
            apiKeyInput={apiKeyInput}
            setApiKeyInput={setApiKeyInput}
            handleSaveApiKey={handleSaveApiKey}
            userProfile={userProfile}
            apiKeys={apiKeys}
            loadingAuth={loadingAuth}
            authError={authError}
            handleRevokeKey={handleRevokeKey}
            isModalOpen={isModalOpen}
            setIsModalOpen={setIsModalOpen}
            newKeyName={newKeyName}
            setNewKeyName={setNewKeyName}
            handleCreateKey={handleCreateKey}
            creatingKey={creatingKey}
            generatedKey={generatedKey}
            setGeneratedKey={setGeneratedKey}
            copiedKey={copiedKey}
            copyToClipboard={copyToClipboard}
            copiedSnippet={copiedSnippet}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <div>Davai &copy; 2026 &bull; Concentrated AI-Native Jira Alternative</div>
          <div className="flex items-center gap-4">
            <span>Ingress: 127.0.0.1:6477 (Nginx + Cloudflare Tunnel)</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

interface BoardViewProps {
  backendStatus: 'checking' | 'online' | 'error'
  backendInfo: BackendInfo | null
  helloMessage: string
  latency: number | null
  workItems: WorkItem[]
  loadingItems: boolean
  fetchWorkItems: () => void
}

function BoardView({
  backendStatus,
  backendInfo,
  helloMessage,
  latency,
  workItems,
  loadingItems,
  fetchWorkItems
}: BoardViewProps) {
  return (
    <div className="space-y-8">
      {/* System Runtime Metrics */}
      <section>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
            <div className="text-[11px] text-zinc-400 uppercase font-medium">Security & API Keys</div>
            <div className="text-sm font-semibold text-zinc-100 mt-1">SHA-256 Tokens</div>
            <div className="text-xs text-emerald-400">Zero External Deps</div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
            <div className="text-[11px] text-zinc-400 uppercase font-medium">Database</div>
            <div className="text-sm font-semibold text-zinc-100 mt-1">SQLite 3</div>
            <div className="text-xs text-emerald-400">Persistent Volume</div>
          </div>
        </div>
      </section>

      {/* Live Probe */}
      <section className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-zinc-400">Live API Probe (<code className="text-zinc-200">/api/hello</code>):</span>
          <span className="font-mono text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
            {helloMessage || (backendStatus === 'checking' ? 'Connecting to backend...' : 'Backend offline')}
          </span>
          {latency !== null && (
            <span className="text-[10px] font-mono text-zinc-500">({latency}ms)</span>
          )}
        </div>
        <div className="text-zinc-500 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Ingress on 127.0.0.1:6477</span>
        </div>
      </section>

      {/* Kanban Board */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Kanban className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold tracking-tight text-zinc-100">
              Work Item Board
            </h2>
            <span className="text-xs text-zinc-400">
              Live from Django Ninja <code className="text-zinc-300">/api/work-items/preview</code>
            </span>
          </div>
          <button
            onClick={fetchWorkItems}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition"
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
                {workItems.filter(i => (i.status || '').toLowerCase() === 'todo').length}
              </span>
            </div>
            <div className="space-y-2.5 flex-1">
              {workItems
                .filter(item => (item.status || '').toLowerCase() === 'todo')
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
                {workItems.filter(i => ['in progress', 'in_progress'].includes((i.status || '').toLowerCase())).length}
              </span>
            </div>
            <div className="space-y-2.5 flex-1">
              {workItems
                .filter(item => ['in progress', 'in_progress'].includes((item.status || '').toLowerCase()))
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
                {workItems.filter(i => (i.status || '').toLowerCase() === 'done').length}
              </span>
            </div>
            <div className="space-y-2.5 flex-1">
              {workItems
                .filter(item => (item.status || '').toLowerCase() === 'done')
                .map(item => (
                  <WorkCard key={item.id} item={item} />
                ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

interface SettingsViewProps {
  apiKey: string
  apiKeyInput: string
  setApiKeyInput: (val: string) => void
  handleSaveApiKey: () => void
  userProfile: UserProfile | null
  apiKeys: APIKeyItem[]
  loadingAuth: boolean
  authError: string | null
  handleRevokeKey: (id: number) => void
  isModalOpen: boolean
  setIsModalOpen: (val: boolean) => void
  newKeyName: string
  setNewKeyName: (val: string) => void
  handleCreateKey: (e: React.FormEvent) => void
  creatingKey: boolean
  generatedKey: GeneratedKey | null
  setGeneratedKey: (val: GeneratedKey | null) => void
  copiedKey: boolean
  copyToClipboard: (text: string, id: string) => void
  copiedSnippet: string | null
}

function SettingsView({
  apiKey,
  apiKeyInput,
  setApiKeyInput,
  handleSaveApiKey,
  userProfile,
  apiKeys,
  loadingAuth,
  authError,
  handleRevokeKey,
  isModalOpen,
  setIsModalOpen,
  newKeyName,
  setNewKeyName,
  handleCreateKey,
  creatingKey,
  generatedKey,
  setGeneratedKey,
  copiedKey,
  copyToClipboard,
  copiedSnippet
}: SettingsViewProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
          <Key className="w-6 h-6 text-indigo-400" />
          <span>User Profile & API Keys</span>
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your identity profile and generate secure API keys for LLM coding agents, MCP servers, and scripts.
        </p>
      </div>

      {/* User Profile Summary Card */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-indigo-400" />
          <span>Identity Profile</span>
        </h2>

        {userProfile ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-xl font-bold text-white shadow-md">
                {userProfile.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-zinc-100">{userProfile.username}</span>
                  {userProfile.is_staff && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Administrator
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-400 mt-0.5">{userProfile.email}</div>
                <div className="text-xs text-zinc-500 mt-1">User ID: #{userProfile.id}</div>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Session Authenticated</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Not Connected</div>
              <div className="text-xs text-amber-200/80 mt-1">
                Enter your valid API key below to access user profile details and key management.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Browser API Key Config */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Active Browser API Key</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            This key is stored locally in your browser to authenticate API and GraphQL requests.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            placeholder="dav_live_..."
            className="flex-1 px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm font-mono text-zinc-200"
          />
          <button
            onClick={handleSaveApiKey}
            disabled={loadingAuth}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
          >
            {loadingAuth ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Save & Connect</span>
          </button>
        </div>

        {authError && (
          <div className="text-xs text-rose-400 flex items-center gap-1.5 mt-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{authError}</span>
          </div>
        )}
      </div>

      {/* API Key Management Table */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>Active API Keys</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Tokens authorized to access Davai REST, GraphQL, and MCP endpoints.
            </p>
          </div>

          <button
            onClick={() => {
              setGeneratedKey(null)
              setIsModalOpen(true)
            }}
            disabled={!userProfile}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate New API Key</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Key Label</th>
                <th className="px-4 py-3">Prefix</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Last Used</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    No active API keys found.
                  </td>
                </tr>
              ) : (
                apiKeys.map((k: APIKeyItem) => (
                  <tr key={k.id} className="hover:bg-zinc-900/40 transition">
                    <td className="px-4 py-3 font-medium text-zinc-200">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-indigo-400">{k.prefix}...</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRevokeKey(k.id)}
                        title="Revoke Key"
                        className="p-1.5 rounded hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Developer & Agent Snippets */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-400" />
            <span>LLM Agent & Developer Config</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Ready-to-use configuration blocks pre-populated with your active API key.
          </p>
        </div>

        {/* MCP Stdio Config */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Claude Code / Antigravity MCP Config (<code>claude_desktop_config.json</code>)</span>
            <button
              onClick={() => {
                const snippet = JSON.stringify(
                  {
                    mcpServers: {
                      davai: {
                        command: "python",
                        args: [
                          "-m", "mcp_server",
                          "--api-url", "http://127.0.0.1:6477/api",
                          "--api-key", apiKey
                        ]
                      }
                    }
                  },
                  null,
                  2
                )
                copyToClipboard(snippet, 'mcp')
              }}
              className="flex items-center gap-1 hover:text-white transition"
            >
              {copiedSnippet === 'mcp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSnippet === 'mcp' ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
{`{
  "mcpServers": {
    "davai": {
      "command": "python",
      "args": [
        "-m", "mcp_server",
        "--api-url", "http://127.0.0.1:6477/api",
        "--api-key", "${apiKey}"
      ]
    }
  }
}`}
          </pre>
        </div>

        {/* GraphQL Curl Snippet */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>GraphQL Query via Curl</span>
            <button
              onClick={() => {
                const cmd = `curl -X POST http://127.0.0.1:6477/graphql/ -H "Content-Type: application/json" -H "X-API-Key: ${apiKey}" -d '{"query": "query { workItems { key title status } }"}'`
                copyToClipboard(cmd, 'curl')
              }}
              className="flex items-center gap-1 hover:text-white transition"
            >
              {copiedSnippet === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSnippet === 'curl' ? 'Copied' : 'Copy Curl'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
{`curl -X POST http://127.0.0.1:6477/graphql/ \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{"query": "query { workItems { key title status } }"}'`}
          </pre>
        </div>
      </div>

      {/* Modal: Generate New Key */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <span>Generate New API Key</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Provide a label so you know where this key is being used.
              </p>
            </div>

            {!generatedKey ? (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Key Label
                  </label>
                  <input
                    type="text"
                    required
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="e.g. Claude Code Agent, Laptop CLI"
                    className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingKey || !newKeyName.trim()}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {creatingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Generate Key</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>API Key Generated Successfully!</span>
                  </div>
                  <div className="mt-1 text-emerald-200/80">
                    Store this key safely. You will not be able to view it again after closing this window.
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    Secret API Key
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedKey.raw_key}
                      className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-indigo-300 select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(generatedKey.raw_key, 'key')}
                      className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1 transition"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={() => {
                      setIsModalOpen(false)
                      setGeneratedKey(null)
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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

  const assigneeName = item.active_assignee || 'Unassigned'
  const isDone = (item.status || '').toLowerCase() === 'done'

  return (
    <div className="group p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition cursor-pointer shadow-sm hover:shadow-md">
      <div className="flex items-center justify-between text-[11px] mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-semibold text-indigo-400">{item.key}</span>
          {item.parent_key && (
            <span className="text-[9px] font-mono text-zinc-500">↳ {item.parent_key}</span>
          )}
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${priorityColor}`}>
          {item.priority}
        </span>
      </div>
      <p className="text-xs text-zinc-200 font-medium leading-snug group-hover:text-white transition">
        {item.title}
      </p>
      {item.descr && (
        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
          {item.descr}
        </p>
      )}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/50 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-300">
            {assigneeName.slice(0, 1).toUpperCase()}
          </span>
          <span>{assigneeName}</span>
        </span>
        {isDone && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        )}
      </div>
    </div>
  )
}
