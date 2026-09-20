import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { DashboardView } from '../components/Dashboard/DashboardView'

export function DashboardRoute() {
  const navigate = useNavigate()
  const {
    projects,
    loadingProjects,
    backendInfo,
    helloMessage,
    backendStatus,
    latency,
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
      backendInfo={backendInfo}
      helloMessage={helloMessage}
      backendStatus={backendStatus}
      latency={latency}
      onRefresh={fetchProjects}
    />
  )
}
