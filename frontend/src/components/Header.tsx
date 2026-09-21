import { useState, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Key,
  Code2,
  Terminal,
  ExternalLink,
  ChevronRight,
  LogIn,
  LogOut
} from 'lucide-react'
import { UserProfile, Project } from '../types'

interface HeaderProps {
  selectedProject?: Project | null
  userProfile: UserProfile | null
  onLogin?: () => void
  onLogout?: () => void
}

export function Header({
  selectedProject,
  userProfile,
  onLogin,
  onLogout
}: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {})
      }
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  const isSettings = location.pathname.startsWith('/settings')
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard'
  const isProjectView = location.pathname.startsWith('/projects/')

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-2.5 group shrink-0"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="relative flex items-center justify-center shrink-0 h-8 w-8">
              <img
                src="/davai-2-small.png"
                alt="Davai"
                className={`h-8 w-auto object-contain transition-opacity duration-200 group-hover:scale-105 ${
                  isHovered ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <video
                ref={videoRef}
                src="/davai-8.webm"
                muted
                playsInline
                loop
                preload="auto"
                className={`absolute inset-0 h-8 w-auto object-contain transition-opacity duration-200 group-hover:scale-105 ${
                  isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                style={{ mixBlendMode: 'screen' }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                Davai
              </span>
              <span className="text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 leading-none">
                Tracker
              </span>
            </div>
          </Link>

          {/* Breadcrumb if in project route */}
          {selectedProject && isProjectView && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400 border-l border-zinc-800 pl-3.5 shrink-0">
              <Link
                to="/"
                className="hover:text-zinc-200 transition"
              >
                Dashboard
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
              <Link
                to={`/projects/${selectedProject.key}`}
                className="font-semibold text-zinc-200 hover:text-white flex items-center gap-1 transition max-w-[200px] truncate"
              >
                <span className="font-mono text-indigo-400">[{selectedProject.key}]</span>
                <span className="truncate">{selectedProject.name}</span>
              </Link>
            </div>
          )}

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-zinc-800 shrink-0">
            <Link
              to="/"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                isDashboard
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/settings"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                isSettings
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Settings &amp; API Keys</span>
            </Link>
          </nav>
        </div>

        {/* Right: Actions, User, and External Links */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* User Status Pill & Auth Button */}
          {userProfile ? (
            <div className="flex items-center gap-1.5">
              <div
                onClick={() => navigate('/settings')}
                className="cursor-pointer flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition text-xs"
                title="Account Settings"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-medium text-zinc-200">{userProfile.username}</span>
                {userProfile.is_staff && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold leading-none">
                    Admin
                  </span>
                )}
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/60 transition"
                  title="Log out"
                  data-testid="logout-button"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onLogin ? onLogin : () => navigate('/login')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition"
              data-testid="login-button"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          )}

          {/* GraphQL IDE */}
          <a
            href="/graphql/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition"
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
