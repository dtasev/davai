import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { createMemoryRouter } from 'react-router-dom'
import App from '../../App'
import { routes } from '../../routes/router'

/**
 * DAV-83 tracking drawer coverage:
 * - GET/POST/DELETE /api/tracked-items are all backed by the in-memory
 *   `trackedRows` array below, so optimistic UI updates survive the provider's
 *   post-mutation refreshTracked() reconciliations.
 * - The drawer defaults to COLLAPSED (localStorage `davai_drawer_open`), so
 *   tests either seed localStorage before render or click `drawer-toggle`.
 */
describe('TrackingDrawer (DAV-83 active work item tracker)', () => {
  let trackedRows: any[]
  let nextTrackedId: number

  let workItemsData: any[]
  let sprintsData: any[]
  let releasesData: any[]
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // ---- project catalogs -------------------------------------------------
    const baseWorkItem = {
      parent_key: null,
      description: '',
      priority: 'MEDIUM',
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
      context: null,
      progress: [],
    }
    workItemsData = [
      {
        ...baseWorkItem,
        id: 1,
        key: 'DAV-1',
        title: 'Build AI-Native Data Models',
        status: 'in progress',
      },
      {
        ...baseWorkItem,
        id: 2,
        key: 'DAV-2',
        title: 'Frontend Kanban Board',
        status: 'todo',
        assigned: ['john_doe'],
        active_assignee: 'john_doe',
      },
      {
        ...baseWorkItem,
        id: 3,
        key: 'DAV-3',
        title: 'Write Release Notes',
        status: 'done',
      },
    ]

    sprintsData = [
      {
        id: 1,
        project_key: 'DAV',
        release_id: 1,
        name: 'Sprint 1 - Foundation',
        description: 'Bootstrap MVP sprint',
        status: 'in progress',
        done_at: null,
        start_date: '2026-09-20T00:00:00Z',
        end_date: '2026-10-04T00:00:00Z',
        created_at: '2026-09-20T00:00:00Z',
      },
      {
        id: 2,
        project_key: 'DAV',
        release_id: 1,
        name: 'Sprint 0 - Legacy',
        description: 'Completed earlier sprint',
        status: 'done',
        done_at: '2026-09-10T10:00:00Z',
        start_date: '2026-08-20T00:00:00Z',
        end_date: '2026-09-10T00:00:00Z',
        created_at: '2026-08-20T00:00:00Z',
      },
      {
        id: 3,
        project_key: 'DAV',
        release_id: 1,
        name: 'Sprint 2 - Tracking',
        description: 'Not yet tracked sprint',
        status: 'planned',
        done_at: null,
        start_date: '2026-10-05T00:00:00Z',
        end_date: '2026-10-19T00:00:00Z',
        created_at: '2026-10-01T00:00:00Z',
      },
    ]

    releasesData = [
      {
        id: 1,
        project_key: 'DAV',
        name: 'v0.1.0',
        description: 'Initial MVP release milestone',
        status: 'planned',
        done_at: null,
        start_date: '2026-09-20T00:00:00Z',
        end_date: '2026-10-15T00:00:00Z',
        created_at: '2026-09-20T00:00:00Z',
      },
      {
        id: 2,
        project_key: 'DAV',
        name: 'v0.0.9',
        description: 'Internal preview release',
        status: 'done',
        done_at: '2026-08-30T10:00:00Z',
        start_date: '2026-08-01T00:00:00Z',
        end_date: '2026-08-30T00:00:00Z',
        created_at: '2026-08-01T00:00:00Z',
      },
    ]

    // ---- server-side tracked rows for the logged-in user -------------------
    nextTrackedId = 100
    trackedRows = [
      { id: 11, item_type: 'work_item', ref_id: 1, key: 'DAV-1', title: 'Build AI-Native Data Models', status: 'in progress', project_key: 'DAV', added_at: '2026-10-01T08:00:00Z' },
      { id: 12, item_type: 'work_item', ref_id: 3, key: 'DAV-3', title: 'Write Release Notes', status: 'done', project_key: 'DAV', added_at: '2026-10-02T08:00:00Z' },
      { id: 21, item_type: 'incident', ref_id: 1, key: 'DAV-INC-1', title: 'Redis Cluster Failover', status: 'ongoing', project_key: 'DAV', added_at: '2026-10-01T09:00:00Z' },
      { id: 22, item_type: 'incident', ref_id: 2, key: 'DAV-INC-2', title: 'Decommissioned Storage Alert', status: 'no longer relevant', project_key: 'DAV', added_at: '2026-10-03T09:00:00Z' },
      { id: 31, item_type: 'user_support', ref_id: 501, key: 'DAV-SUP-1', title: 'Cannot download GRIB2 forecast', status: 'todo', project_key: 'DAV', added_at: '2026-10-01T10:00:00Z' },
      { id: 41, item_type: 'sprint', ref_id: 1, key: '1', title: 'Sprint 1 - Foundation', status: 'in progress', project_key: 'DAV', added_at: '2026-10-01T11:00:00Z' },
      { id: 42, item_type: 'sprint', ref_id: 2, key: '2', title: 'Sprint 0 - Legacy', status: 'done', project_key: 'DAV', added_at: '2026-10-02T11:00:00Z' },
      { id: 51, item_type: 'release', ref_id: 1, key: '1', title: 'v0.1.0', status: 'planned', project_key: 'DAV', added_at: '2026-10-01T12:00:00Z' },
    ]

    const okRes = (data: unknown) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response)

    const SECTION_ITEM_TYPE: Record<string, string> = {
      work_items: 'work_item',
      user_support: 'user_support',
      incidents: 'incident',
      sprints: 'sprint',
      releases: 'release',
    }

    // ---- global fetch mock (App.test.tsx URL-branch pattern) ---------------
    fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString()
      const method = init?.method?.toUpperCase() || 'GET'

      // --- Tracked items API: /api/tracked-items (GET/POST/DELETE) ---
      if (urlStr.includes('/api/tracked-items')) {
        if (method === 'GET') {
          return okRes(trackedRows.map(r => ({ ...r })))
        }
        if (method === 'POST') {
          const body = init?.body ? JSON.parse(init.body as string) : {}
          const itemType: string = body.item_type
          if (itemType === 'sprint' || itemType === 'release') {
            const existing = trackedRows.find(
              t => t.item_type === itemType && t.ref_id === body.id
            )
            if (existing) return okRes({ ...existing })
            const catalog = itemType === 'sprint' ? sprintsData : releasesData
            const target = catalog.find(s => s.id === body.id)
            if (!target) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ detail: 'not found' }) } as Response)
            const row = {
              id: nextTrackedId++,
              item_type: itemType,
              ref_id: target.id,
              key: String(target.id),
              title: target.name,
              status: target.status || 'planned',
              project_key: 'DAV',
              added_at: new Date().toISOString(),
            }
            trackedRows = [...trackedRows, row]
            return okRes({ ...row })
          }
          // key-identified types: work_item / user_support / incident
          const existing = trackedRows.find(
            t => t.item_type === itemType && t.key === body.key
          )
          if (existing) return okRes({ ...existing })
          let ref = 0
          let title = String(body.key)
          let status = 'todo'
          if (itemType === 'incident') {
            ref = body.key === 'DAV-INC-2' ? 2 : 1
            title = body.key === 'DAV-INC-2' ? 'Decommissioned Storage Alert' : 'Redis Cluster Failover'
            status = body.key === 'DAV-INC-2' ? 'no longer relevant' : 'ongoing'
          } else if (itemType === 'user_support') {
            ref = 501
          } else {
            const wi = workItemsData.find(w => w.key === body.key)
            if (!wi) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ detail: 'not found' }) } as Response)
            ref = wi.id
            title = wi.title
            status = wi.status
          }
          const row = {
            id: nextTrackedId++,
            item_type: itemType,
            ref_id: ref,
            key: body.key,
            title,
            status,
            project_key: 'DAV',
            added_at: new Date().toISOString(),
          }
          trackedRows = [...trackedRows, row]
          return okRes({ ...row })
        }
        if (method === 'DELETE' && urlStr.includes('/api/tracked-items/done')) {
          const section = (urlStr.match(/section=(\w+)/) || [])[1] || 'work_items'
          const type = SECTION_ITEM_TYPE[section] || 'work_item'
          const before = trackedRows.length
          trackedRows = trackedRows.filter(t => {
            if (t.item_type !== type) return true
            const doneLike =
              t.status === 'done' || (section === 'incidents' && t.status === 'no longer relevant')
            return !doneLike
          })
          return okRes({ success: true, removed: before - trackedRows.length })
        }
        if (method === 'DELETE') {
          const id = parseInt(urlStr.split('?')[0].split('/').pop() as string, 10)
          const before = trackedRows.length
          trackedRows = trackedRows.filter(t => t.id !== id)
          return okRes({ success: true, removed: before - trackedRows.length })
        }
      }

      if (urlStr.includes('/api/auth/me')) {
        return okRes({ id: 1, username: 'admin', email: 'admin@dtasev.co.uk', is_staff: true })
      }

      if (urlStr.includes('/api/auth/keys')) {
        return okRes([
          { id: 1, name: 'Default Admin Key', prefix: 'dav_live_7186e', created_at: '2026-09-20T00:00:00Z', last_used_at: null, is_active: true },
        ])
      }

      if (urlStr.includes('/api/projects/DAV/sprints')) {
        return okRes(sprintsData)
      }

      if (urlStr.includes('/api/projects/DAV/releases')) {
        return okRes(releasesData)
      }

      if (urlStr.includes('/api/projects/DAV/user-support')) {
        return okRes([])
      }

      if (urlStr.includes('/api/projects/DAV/incidents')) {
        return okRes([])
      }

      if (urlStr.includes('/api/projects')) {
        return okRes([
          {
            id: 1,
            key: 'DAV',
            name: 'Davai Tracker',
            description: 'Cutting-edge AI-native project engine',
            item_count: 3,
            statuses: [
              { id: 1, name: 'todo', order: 1, is_default: true },
              { id: 2, name: 'in progress', order: 2, is_default: false },
              { id: 3, name: 'done', order: 3, is_default: false },
            ],
          },
        ])
      }

      if (urlStr.includes('/api/users')) {
        return okRes([
          { id: 1, username: 'admin' },
          { id: 2, username: 'john_doe' },
        ])
      }

      if (urlStr.includes('/api/work-items?project_key=DAV')) {
        return okRes(workItemsData)
      }

      const single = urlStr.match(/\/api\/work-items\/(DAV-\d+)/)
      if (single) {
        const wi = workItemsData.find(w => w.key === single[1])
        return okRes(wi || {})
      }

      // Any other call (hello/info/monitoring-logs/search/…): tolerate like App.test.tsx.
      return okRes({})
    })
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  })

  const renderWithRouter = async (initialEntries: string[] = ['/projects/DAV'], drawerOpen = true) => {
    if (drawerOpen) {
      localStorage.setItem('davai_drawer_open', 'true')
    }
    const memoryRouter = createMemoryRouter(routes, {
      initialEntries,
      future: { v7_relativeSplatPath: true },
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

  /** Render with open drawer and wait until all seeded section rows are in. */
  const renderOpenDrawerWithRows = async () => {
    const result = await renderWithRouter(['/projects/DAV'])
    await waitFor(() => {
      expect(screen.getByTestId('drawer-item-work_item-DAV-1')).toBeInTheDocument()
      expect(screen.getByTestId('drawer-item-sprint-2')).toBeInTheDocument()
      expect(screen.getByTestId('drawer-item-release-1')).toBeInTheDocument()
    })
    return result
  }

  const fetchCallsMatching = (urlPart: string, method: string) =>
    fetchMock.mock.calls.filter(
      ([u, init]) =>
        String(u).includes(urlPart) &&
        ((init as RequestInit | undefined)?.method?.toUpperCase() || 'GET') === method
    )

  it('renders collapsed by default, expands via drawer-toggle with all five sections and counts, and collapses back', async () => {
    await renderWithRouter(['/projects/DAV'], false)

    // Collapsed by default: only the toggle is present.
    expect(screen.queryByTestId('tracking-drawer')).not.toBeInTheDocument()
    const toggle = screen.getByTestId('drawer-toggle')

    await act(async () => {
      fireEvent.click(toggle)
    })

    const drawer = await screen.findByTestId('tracking-drawer')

    // Wait for the tracked rows to hydrate from GET /api/tracked-items.
    await waitFor(() => {
      expect(screen.getByTestId('drawer-item-work_item-DAV-3')).toBeInTheDocument()
    })

    // Contractual section order: Incidents, Work Items, User Support, Sprints, Releases.
    const sections = within(drawer).getAllByTestId(/^drawer-section-/)
    expect(sections.map(s => s.getAttribute('data-testid'))).toEqual([
      'drawer-section-incidents',
      'drawer-section-work_items',
      'drawer-section-user_support',
      'drawer-section-sprints',
      'drawer-section-releases',
    ])

    expect(within(screen.getByTestId('drawer-section-incidents')).getByRole('heading')).toHaveTextContent('Incidents(2)')
    expect(within(screen.getByTestId('drawer-section-work_items')).getByRole('heading')).toHaveTextContent('Work Items(2)')
    expect(within(screen.getByTestId('drawer-section-user_support')).getByRole('heading')).toHaveTextContent('User Support(1)')
    expect(within(screen.getByTestId('drawer-section-sprints')).getByRole('heading')).toHaveTextContent('Sprints(2)')
    expect(within(screen.getByTestId('drawer-section-releases')).getByRole('heading')).toHaveTextContent('Releases(1)')

    // Collapse again: testid moves back to the toggle and open state persists.
    await act(async () => {
      fireEvent.click(screen.getByTestId('drawer-collapse'))
    })
    expect(screen.queryByTestId('tracking-drawer')).not.toBeInTheDocument()
    expect(screen.getByTestId('drawer-toggle')).toBeInTheDocument()
    expect(localStorage.getItem('davai_drawer_open')).toBe('false')
  })

  it('sorts done-like rows after non-done rows within each section (incl. "no longer relevant" incident at the bottom)', async () => {
    await renderOpenDrawerWithRows()

    const workItemRows = within(screen.getByTestId('drawer-section-work_items')).getAllByTestId(/^drawer-item-/)
    expect(workItemRows.map(r => r.getAttribute('data-testid'))).toEqual([
      'drawer-item-work_item-DAV-1',
      'drawer-item-work_item-DAV-3', // done → pushed to bottom
    ])

    const incidentRows = within(screen.getByTestId('drawer-section-incidents')).getAllByTestId(/^drawer-item-/)
    expect(incidentRows.map(r => r.getAttribute('data-testid'))).toEqual([
      'drawer-item-incident-DAV-INC-1',
      'drawer-item-incident-DAV-INC-2', // 'no longer relevant' → treated as done, last
    ])

    const sprintRows = within(screen.getByTestId('drawer-section-sprints')).getAllByTestId(/^drawer-item-/)
    expect(sprintRows.map(r => r.getAttribute('data-testid'))).toEqual([
      'drawer-item-sprint-1',
      'drawer-item-sprint-2', // done sprint at bottom
    ])

    // Clear-done affordances exist exactly for sections with done-like rows.
    expect(screen.getByTestId('drawer-clear-done-work_items')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-clear-done-incidents')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-clear-done-sprints')).toBeInTheDocument()
    expect(screen.queryByTestId('drawer-clear-done-user_support')).not.toBeInTheDocument()
    expect(screen.queryByTestId('drawer-clear-done-releases')).not.toBeInTheDocument()
  })

  it('clears only done work items via drawer-clear-done-work_items (DELETE ?section=work_items)', async () => {
    await renderOpenDrawerWithRows()

    await act(async () => {
      fireEvent.click(screen.getByTestId('drawer-clear-done-work_items'))
    })

    expect(fetchCallsMatching('/api/tracked-items/done?section=work_items', 'DELETE').length).toBe(1)

    await waitFor(() => {
      expect(screen.queryByTestId('drawer-item-work_item-DAV-3')).not.toBeInTheDocument()
    })
    // Non-done entries survive (also after the provider's refetch).
    expect(screen.getByTestId('drawer-item-work_item-DAV-1')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-item-incident-DAV-INC-2')).toBeInTheDocument()
    expect(screen.getByTestId('drawer-item-sprint-2')).toBeInTheDocument()

    await waitFor(() => {
      expect(within(screen.getByTestId('drawer-section-work_items')).getByRole('heading')).toHaveTextContent('Work Items(1)')
    })
    // No done rows left → trash button disappears from the section header.
    expect(screen.queryByTestId('drawer-clear-done-work_items')).not.toBeInTheDocument()
  })

  it('clears only the done sprint via drawer-clear-done-sprints (in-progress sprint stays)', async () => {
    await renderOpenDrawerWithRows()

    await act(async () => {
      fireEvent.click(screen.getByTestId('drawer-clear-done-sprints'))
    })

    expect(fetchCallsMatching('/api/tracked-items/done?section=sprints', 'DELETE').length).toBe(1)

    await waitFor(() => {
      expect(screen.queryByTestId('drawer-item-sprint-2')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('drawer-item-sprint-1')).toBeInTheDocument()

    await waitFor(() => {
      expect(within(screen.getByTestId('drawer-section-sprints')).getByRole('heading')).toHaveTextContent('Sprints(1)')
    })
    // Unrelated sections untouched.
    expect(screen.getByTestId('drawer-item-work_item-DAV-3')).toBeInTheDocument()
  })

  it('untracks a single row via drawer-remove-<id> (DELETE /api/tracked-items/<id>)', async () => {
    await renderOpenDrawerWithRows()

    await act(async () => {
      fireEvent.click(screen.getByTestId('drawer-remove-11')) // tracked row id of DAV-1
    })

    expect(fetchCallsMatching('/api/tracked-items/11', 'DELETE').length).toBe(1)

    await waitFor(() => {
      expect(screen.queryByTestId('drawer-item-work_item-DAV-1')).not.toBeInTheDocument()
    })
    // The done-like DAV-3 row is unaffected.
    expect(screen.getByTestId('drawer-item-work_item-DAV-3')).toBeInTheDocument()

    // The list-row track toggle flipped back to untracked.
    await waitFor(() => {
      expect(screen.getByTestId('track-work_item-DAV-1')).toHaveAttribute('aria-pressed', 'false')
    })
  })

  it('tracks a sprint from its project-view card (POST {item_type:"sprint", id:3}) and gains the drawer row', async () => {
    await renderOpenDrawerWithRows()

    // Sprint card exposes its toggle.
    const sprintCard = screen.getByTestId('sprint-card-3')
    const sprintToggle = within(sprintCard).getByTestId('track-sprint-3')
    expect(sprintToggle).toHaveAttribute('aria-pressed', 'false')

    await act(async () => {
      fireEvent.click(sprintToggle)
    })

    const posts = fetchCallsMatching('/api/tracked-items', 'POST')
    expect(posts.length).toBe(1)
    expect(JSON.parse((posts[0][1] as RequestInit).body as string)).toEqual({ item_type: 'sprint', id: 3 })

    await waitFor(() => {
      expect(screen.getByTestId('drawer-item-sprint-3')).toBeInTheDocument()
      expect(within(sprintCard).getByTestId('track-sprint-3')).toHaveAttribute('aria-pressed', 'true')
    })
    // Drawer navigation did not happen — clicking the toggle does not open the sprint modal.
    expect(screen.queryByTestId('sprint-detail-modal')).not.toBeInTheDocument()
  })

  it('tracks a work item from its list row (POST {item_type:"work_item", key:"DAV-2"}) and gains the drawer row', async () => {
    await renderOpenDrawerWithRows()

    const workItemToggle = screen.getByTestId('track-work_item-DAV-2')
    expect(screen.queryByTestId('drawer-item-work_item-DAV-2')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(workItemToggle)
    })

    const posts = fetchCallsMatching('/api/tracked-items', 'POST')
    expect(posts.length).toBe(1)
    expect(JSON.parse((posts[0][1] as RequestInit).body as string)).toEqual({ item_type: 'work_item', key: 'DAV-2' })

    await waitFor(() => {
      expect(screen.getByTestId('drawer-item-work_item-DAV-2')).toBeInTheDocument()
      expect(screen.getByTestId('track-work_item-DAV-2')).toHaveAttribute('aria-pressed', 'true')
    })
    // No detail modal opened from the row click (toggle stops propagation).
    expect(screen.queryByTestId('work-item-detail-modal')).not.toBeInTheDocument()
  })

  it('shows the tracked state on release cards and untracks via the card toggle (DELETE /api/tracked-items/51)', async () => {
    await renderOpenDrawerWithRows()

    const releaseCard = screen.getByTestId('release-card-1')
    const releaseToggle = within(releaseCard).getByTestId('track-release-1')
    // Seeded as tracked already → toggle reflects the tracked state.
    expect(releaseToggle).toHaveAttribute('aria-pressed', 'true')

    await act(async () => {
      fireEvent.click(releaseToggle)
    })

    expect(fetchCallsMatching('/api/tracked-items/51', 'DELETE').length).toBe(1)

    await waitFor(() => {
      expect(screen.queryByTestId('drawer-item-release-1')).not.toBeInTheDocument()
      expect(within(releaseCard).getByTestId('track-release-1')).toHaveAttribute('aria-pressed', 'false')
    })
    expect(within(screen.getByTestId('drawer-section-releases')).getByRole('heading')).toHaveTextContent('Releases(0)')
  })

  it('exposes track toggles on work item rows, sprint cards and release cards of the default project view', async () => {
    await renderOpenDrawerWithRows()

    // Work item rows (done ones are hidden by the list's default status filter),
    // active sprint cards and active release cards all expose their toggles.
    expect(screen.getByTestId('track-work_item-DAV-1')).toBeInTheDocument()
    expect(screen.getByTestId('track-work_item-DAV-2')).toBeInTheDocument()
    expect(screen.getByTestId('track-sprint-1')).toBeInTheDocument()
    expect(screen.getByTestId('track-sprint-3')).toBeInTheDocument()
    expect(screen.getByTestId('track-release-1')).toBeInTheDocument()
  })
})
