import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { DashboardView } from '../components/Dashboard/DashboardView'

export function DashboardRoute() {
  const navigate = useNavigate()
  const {
    projects,
    loadingProjects,
    fetchProjects,
    handleCreateProject
  } = useApp()

  const handleSelectProject = (projectKey: string) => {
    navigate(`/projects/${projectKey}`)
  }

  return (
    <DashboardView
      projects={projects}
      loading={loadingProjects}
      onSelectProject={handleSelectProject}
      onCreateProject={handleCreateProject}
      onRefresh={fetchProjects}
    />
  )
}
