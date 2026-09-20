import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { createMemoryRouter } from 'react-router-dom'
import App from './App'
import { routes } from './routes/router'

describe('Davai Frontend App with React Router', () => {
  let mockWorkItem: any

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockWorkItem = {
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
        summary: 'Specifications for AI data models',
        timestamp: '2026-09-20T00:00:00Z',
      },
      progress: [
        {
          id: 1,
          work_item_key: 'DAV-1',
          user: 'admin',
          summary: 'Completed models',
          proof: 'git:e93f18a',
          status: 'COMPLETED',
          timestamp: '2026-09-20T00:00:00Z',
        },
      ],
    }

    // Mock global fetch for backend API calls
    globalThis.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString()
      const method = init?.method?.toUpperCase() || 'GET'

      if (method === 'PATCH') {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        if (urlStr.includes('/api/projects/DAV/sprints/1')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 1,
                project_key: 'DAV',
                release_id: 1,
                name: body.name || 'Sprint 1 - Foundation',
                description:
                  body.description !== undefined
                    ? body.description
                    : 'Bootstrap MVP sprint',
                start_date: body.start_date !== undefined ? body.start_date : '2026-09-20T00:00:00Z',
                end_date: body.end_date !== undefined ? body.end_date : '2026-10-04T00:00:00Z',
                created_at: '2026-09-20T00:00:00Z',
              }),
          } as Response)
        }
        if (urlStr.includes('/api/projects/DAV/releases/1')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 1,
                project_key: 'DAV',
                name: body.name || 'v0.1.0',
                description:
                  body.description !== undefined
                    ? body.description
                    : 'Initial MVP release milestone',
                start_date: body.start_date !== undefined ? body.start_date : '2026-09-20T00:00:00Z',
                end_date: body.end_date !== undefined ? body.end_date : '2026-10-15T00:00:00Z',
                created_at: '2026-09-20T00:00:00Z',
              }),
          } as Response)
        }
        if (urlStr.includes('/api/work-items/DAV-1')) {
          if (body.title) mockWorkItem.title = body.title
          if (body.descr !== undefined) mockWorkItem.descr = body.descr
          if (body.priority) mockWorkItem.priority = body.priority
          if (body.sprint_id !== undefined) mockWorkItem.sprint_id = body.sprint_id === 0 ? null : body.sprint_id
          if (body.release_id !== undefined) mockWorkItem.release_id = body.release_id === 0 ? null : body.release_id
          if (body.start_date !== undefined) mockWorkItem.start_date = body.start_date
          if (body.target_date !== undefined) mockWorkItem.target_date = body.target_date
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ...mockWorkItem,
              }),
          } as Response)
        }
      }

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

  it('makes "create new ..." modals sticky (overlay click does NOT close) while detail modals close on overlay click', async () => {
    const { router } = await renderWithRouter(['/projects/DAV'])

    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    // 1. Open "Create New Work Item" modal
    const createBtn = screen.getByTestId('create-work-item-button')
    await act(async () => {
      fireEvent.click(createBtn)
    })

    expect(screen.getByText('Create New Work Item')).toBeInTheDocument()

    // Find the backdrop overlay (has aria-hidden="true")
    const backdrop = document.querySelector('.bg-black\\/80') as HTMLElement
    expect(backdrop).toBeInTheDocument()

    // Clicking overlay should NOT close the create new modal
    await act(async () => {
      fireEvent.click(backdrop)
    })
    expect(screen.getByText('Create New Work Item')).toBeInTheDocument()

    // Close with X button
    const closeCreateBtn = screen.getByRole('button', { name: /Close/i })
    await act(async () => {
      fireEvent.click(closeCreateBtn)
    })
    await waitFor(() => {
      expect(screen.queryByText('Create New Work Item')).not.toBeInTheDocument()
    })

    // 2. Open a detail modal (e.g. Sprint detail)
    const sprintCard = screen.getByTestId('sprint-card-1')
    await act(async () => {
      fireEvent.click(sprintCard)
    })

    await waitFor(() => {
      expect(screen.getByText('Sprint Details & Scope')).toBeInTheDocument()
    })

    // Find the backdrop overlay for the detail modal
    const detailBackdrop = document.querySelector('.bg-black\\/80') as HTMLElement
    expect(detailBackdrop).toBeInTheDocument()

    // Clicking overlay on detail modal DOES close it
    await act(async () => {
      fireEvent.click(detailBackdrop)
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/DAV')
      expect(screen.queryByText('Sprint Details & Scope')).not.toBeInTheDocument()
    })
  })

  it('renders date pickers without time component for target start and target release dates in creation forms', async () => {
    const { router: _router } = await renderWithRouter(['/projects/DAV'])

    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    // Open Release creation modal
    const createRelBtn = screen.getByTestId('create-release-button')
    await act(async () => {
      fireEvent.click(createRelBtn)
    })

    const targetStartInput = screen.getByLabelText(/Target Start/i)
    const targetReleaseDateInput = screen.getByLabelText(/Target Release Date/i)

    expect(targetStartInput).toHaveAttribute('type', 'date')
    expect(targetReleaseDateInput).toHaveAttribute('type', 'date')

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Cancel/i })
    await act(async () => {
      fireEvent.click(closeBtn)
    })

    // Open Sprint creation modal
    const createSprintBtn = screen.getByTestId('create-sprint-button')
    await act(async () => {
      fireEvent.click(createSprintBtn)
    })

    const sprintStartInput = screen.getByLabelText(/^Start Date$/i)
    const sprintEndInput = screen.getByLabelText(/^End Date$/i)

    expect(sprintStartInput).toHaveAttribute('type', 'date')
    expect(sprintEndInput).toHaveAttribute('type', 'date')
  })

  it('supports delete with confirmation in SprintDetailModal, ReleaseDetailModal, and WorkItemDetailModal', async () => {
    const { router } = await renderWithRouter(['/projects/DAV'])

    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    // 1. Sprint Deletion Flow
    const sprintCard = screen.getByTestId('sprint-card-1')
    await act(async () => {
      fireEvent.click(sprintCard)
    })

    await waitFor(() => {
      expect(screen.getByText('Sprint Details & Scope')).toBeInTheDocument()
    })

    // Bin icon is visible
    const deleteSprintBtn = screen.getByTestId('delete-sprint-button')
    expect(deleteSprintBtn).toBeInTheDocument()
    expect(deleteSprintBtn.className).toContain('text-rose-400')

    // Clicking bin button shows confirmation
    await act(async () => {
      fireEvent.click(deleteSprintBtn)
    })
    expect(
      screen.getByText(/Are you sure you want to delete this sprint\? This cannot be undone\./i)
    ).toBeInTheDocument()

    // Clicking Cancel hides confirmation
    const cancelSprintDelBtn = screen.getByRole('button', { name: /Cancel/i })
    await act(async () => {
      fireEvent.click(cancelSprintDelBtn)
    })
    expect(
      screen.queryByText(/Are you sure you want to delete this sprint\? This cannot be undone\./i)
    ).not.toBeInTheDocument()

    // Click bin again and confirm deletion
    await act(async () => {
      fireEvent.click(deleteSprintBtn)
    })
    const confirmSprintDelBtn = screen.getByTestId('confirm-delete-sprint-button')
    await act(async () => {
      fireEvent.click(confirmSprintDelBtn)
    })

    // Navigates back to /projects/DAV and closes modal
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/DAV')
      expect(screen.queryByText('Sprint Details & Scope')).not.toBeInTheDocument()
    })

    // 2. Release Deletion Flow
    const releaseCard = screen.getByTestId('release-card-1')
    await act(async () => {
      fireEvent.click(releaseCard)
    })

    await waitFor(() => {
      expect(screen.getByText('Release Milestone Details')).toBeInTheDocument()
    })

    const deleteReleaseBtn = screen.getByTestId('delete-release-button')
    expect(deleteReleaseBtn).toBeInTheDocument()
    expect(deleteReleaseBtn.className).toContain('text-rose-400')

    await act(async () => {
      fireEvent.click(deleteReleaseBtn)
    })
    expect(
      screen.getByText(/Are you sure you want to delete this release\? This cannot be undone\./i)
    ).toBeInTheDocument()

    const confirmReleaseDelBtn = screen.getByTestId('confirm-delete-release-button')
    await act(async () => {
      fireEvent.click(confirmReleaseDelBtn)
    })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/DAV')
      expect(screen.queryByText('Release Milestone Details')).not.toBeInTheDocument()
    })

    // 3. Work Item Deletion Flow
    const workItemCard = screen.getByTestId('work-item-DAV-1')
    await act(async () => {
      fireEvent.click(workItemCard)
    })

    await waitFor(() => {
      expect(screen.getByText('LLM Agent Context (SKILL.md)')).toBeInTheDocument()
    })

    const deleteWorkItemBtn = screen.getByTestId('delete-work-item-button')
    expect(deleteWorkItemBtn).toBeInTheDocument()
    expect(deleteWorkItemBtn.className).toContain('text-rose-400')

    await act(async () => {
      fireEvent.click(deleteWorkItemBtn)
    })
    expect(
      screen.getByText(/Are you sure you want to delete this work item\? This cannot be undone\./i)
    ).toBeInTheDocument()

    const confirmWorkItemDelBtn = screen.getByTestId('confirm-delete-work-item-button')
    await act(async () => {
      fireEvent.click(confirmWorkItemDelBtn)
    })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/DAV')
      expect(screen.queryByText('LLM Agent Context (SKILL.md)')).not.toBeInTheDocument()
    })
  })

  it('makes titles and descriptions editable on click, shows Save on the left of delete bin in edit mode, and stops overlay from closing modal', async () => {
    const { router } = await renderWithRouter(['/projects/DAV'])

    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    // --- 1. SPRINT DETAIL MODAL ---
    const sprintCard = screen.getByTestId('sprint-card-1')
    await act(async () => {
      fireEvent.click(sprintCard)
    })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-title')).toBeInTheDocument()
    })

    // Initially, Save button is NOT shown
    expect(screen.queryByTestId('save-sprint-button')).not.toBeInTheDocument()

    // Delete bin button is present
    const deleteSprintBtn = screen.getByTestId('delete-sprint-button')
    expect(deleteSprintBtn).toBeInTheDocument()

    // Click title to enter edit mode
    await act(async () => {
      fireEvent.click(screen.getByTestId('sprint-title'))
    })

    // In edit mode: input is rendered, Save button appears on the left of delete bin
    const editNameInput = screen.getByTestId('edit-sprint-name-input')
    const editDescInput = screen.getByTestId('edit-sprint-description-input')
    const saveSprintBtn = screen.getByTestId('save-sprint-button')
    expect(editNameInput).toBeInTheDocument()
    expect(editDescInput).toBeInTheDocument()
    expect(saveSprintBtn).toBeInTheDocument()

    // Verify Save button is on the left of the delete bin in DOM order
    expect(
      Boolean(saveSprintBtn.compareDocumentPosition(deleteSprintBtn) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)

    // Verify backdrop overlay does NOT close modal in edit mode
    const backdrop = document.querySelector('.bg-black\\/80') as HTMLElement
    expect(backdrop).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(backdrop)
    })
    // Modal is still open with inputs
    expect(screen.getByTestId('edit-sprint-name-input')).toBeInTheDocument()

    // Test editing and saving
    fireEvent.change(editNameInput, { target: { value: 'Sprint 1 - Updated' } })
    fireEvent.change(editDescInput, { target: { value: 'Updated Objective' } })

    await act(async () => {
      fireEvent.click(saveSprintBtn)
    })

    // Exits edit mode and displays updated content
    await waitFor(() => {
      expect(screen.queryByTestId('save-sprint-button')).not.toBeInTheDocument()
      expect(screen.getByTestId('sprint-title')).toHaveTextContent('Sprint 1 - Updated')
    })

    // Now that edit mode is off, clicking overlay closes the modal
    await act(async () => {
      fireEvent.click(backdrop)
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/projects/DAV')
    })

    // --- 2. RELEASE DETAIL MODAL ---
    const releaseCard = screen.getByTestId('release-card-1')
    await act(async () => {
      fireEvent.click(releaseCard)
    })

    await waitFor(() => {
      expect(screen.getByTestId('release-description')).toBeInTheDocument()
    })

    // Initially, Save button is NOT shown
    expect(screen.queryByTestId('save-release-button')).not.toBeInTheDocument()
    const deleteReleaseBtn = screen.getByTestId('delete-release-button')
    expect(deleteReleaseBtn).toBeInTheDocument()

    // Clicking description activates edit mode
    await act(async () => {
      fireEvent.click(screen.getByTestId('release-description'))
    })

    const editRelNameInput = screen.getByTestId('edit-release-name-input')
    const editRelDescInput = screen.getByTestId('edit-release-description-input')
    const saveReleaseBtn = screen.getByTestId('save-release-button')
    expect(editRelNameInput).toBeInTheDocument()
    expect(editRelDescInput).toBeInTheDocument()
    expect(saveReleaseBtn).toBeInTheDocument()

    // Save button is to the left of the delete bin
    expect(
      Boolean(saveReleaseBtn.compareDocumentPosition(deleteReleaseBtn) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)

    // Overlay click does NOT close modal in edit mode
    const relBackdrop = document.querySelector('.bg-black\\/80') as HTMLElement
    await act(async () => {
      fireEvent.click(relBackdrop)
    })
    expect(screen.getByTestId('edit-release-name-input')).toBeInTheDocument()

    // Cancel edit exits edit mode
    const cancelRelBtn = screen.getByTestId('cancel-edit-release-button')
    await act(async () => {
      fireEvent.click(cancelRelBtn)
    })
    expect(screen.queryByTestId('save-release-button')).not.toBeInTheDocument()

    // Close release modal
    const closeRelBtn = screen.getByRole('button', { name: /Close/i })
    await act(async () => {
      fireEvent.click(closeRelBtn)
    })

    // --- 3. WORK ITEM DETAIL MODAL ---
    const workItemCard = screen.getByTestId('work-item-DAV-1')
    await act(async () => {
      fireEvent.click(workItemCard)
    })

    await waitFor(() => {
      expect(screen.getByTestId('work-item-title')).toBeInTheDocument()
    })

    // Save button is NOT shown initially
    expect(screen.queryByTestId('save-work-item-button')).not.toBeInTheDocument()
    const deleteWorkItemBtn = screen.getByTestId('delete-work-item-button')
    expect(deleteWorkItemBtn).toBeInTheDocument()

    // Priority select is present in view mode
    const viewPrioritySelect = screen.getByTestId('work-item-priority-select')
    expect(viewPrioritySelect).toBeInTheDocument()
    expect(viewPrioritySelect).toHaveValue('HIGH')

    // Click work item title to activate edit mode
    await act(async () => {
      fireEvent.click(screen.getByTestId('work-item-title'))
    })

    const editWorkItemTitleInput = screen.getByTestId('edit-work-item-title-input')
    const editWorkItemDescInput = screen.getByTestId('edit-work-item-description-input')
    const editPrioritySelect = screen.getByTestId('edit-work-item-priority-select')
    const editSprintSelect = screen.getByTestId('edit-work-item-sprint-select')
    const editReleaseSelect = screen.getByTestId('edit-work-item-release-select')
    const saveWorkItemBtn = screen.getByTestId('save-work-item-button')
    expect(editWorkItemTitleInput).toBeInTheDocument()
    expect(editWorkItemDescInput).toBeInTheDocument()
    expect(editPrioritySelect).toBeInTheDocument()
    expect(editPrioritySelect).toHaveValue('HIGH')
    expect(editSprintSelect).toBeInTheDocument()
    expect(editSprintSelect).toHaveValue('1')
    expect(editReleaseSelect).toBeInTheDocument()
    expect(editReleaseSelect).toHaveValue('1')
    expect(saveWorkItemBtn).toBeInTheDocument()

    // Save button is to the left of the delete bin
    expect(
      Boolean(saveWorkItemBtn.compareDocumentPosition(deleteWorkItemBtn) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)

    // Overlay does NOT close modal in edit mode
    const wiBackdrop = document.querySelector('.bg-black\\/80') as HTMLElement
    await act(async () => {
      fireEvent.click(wiBackdrop)
    })
    expect(screen.getByTestId('edit-work-item-title-input')).toBeInTheDocument()

    // Change title and priority, then save
    fireEvent.change(editWorkItemTitleInput, { target: { value: 'Updated Work Item Title' } })
    fireEvent.change(editPrioritySelect, { target: { value: 'LOW' } })
    await act(async () => {
      fireEvent.click(saveWorkItemBtn)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('save-work-item-button')).not.toBeInTheDocument()
      expect(screen.getByTestId('work-item-title')).toHaveTextContent('Updated Work Item Title')
      expect(screen.getByTestId('work-item-priority-select')).toHaveValue('LOW')
    })

    // Changing priority, sprint, and release directly in view mode
    await act(async () => {
      fireEvent.change(screen.getByTestId('work-item-priority-select'), { target: { value: 'MEDIUM' } })
      fireEvent.change(screen.getByTestId('work-item-sprint-select'), { target: { value: '' } })
      fireEvent.change(screen.getByTestId('work-item-release-select'), { target: { value: '' } })
    })

    await waitFor(() => {
      expect(screen.getByTestId('work-item-priority-select')).toHaveValue('MEDIUM')
      expect(screen.getByTestId('work-item-sprint-select')).toHaveValue('')
      expect(screen.getByTestId('work-item-release-select')).toHaveValue('')
    })
  })

  it('renders the LoginRoute at "/login" when unauthenticated', async () => {
    const origFetch = globalThis.fetch
    globalThis.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString()
      if (urlStr.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Unauthorized' }),
        } as Response)
      }
      return origFetch(url, init)
    })

    const { router } = await renderWithRouter(['/login'])
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByText('Redirecting to Login...')).toBeInTheDocument()
    expect(screen.getByText(/ECMWF \/ Authelia Single Sign-On/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Click here if not redirected automatically/i })
    ).toBeInTheDocument()
  })

  it('supports copying work item details in WorkItemDetailModal to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    await renderWithRouter(['/projects/DAV'])
    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    const workItemCard = screen.getByTestId('work-item-DAV-1')
    await act(async () => {
      fireEvent.click(workItemCard)
    })

    await waitFor(() => {
      expect(screen.getByTestId('copy-work-item-button')).toBeInTheDocument()
    })

    const copyBtn = screen.getByTestId('copy-work-item-button')
    await act(async () => {
      fireEvent.click(copyBtn)
    })

    expect(writeTextMock).toHaveBeenCalledTimes(1)
    const copiedText = writeTextMock.mock.calls[0][0]
    expect(copiedText).toContain('ID: 1')
    expect(copiedText).toContain('Key: DAV-1')
    expect(copiedText).toContain('Title: Build AI-Native Data Models')
    expect(copiedText).toContain('Description:\nDjango ORM schema and models')
    expect(copiedText).toContain('Context:\nSpecifications for AI data models')

    expect(copyBtn).toHaveAttribute('title', 'Copied to clipboard!')
  })

  it('supports setting and updating start_date and end_date on sprint and release detail modals', async () => {
    await renderWithRouter(['/projects/DAV'])

    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    // 1. SPRINT DATE EDITING
    const sprintCard = screen.getByTestId('sprint-card-1')
    await act(async () => {
      fireEvent.click(sprintCard)
    })

    await waitFor(() => {
      expect(screen.getByTestId('sprint-date-display')).toBeInTheDocument()
    })

    // Clicking date display activates edit mode
    await act(async () => {
      fireEvent.click(screen.getByTestId('sprint-date-display'))
    })

    const sprintStartInput = screen.getByTestId('edit-sprint-start-date-input')
    const sprintEndInput = screen.getByTestId('edit-sprint-end-date-input')
    expect(sprintStartInput).toBeInTheDocument()
    expect(sprintEndInput).toBeInTheDocument()

    fireEvent.change(sprintStartInput, { target: { value: '2026-10-01' } })
    fireEvent.change(sprintEndInput, { target: { value: '2026-10-15' } })

    const saveSprintBtn = screen.getByTestId('save-sprint-button')
    await act(async () => {
      fireEvent.click(saveSprintBtn)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('save-sprint-button')).not.toBeInTheDocument()
      expect(screen.getByTestId('sprint-date-display')).toBeInTheDocument()
    })

    // Close sprint modal
    const closeSprintBtn = screen.getByRole('button', { name: /Close/i })
    await act(async () => {
      fireEvent.click(closeSprintBtn)
    })

    // 2. RELEASE DATE EDITING
    const releaseCard = screen.getByTestId('release-card-1')
    await act(async () => {
      fireEvent.click(releaseCard)
    })

    await waitFor(() => {
      expect(screen.getByTestId('release-date-display')).toBeInTheDocument()
    })

    // Clicking release date display activates edit mode
    await act(async () => {
      fireEvent.click(screen.getByTestId('release-date-display'))
    })

    const relStartInput = screen.getByTestId('edit-release-start-date-input')
    const relEndInput = screen.getByTestId('edit-release-end-date-input')
    expect(relStartInput).toBeInTheDocument()
    expect(relEndInput).toBeInTheDocument()

    fireEvent.change(relStartInput, { target: { value: '2026-10-01' } })
    fireEvent.change(relEndInput, { target: { value: '2026-11-01' } })

    const saveReleaseBtn = screen.getByTestId('save-release-button')
    await act(async () => {
      fireEvent.click(saveReleaseBtn)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('save-release-button')).not.toBeInTheDocument()
      expect(screen.getByTestId('release-date-display')).toBeInTheDocument()
    })
  })

  it('supports setting and updating start_date and target_date on work item detail modal in view mode and edit mode', async () => {
    await renderWithRouter(['/projects/DAV'])

    await waitFor(() => {
      expect(screen.getByTestId('project-detail-view')).toBeInTheDocument()
    })

    const workItemCard = screen.getByTestId('work-item-DAV-1')
    await act(async () => {
      fireEvent.click(workItemCard)
    })

    await waitFor(() => {
      expect(screen.getByTestId('work-item-start-date-input')).toBeInTheDocument()
      expect(screen.getByTestId('work-item-target-date-input')).toBeInTheDocument()
    })

    // 1. Direct view-mode date selection
    const viewStartInput = screen.getByTestId('work-item-start-date-input')
    const viewTargetInput = screen.getByTestId('work-item-target-date-input')

    await act(async () => {
      fireEvent.change(viewStartInput, { target: { value: '2026-09-25' } })
    })

    await waitFor(() => {
      expect(screen.getByTestId('work-item-start-date-input')).toHaveValue('2026-09-25')
    })

    await act(async () => {
      fireEvent.change(viewTargetInput, { target: { value: '2026-10-05' } })
    })

    await waitFor(() => {
      expect(screen.getByTestId('work-item-target-date-input')).toHaveValue('2026-10-05')
    })

    // 2. Edit-mode date setting
    await act(async () => {
      fireEvent.click(screen.getByTestId('work-item-title'))
    })

    const editStartInput = screen.getByTestId('edit-work-item-start-date-input')
    const editTargetInput = screen.getByTestId('edit-work-item-target-date-input')
    expect(editStartInput).toBeInTheDocument()
    expect(editTargetInput).toBeInTheDocument()

    fireEvent.change(editStartInput, { target: { value: '2026-09-28' } })
    fireEvent.change(editTargetInput, { target: { value: '2026-10-10' } })

    const saveBtn = screen.getByTestId('save-work-item-button')
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => {
      expect(screen.queryByTestId('save-work-item-button')).not.toBeInTheDocument()
      expect(screen.getByTestId('work-item-start-date-input')).toHaveValue('2026-09-28')
      expect(screen.getByTestId('work-item-target-date-input')).toHaveValue('2026-10-10')
    })
  })
})

