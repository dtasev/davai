import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { createMemoryRouter } from 'react-router-dom'
import App from './App'
import { routes } from './routes/router'

describe('Davai Frontend App with React Router', () => {
  const mockWorkItem = {
    id: 1,
    key: 'DAV-1',
    parent_key: null,
    title: 'Build AI-Native Data Models',
    descr: 'Django ORM schema and models',
    status: 'done',
    priority: 'HIGH',
    project_key: 'DAV',
    active_assignee: 'admin',
    created_by: 'admin',
    updated_by: null,
    assigned: ['admin'],
    watching: [],
    source: '',
    start_date: null,
    target_date: null,
    sprint_id: 1,
    release_id: 1,
    created: '2026-09-20T00:00:00Z',
    updated: '2026-09-20T00:00:00Z',
    context: {
      id: 1,
      work_item_key: 'DAV-1',
      user: 'admin',
      t: 'Specifications for AI data models',
      timestamp: '2026-09-20T00:00:00Z',
    },
    progress: [
      {
        id: 1,
        work_item_key: 'DAV-1',
        user: 'admin',
        t: 'Completed models',
        proof: 'git:e93f18a',
        status: 'COMPLETED',
        timestamp: '2026-09-20T00:00:00Z',
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Mock global fetch for backend API calls
    globalThis.fetch = vi.fn((url: string | URL | Request) => {
      const urlStr = url.toString()

      if (urlStr.includes('/api/hello')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Hello from Django Ninja!' }),
        } as Response)
      }

      if (urlStr.includes('/api/info')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              python: '3.14.5',
              django: '6.1.1',
              ninja: '1.7.1',
              database: 'sqlite3',
            }),
        } as Response)
      }

      if (urlStr.includes('/api/projects/DAV/sprints')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 1,
                project_key: 'DAV',
                release_id: 1,
                name: 'Sprint 1 - Foundation',
                description: 'Bootstrap MVP sprint',
                start_date: '2026-09-20T00:00:00Z',
                end_date: '2026-10-04T00:00:00Z',
                created_at: '2026-09-20T00:00:00Z',
              },
            ]),
        } as Response)
      }

      if (urlStr.includes('/api/projects/DAV/releases')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 1,
                project_key: 'DAV',
                name: 'v0.1.0',
                description: 'Initial MVP release milestone',
                start_date: '2026-09-20T00:00:00Z',
                end_date: '2026-10-15T00:00:00Z',
                created_at: '2026-09-20T00:00:00Z',
              },
            ]),
        } as Response)
      }

      if (urlStr.includes('/api/work-items/DAV-1') || urlStr.includes('/api/work-items?project_key=DAV')) {
        if (urlStr.includes('/api/work-items/DAV-1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockWorkItem),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockWorkItem]),
        } as Response)
      }

      if (urlStr.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 1,
                key: 'DAV',
                name: 'Davai Tracker',
                description: 'Cutting-edge AI-native project engine',
                item_count: 1,
                statuses: [
                  { id: 1, name: 'todo', order: 1, is_default: true },
                  { id: 2, name: 'in progress', order: 2, is_default: false },
                  { id: 3, name: 'done', order: 3, is_default: false },
                ],
              },
            ]),
        } as Response)
      }

      if (urlStr.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 1,
              username: 'admin',
              email: 'admin@dtasev.co.uk',
              is_staff: true,
            }),
        } as Response)
      }

      if (urlStr.includes('/api/auth/keys')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: 1,
                name: 'Default Admin Key',
                prefix: 'dav_live_7186e',
                created_at: '2026-09-20T00:00:00Z',
                last_used_at: null,
                is_active: true,
              },
            ]),
        } as Response)
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    })
  })

  const renderWithRouter = async (initialEntries: string[] = ['/']) => {
    const memoryRouter = createMemoryRouter(routes, {
      initialEntries,
      future: {
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }
    })
    let result: any
    await act(async () => {
      result = render(<App router={memoryRouter} />)
    })
    await waitFor(() => {
      expect(screen.getByText('Davai')).toBeInTheDocument()
    })
    return { ...result, router: memoryRouter }
  }

  it('renders the header brand and external links (GraphQL and Swagger)', async () => {
    await renderWithRouter(['/'])
    expect(screen.getByText('Davai')).toBeInTheDocument()
    expect(screen.getByText('Tracker')).toBeInTheDocument()

    const graphqlLink = screen.getByTestId('graphql-link')
    expect(graphqlLink).toBeInTheDocument()
    expect(graphqlLink).toHaveAttribute('target', '_blank')
    expect(graphqlLink.getAttribute('href')).toMatch(/^\/graphql\/\?api_key=dav_live_/)

    const swaggerLink = screen.getByTestId('swagger-link')
    expect(swaggerLink).toBeInTheDocument()
    expect(swaggerLink).toHaveAttribute('href', '/api/docs')
    expect(swaggerLink).toHaveAttribute('target', '_blank')
  })

  it('renders the Dashboard at "/" with project cards and navigates on click to "/projects/DAV"', async () => {
    const { router } = await renderWithRouter(['/'])
    expect(screen.getByText('Projects Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Davai Tracker')).toBeInTheDocument()

    // Click project card
    const projectCard = screen.getByTestId('project-card-DAV')
    await act(async () => {
      fireEvent.click(projectCard)
    })

    // URL path should update to /projects/DAV
    expect(router.state.location.pathname).toBe('/projects/DAV')

    // Project Detail View is shown
    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    const sprintSection = screen.getByTestId('sprint-list-section')
    const releaseSection = screen.getByTestId('release-list-section')
    const workItemSection = screen.getByTestId('work-item-list-section')

    expect(sprintSection).toBeInTheDocument()
    expect(releaseSection).toBeInTheDocument()
    expect(workItemSection).toBeInTheDocument()
  })

  it('updates path to "/projects/DAV/sprints/1" when opening sprint modal and returns to "/projects/DAV" on close', async () => {
    const { router } = await renderWithRouter(['/projects/DAV'])

    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    // Click Sprint Card
    const sprintCard = screen.getByTestId('sprint-card-1')
    await act(async () => {
      fireEvent.click(sprintCard)
    })

    // Path updated to sprint modal
    expect(router.state.location.pathname).toBe('/projects/DAV/sprints/1')

    await waitFor(() => {
      expect(screen.getByText('Sprint Details & Scope')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Bootstrap MVP sprint').length).toBeGreaterThanOrEqual(1)

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close/i })
    await act(async () => {
      fireEvent.click(closeBtn)
    })

    // Path returned to project detail view
    expect(router.state.location.pathname).toBe('/projects/DAV')
  })

  it('deep-links directly on refresh to "/projects/DAV/items/DAV-1" and restores work item modal state', async () => {
    const { router } = await renderWithRouter(['/projects/DAV/items/DAV-1'])

    expect(router.state.location.pathname).toBe('/projects/DAV/items/DAV-1')

    // Work item modal should open immediately upon direct load
    await waitFor(() => {
      expect(screen.getByText('LLM Agent Context (SKILL.md)')).toBeInTheDocument()
    })
    expect(screen.getByText('Specifications for AI data models')).toBeInTheDocument()
    expect(screen.getByText('git:e93f18a')).toBeInTheDocument()

    // Dismiss modal
    const closeBtn = screen.getByRole('button', { name: /Close/i })
    await act(async () => {
      fireEvent.click(closeBtn)
    })

    // URL path should update back to /projects/DAV
    expect(router.state.location.pathname).toBe('/projects/DAV')
  })

  it('navigates to "/settings" on Settings tab click and back to "/" on Dashboard click', async () => {
    const { router } = await renderWithRouter(['/'])

    // Click Settings tab
    const settingsTab = screen.getByRole('link', { name: /Settings & API Keys/i })
    await act(async () => {
      fireEvent.click(settingsTab)
    })

    expect(router.state.location.pathname).toBe('/settings')

    await waitFor(() => {
      expect(screen.getByTestId('settings-view')).toBeInTheDocument()
    })
    expect(screen.getByText('Identity Profile')).toBeInTheDocument()
    expect(screen.getByText('Active Browser API Key')).toBeInTheDocument()

    // Click Dashboard tab
    const dashboardTab = screen.getByRole('link', { name: /Dashboard/i })
    await act(async () => {
      fireEvent.click(dashboardTab)
    })

    expect(router.state.location.pathname).toBe('/')
    await waitFor(() => {
      expect(screen.getByText('Projects Dashboard')).toBeInTheDocument()
    })
  })
})
