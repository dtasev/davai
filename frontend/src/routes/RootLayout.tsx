import { Outlet, useLocation } from 'react-router-dom'
import { LogIn, Loader2, Shield, AlertTriangle } from 'lucide-react'
import { Header } from '../components/Header'
import { useApp } from '../context/AppContext'

export function RootLayout() {
  const { userProfile, loadingAuth, authError, projects, loginWithOidc, logout } = useApp()
  const location = useLocation()

  if (loadingAuth) {
    return (
      <div
        className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4 selection:bg-indigo-500/30 selection:text-indigo-200"
        data-testid="auth-loading"
      >
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm text-zinc-400">Checking authentication session...</p>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div
        className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4 selection:bg-indigo-500/30 selection:text-indigo-200"
        data-testid="oidc-login-screen"
      >
        <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md text-center">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <img
              src="/davai-2-small.png"
              alt="Davai"
              className="h-10 w-auto object-contain"
            />
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
                Davai
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 leading-none">
                Tracker
              </span>
            </div>
          </div>

          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-bold text-zinc-100 mb-2">
            Sign in to Davai
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            Please log in with ECMWF / Authelia Single Sign-On (OIDC) to access projects, work items, and incidents.
          </p>

          {authError && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={loginWithOidc}
            data-testid="login-button"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-md"
          >
            <LogIn className="w-4 h-4" />
            <span>Log in with Single Sign-On</span>
          </button>
        </div>
      </div>
    )
  }

  // Extract projectKey from pathname if present
  const match = location.pathname.match(/^\/projects\/([^/]+)/)
  const projectKey = match ? match[1] : null
  const selectedProject = projectKey ? projects.find(p => p.key === projectKey) : null

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      <Header
        selectedProject={selectedProject}
        userProfile={userProfile}
        onLogin={loginWithOidc}
        onLogout={logout}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
