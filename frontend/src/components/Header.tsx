import React from 'react'
import {
  Layers,
  LayoutDashboard,
  Key,
  Code2,
  Terminal,
  ExternalLink,
  ChevronRight,
  AlertTriangle
} from 'lucide-react'
import { UserProfile, Project } from '../../types'

interface HeaderProps {
  activeTab: 'dashboard' | 'settings'
  setActiveTab: (tab: 'dashboard' | 'settings') => void
  selectedProject: Project | null
  onClearProject: () => void
  userProfile: UserProfile | null
  apiKey: string
}

export function Header({
  activeTab,
  setActiveTab,
  selectedProject,
  onClearProject,
  userProfile,
  apiKey
}: HeaderProps) {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Breadcrumbs */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div
            onClick={() => {
              onClearProject()
              setActiveTab('dashboard')
            }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition">
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
            </div>
          </div>

          {/* Breadcrumb if project selected */}
          {selectedProject && (
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400">
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
              <button
                onClick={onClearProject}
                className="hover:text-zinc-200 transition"
              >
                Dashboard
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
              <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <span className="font-mono text-indigo-400">[{selectedProject.key}]</span>
                <span>{selectedProject.name}</span>
              </span>
            </div>
          )}

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => {
                onClearProject()
                setActiveTab('dashboard')
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'dashboard' && !selectedProject
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
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

        {/* Right: Actions, User, and External Links */}
        <div className="flex items-center gap-3">
          {/* User Status Pill */}
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

          {/* GraphQL IDE */}
          <a
            href={`/graphql/?api_key=${encodeURIComponent(apiKey)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition"
            data-testid="graphql-link"
          >
            <Code2 className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">GraphQL IDE</span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </a>

          {/* Swagger API */}
          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition"
            data-testid="swagger-link"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Swagger API</span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </a>
        </div>
      </div>
    </header>
  )
}
