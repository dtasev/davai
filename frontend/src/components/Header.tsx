import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Key,
  Code2,
  Terminal,
  ExternalLink,
  ChevronRight,
  LogIn,
  LogOut,
  Menu
} from 'lucide-react'
import { UserProfile, Project } from '../types'

function GithubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}

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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      const playPromise = videoRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => { })
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
            <div className="relative flex items-center justify-center shrink-0 h-8 aspect-[128/162]">
              <img
                src="/davai-2-small.png"
                alt="Davai"
                className={`w-full h-full object-contain transition-opacity duration-200 group-hover:scale-105 ${isHovered ? 'opacity-0' : 'opacity-100'
                  }`}
              />
              <video
                ref={videoRef}
                src="/davai-14.webm"
                muted
                playsInline
                loop
                preload="auto"
                className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 group-hover:scale-105 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
            <div className="hidden lg:flex items-center gap-1.5 text-sm text-zinc-400 border-l border-zinc-800 pl-3.5 shrink-0">
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition ${isDashboard
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/settings"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition ${isSettings
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
                className="cursor-pointer flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition text-sm"
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-sm transition"
              data-testid="login-button"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          )}

          {/* GitHub Repository */}
          <a
            href="https://github.com/dtasev/davai"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition"
            title="GitHub Repository"
            aria-label="GitHub Repository"
            data-testid="github-link"
          >
            <GithubIcon className="w-4 h-4 text-zinc-200" />
            <span className="hidden sm:inline">GitHub</span>
            <ExternalLink className="w-3 h-3 text-zinc-400" />
          </a>

          {/* Triple horizontal bar menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(prev => !prev)}
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
              title="API Menu"
              data-testid="nav-menu-button"
              className={`p-2 rounded-lg text-sm font-medium border transition flex items-center justify-center ${
                isMenuOpen
                  ? 'bg-zinc-700 border-zinc-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700/60'
              }`}
            >
              <Menu className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                data-testid="nav-menu-dropdown"
                className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden"
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800/80 mb-1">
                  APIs &amp; Docs
                </div>

                {/* GraphQL IDE */}
                <a
                  href="/graphql/"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition"
                  data-testid="graphql-link"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-pink-400" />
                    <span>GraphQL IDE</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                </a>

                {/* Swagger API */}
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition"
                  data-testid="swagger-link"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>Swagger API</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
