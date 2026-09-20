import React, { useState } from 'react'
import { Plus, FolderPlus, Activity, Clock, Layers, RefreshCw } from 'lucide-react'
import { Project, BackendInfo } from '../../types'
import { ProjectCard } from './ProjectCard'
import { Modal } from '../Common/Modal'

interface DashboardViewProps {
  projects: Project[]
  loading: boolean
  onSelectProject: (key: string) => void
  onCreateProject: (key: string, name: string, description: string) => Promise<void>
  backendInfo: BackendInfo | null
  helloMessage: string
  backendStatus: string
  latency: number | null
  onRefresh: () => void
}

export function DashboardView({
  projects,
  loading,
  onSelectProject,
  onCreateProject,
  backendInfo,
  helloMessage,
  backendStatus,
  latency,
  onRefresh
}: DashboardViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim() || !name.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      await onCreateProject(key.trim().toUpperCase(), name.trim(), description.trim())
      setIsModalOpen(false)
      setKey('')
      setName('')
      setDescription('')
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Banner & Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
          <div className="text-[11px] text-zinc-400 uppercase font-medium">Active Projects</div>
          <div className="text-xl font-bold text-zinc-100 mt-1">{projects.length}</div>
          <div className="text-xs text-indigo-400">Tracked Workspaces</div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
          <div className="text-[11px] text-zinc-400 uppercase font-medium">Total Work Items</div>
          <div className="text-xl font-bold text-zinc-100 mt-1">
            {projects.reduce((acc, p) => acc + (p.item_count || 0), 0)}
          </div>
          <div className="text-xs text-indigo-400">Across all projects</div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
          <div className="text-[11px] text-zinc-400 uppercase font-medium">Runtime Stack</div>
          <div className="text-sm font-semibold text-zinc-100 mt-1">Django 6.1 + React 19</div>
          <div className="text-xs text-emerald-400">ORM &amp; Strawberry GraphQL</div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
          <div className="text-[11px] text-zinc-400 uppercase font-medium">Gateway Ingress</div>
          <div className="text-sm font-semibold text-zinc-100 mt-1">127.0.0.1:6477</div>
          <div className="text-xs text-emerald-400">Cloudflared Connected</div>
        </div>
      </section>

      {/* Live Probe */}
      <section className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-zinc-400">Live Backend Status:</span>
          <span className="font-mono text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
            {helloMessage || (backendStatus === 'checking' ? 'Checking...' : 'Online')}
          </span>
          {latency !== null && (
            <span className="text-[10px] font-mono text-zinc-500">({latency}ms)</span>
          )}
        </div>
        <div className="text-zinc-500 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>Python {backendInfo?.python || '3.14.5'} &bull; SQLite Persistence</span>
        </div>
      </section>

      {/* Projects Grid Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Projects Dashboard</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select a project to inspect its sprints, releases, and work items.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition"
              title="Refresh Projects"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm"
              data-testid="create-project-button"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {projects.length === 0 && !loading ? (
          <div className="text-center py-16 px-4 bg-zinc-900/30 border border-zinc-800/60 rounded-2xl">
            <FolderPlus className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-300">No Projects Found</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
              Get started by creating your first project workspace to track sprints, releases, and work items.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map(p => (
              <ProjectCard
                key={p.key}
                project={p}
                onClick={onSelectProject}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal: New Project */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        closeOnOverlayClick={false}
        title={
          <div className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-indigo-400" />
            <span>Create New Project</span>
          </div>
        }
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Project Key (Prefix)
            </label>
            <input
              type="text"
              required
              maxLength={10}
              placeholder="e.g. DAV, CORE, API"
              value={key}
              onChange={e => setKey(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm font-mono uppercase text-zinc-200"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Used as prefix for work item keys (e.g. {key.toUpperCase() || 'KEY'}-1).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Core Engineering Platform"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Optional overview of the project's purpose..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-sm text-zinc-200"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
              {error}
            </div>
          )}

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
              disabled={submitting || !key.trim() || !name.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Create Project</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
