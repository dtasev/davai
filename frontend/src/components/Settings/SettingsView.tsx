import { useState, FormEvent } from 'react'
import {
  Key,
  User as UserIcon,
  Shield,
  Check,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Code2,
  Copy,
  CheckCircle2
} from 'lucide-react'
import { UserProfile, APIKeyItem } from '../../types'
import { Modal } from '../Common/Modal'

export interface GeneratedKey {
  id: number
  name: string
  prefix: string
  raw_key: string
  message: string
}

interface SettingsViewProps {
  userProfile: UserProfile | null
  apiKeys: APIKeyItem[]
  loadingAuth: boolean
  authError: string | null
  handleRevokeKey: (id: number) => void
  onCreateKey: (name: string) => Promise<GeneratedKey | null>
}

export function SettingsView({
  userProfile,
  apiKeys,
  loadingAuth,
  authError,
  handleRevokeKey,
  onCreateKey
}: SettingsViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null)
  const [creatingKey, setCreatingKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    setCreatingKey(true)
    try {
      const result = await onCreateKey(newKeyName.trim())
      if (result) {
        setGeneratedKey(result)
        setNewKeyName('')
      }
    } finally {
      setCreatingKey(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="settings-view">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
          <Key className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
          <span>User Profile &amp; API Keys</span>
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your identity profile and generate secure API keys for LLM coding agents, MCP servers, and scripts.
        </p>
      </div>

      {/* User Profile Summary Card */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3.5 flex items-center gap-2">
          <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Identity Profile</span>
        </h2>

        {loadingAuth ? (
          <div className="flex items-center gap-3 py-2 text-zinc-400 text-sm animate-pulse">
            <div className="w-11 h-11 rounded-xl bg-zinc-800" />
            <div className="space-y-1.5">
              <div className="w-28 h-4 bg-zinc-800 rounded" />
              <div className="w-40 h-3 bg-zinc-800/60 rounded" />
            </div>
          </div>
        ) : userProfile ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-base font-bold text-white shadow-md">
                {userProfile.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-zinc-100">{userProfile.username}</span>
                  {userProfile.is_staff && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1 leading-none">
                      <Shield className="w-3 h-3" />
                      Administrator
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-400 mt-0.5">{userProfile.email}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">User ID: #{userProfile.id}</div>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-sm text-zinc-400 flex items-center gap-2 self-start sm:self-center">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Session Authenticated</span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 text-sm flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Not Connected</div>
              <div className="text-amber-200/80 mt-0.5">
                Log in via OIDC to view your profile and manage API keys for external services.
              </div>
            </div>
          </div>
        )}
      </div>

      {authError && (
        <div className="text-sm text-rose-400 flex items-center gap-1.5 p-3 rounded-lg bg-rose-950/20 border border-rose-800/40">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{authError}</span>
        </div>
      )}

      {/* API Key Management Table */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span>Active API Keys</span>
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Tokens authorized to access Davai REST, GraphQL, and MCP endpoints.
            </p>
          </div>

          <button
            onClick={() => {
              setGeneratedKey(null)
              setIsModalOpen(true)
            }}
            disabled={!userProfile}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-1.5 transition shadow-sm disabled:opacity-40 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate New Key</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-zinc-800/80 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-3.5 py-2.5">Key Label</th>
                <th className="px-3.5 py-2.5">Prefix</th>
                <th className="px-3.5 py-2.5">Created</th>
                <th className="px-3.5 py-2.5">Last Used</th>
                <th className="px-3.5 py-2.5 text-right">Action</th>
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
                    <td className="px-3.5 py-2 font-medium text-zinc-200">{k.name}</td>
                    <td className="px-3.5 py-2 font-mono text-indigo-400">{k.prefix}...</td>
                    <td className="px-3.5 py-2 text-zinc-400">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3.5 py-2 text-zinc-400">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      <button
                        onClick={() => handleRevokeKey(k.id)}
                        title="Revoke Key"
                        className="p-1 rounded hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>LLM Agent &amp; Developer Config</span>
          </h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Ready-to-use configuration blocks for connecting external LLM agents and scripts.
          </p>
        </div>

        {/* MCP Stdio Config */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>Claude Code / Antigravity MCP Config (<code>claude_desktop_config.json</code>)</span>
            <button
              onClick={() => {
                const snippet = JSON.stringify(
                  {
                    mcpServers: {
                      davai: {
                        command: 'python',
                        args: [
                          '-m', 'mcp_server',
                          '--api-url', 'http://127.0.0.1:6477/api',
                          '--api-key', 'YOUR_API_KEY'
                        ]
                      }
                    }
                  },
                  null,
                  2
                )
                copyToClipboard(snippet, 'mcp')
              }}
              className="flex items-center gap-1 hover:text-white transition text-sm"
            >
              {copiedSnippet === 'mcp' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSnippet === 'mcp' ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
{`{
  "mcpServers": {
    "davai": {
      "command": "python",
      "args": [
        "-m", "mcp_server",
        "--api-url", "http://127.0.0.1:6477/api",
        "--api-key", "YOUR_API_KEY"
      ]
    }
  }
}`}
          </pre>
        </div>

        {/* GraphQL Curl Snippet */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>GraphQL Query via Curl</span>
            <button
              onClick={() => {
                const cmd = `curl -X POST http://127.0.0.1:6477/graphql/ -H "Content-Type: application/json" -H "X-API-Key: YOUR_API_KEY" -d '{"query": "query { workItems { key title status } }"}'`
                copyToClipboard(cmd, 'curl')
              }}
              className="flex items-center gap-1 hover:text-white transition text-sm"
            >
              {copiedSnippet === 'curl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSnippet === 'curl' ? 'Copied' : 'Copy Curl'}</span>
            </button>
          </div>
          <pre className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
{`curl -X POST http://127.0.0.1:6477/graphql/ \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"query": "query { workItems { key title status } }"}'`}
          </pre>
        </div>
      </div>

      {/* Modal: Generate New Key */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setGeneratedKey(null)
        }}
        title={
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-400" />
            <span>Generate New API Key</span>
          </div>
        }
        maxWidth="max-w-md"
      >
        {!generatedKey ? (
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Key Label
              </label>
              <input
                type="text"
                required
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="e.g. Claude Code Agent, Laptop CLI"
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
              />
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
                disabled={creatingKey || !newKeyName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {creatingKey ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                <span>Generate Key</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3.5">
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-sm">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>API Key Generated Successfully!</span>
              </div>
              <div className="mt-1 text-emerald-200/80 text-[11px]">
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
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-sm text-indigo-300 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedKey.raw_key, 'key')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium flex items-center gap-1 transition shrink-0"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-zinc-800/60">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  setGeneratedKey(null)
                }}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
