import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom'
import { RootLayout } from './RootLayout'
import { DashboardRoute } from './DashboardRoute'
import { SettingsRoute } from './SettingsRoute'
import { ProjectDetailRoute } from './ProjectDetailRoute'
import {
  SprintModalRoute,
  ReleaseModalRoute,
  WorkItemModalRoute
} from './ModalRoutes'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <DashboardRoute />
      },
      {
        path: 'dashboard',
        element: <Navigate to="/" replace />
      },
      {
        path: 'settings',
        element: <SettingsRoute />
      },
      {
        path: 'projects/:projectKey',
        element: <ProjectDetailRoute />,
        children: [
          {
            path: 'sprints/:sprintId',
            element: <SprintModalRoute />
          },
          {
            path: 'releases/:releaseId',
            element: <ReleaseModalRoute />
          },
          {
            path: 'items/:itemKey',
            element: <WorkItemModalRoute />
          }
        ]
      },
      {
        path: '*',
        element: <Navigate to="/" replace />
      }
    ]
  }
]

export const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true
  }
})
