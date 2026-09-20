import React, { useState } from 'react'
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
  apiKey: string
  apiKeyInput: string
  setApiKeyInput: (val: string) => void
  handleSaveApiKey: () => void
  userProfile: UserProfile | null
  apiKeys: APIKeyItem[]
  loadingAuth: boolean
  authError: string | null
  handleRevokeKey: (id: number) => void
  onCreateKey: (name: string) => Promise<GeneratedKey | null>
}

export function SettingsView({
  apiKey,
  apiKeyInput,
  setApiKeyInput,
  handleSaveApiKey,
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

  const handleCreate = async (e: React.FormEvent) => {
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
    <div className="max-w-4xl mx-auto space-y-8" data-testid="settings-view">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
          <Key className="w-6 h-6 text-indigo-400" />
          <span>User Profile &amp; API Keys</span>
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
            <span>Save &amp; Connect</span>
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
            <span>LLM Agent &amp; Developer Config</span>
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
                        command: 'python',
                        args: [
                          '-m', 'mcp_server',
                          '--api-url', 'http://127.0.0.1:6477/api',
                          '--api-key', apiKey
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
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setGeneratedKey(null)
        }}
        title={
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            <span>Generate New API Key</span>
          </div>
        }
        maxWidth="max-w-md"
      >
        {!generatedKey ? (
          <form onSubmit={handleCreate} className="space-y-4">
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
                  type="button"
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
                type="button"
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
      </Modal>
    </div>
  )
}
