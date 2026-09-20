import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import App from './App'

describe('Davai Frontend App', () => {
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

      if (urlStr.includes('/api/work-items?project_key=DAV')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
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
                    t: 'Completed migrations and models',
                    proof: 'git:e93f18a',
                    status: 'COMPLETED',
                    timestamp: '2026-09-20T00:00:00Z',
                  },
                ],
              },
            ]),
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

  const renderApp = async () => {
    let result: any
    await act(async () => {
      result = render(<App />)
    })
    await waitFor(() => {
      expect(screen.getByText('Davai')).toBeInTheDocument()
    })
    return result
  }

  it('renders the header brand and external links (GraphQL and Swagger)', async () => {
    await renderApp()
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

  it('renders the Dashboard with projects', async () => {
    await renderApp()
    expect(screen.getByText('Projects Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Davai Tracker')).toBeInTheDocument()
    expect(screen.getByText('DAV')).toBeInTheDocument()
  })

  it('navigates to Project Details View when clicking a project and displays Sprints, Releases, and Work Items top-to-bottom', async () => {
    await renderApp()

    // Click project card
    const projectCard = screen.getByTestId('project-card-DAV')
    await act(async () => {
      fireEvent.click(projectCard)
    })

    // Project Detail View is shown
    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    // Verify sections exist in top-to-bottom order: Sprints, Releases, Work Items
    const sprintSection = screen.getByTestId('sprint-list-section')
    const releaseSection = screen.getByTestId('release-list-section')
    const workItemSection = screen.getByTestId('work-item-list-section')

    expect(sprintSection).toBeInTheDocument()
    expect(releaseSection).toBeInTheDocument()
    expect(workItemSection).toBeInTheDocument()

    // Sprints list content
    expect(within(sprintSection).getByText('Sprint 1 - Foundation')).toBeInTheDocument()

    // Releases list content
    expect(within(releaseSection).getByText('v0.1.0')).toBeInTheDocument()

    // Work Items list content
    expect(within(workItemSection).getByText('Build AI-Native Data Models')).toBeInTheDocument()
    expect(within(workItemSection).getByText('DAV-1')).toBeInTheDocument()
  })

  it('opens detail modals when clicking sprint, release, or work item', async () => {
    await renderApp()

    // Open project details
    await act(async () => {
      fireEvent.click(screen.getByTestId('project-card-DAV'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    // 1. Click Sprint -> Sprint Detail Modal opens
    const sprintCard = screen.getByTestId('sprint-card-1')
    await act(async () => {
      fireEvent.click(sprintCard)
    })

    await waitFor(() => {
      expect(screen.getByText('Sprint Details & Scope')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Bootstrap MVP sprint').length).toBeGreaterThanOrEqual(1)

    // Close Sprint modal
    const closeBtn = screen.getByRole('button', { name: /Close/i })
    await act(async () => {
      fireEvent.click(closeBtn)
    })

    // 2. Click Release -> Release Detail Modal opens
    const releaseCard = screen.getByTestId('release-card-1')
    await act(async () => {
      fireEvent.click(releaseCard)
    })

    await waitFor(() => {
      expect(screen.getByText('Release Milestone Details')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Initial MVP release milestone').length).toBeGreaterThanOrEqual(1)

    // Close Release modal
    const closeReleaseBtn = screen.getByRole('button', { name: /Close/i })
    await act(async () => {
      fireEvent.click(closeReleaseBtn)
    })

    // 3. Click Work Item -> Work Item Detail Modal opens
    const workItemCard = screen.getByTestId('work-item-DAV-1')
    await act(async () => {
      fireEvent.click(workItemCard)
    })

    await waitFor(() => {
      expect(screen.getByText('LLM Agent Context (SKILL.md)')).toBeInTheDocument()
    })
    expect(screen.getByText('Specifications for AI data models')).toBeInTheDocument()
    expect(screen.getByText('git:e93f18a')).toBeInTheDocument()
  })

  it('switches to Settings & API Keys tab and back to Dashboard', async () => {
    await renderApp()

    // Click Settings tab
    const settingsTab = screen.getByRole('button', { name: /Settings & API Keys/i })
    await act(async () => {
      fireEvent.click(settingsTab)
    })

    await waitFor(() => {
      expect(screen.getByTestId('settings-view')).toBeInTheDocument()
    })
    expect(screen.getByText('Identity Profile')).toBeInTheDocument()
    expect(screen.getByText('Active Browser API Key')).toBeInTheDocument()
    expect(screen.getByText('Active API Keys')).toBeInTheDocument()

    // Switch back to Dashboard
    const dashboardTab = screen.getByRole('button', { name: /Dashboard/i })
    await act(async () => {
      fireEvent.click(dashboardTab)
    })

    await waitFor(() => {
      expect(screen.getByText('Projects Dashboard')).toBeInTheDocument()
    })
  })
})
