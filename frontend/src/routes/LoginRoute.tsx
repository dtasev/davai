import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Loader2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { startOidcLogin } from '../auth/oidc'

export function LoginRoute() {
  const { userProfile, loadingAuth } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    if (loadingAuth) {
      return
    }
    if (userProfile) {
      navigate('/', { replace: true })
      return
    }

    // Auto-initiate OIDC login if not already logged in
    startOidcLogin()
  }, [userProfile, loadingAuth, navigate])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-zinc-100 mb-2">Redirecting to Login...</h2>
      <p className="text-sm text-zinc-400 max-w-sm mb-6">
        Connecting to ECMWF / Authelia Single Sign-On to authenticate your session.
      </p>
      <button
        onClick={() => startOidcLogin()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition shadow-sm"
      >
        <LogIn className="w-4 h-4" />
        <span>Click here if not redirected automatically</span>
      </button>
    </div>
  )
}
