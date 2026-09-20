import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '../components/Header'
import { useApp } from '../context/AppContext'

export function RootLayout() {
  const { userProfile, apiKey, projects, loginWithOidc, logout } = useApp()
  const location = useLocation()

  // Extract projectKey from pathname if present
  const match = location.pathname.match(/^\/projects\/([^/]+)/)
  const projectKey = match ? match[1] : null
  const selectedProject = projectKey ? projects.find(p => p.key === projectKey) : null

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      <Header
        selectedProject={selectedProject}
        userProfile={userProfile}
        apiKey={apiKey}
        onLogin={loginWithOidc}
        onLogout={logout}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
