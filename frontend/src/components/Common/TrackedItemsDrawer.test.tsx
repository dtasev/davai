import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TrackedItemsDrawer } from './TrackedItemsDrawer'
import { Header } from '../Header'
import { WorkItemList } from '../ProjectDetail/WorkItemList'
import { UserSupportList } from '../ProjectDetail/UserSupportList'
import { IncidentList } from '../ProjectDetail/IncidentList'
import { SprintDetailModal } from '../Modals/SprintDetailModal'
import { ReleaseDetailModal } from '../Modals/ReleaseDetailModal'
import { WorkItemDetailModal } from '../Modals/WorkItemDetailModal'
import { IncidentDetailModal } from '../Modals/IncidentDetailModal'
import { AppProvider } from '../../context/AppContext'
import * as AppContextModule from '../../context/AppContext'
import { TrackedItem, WorkItem, Incident, Sprint, Release, ProjectStatus } from '../../types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

describe('TrackedItemsDrawer Component', () => {
  const mockTrackedItems: TrackedItem[] = [
    {
      id: 1,
      key: 'INC-2',
      title: 'Incident Done',
      status: 'done',
      project_key: 'DAV',
      type: 'incident',
      created_at: '2026-10-01T00:00:00Z'
    },
    {
      id: 2,
      key: 'INC-1',
      title: 'Incident Active',
      status: 'ongoing',
      project_key: 'DAV',
      type: 'incident',
      created_at: '2026-10-02T00:00:00Z'
    },
    {
      id: 3,
      key: 'DAV-20',
      title: 'Work Item Done',
      status: 'done',
      project_key: 'DAV',
      type: 'work-item',
      created_at: '2026-10-03T00:00:00Z'
    },
    {
      id: 4,
      key: 'DAV-10',
      title: 'Work Item In Progress',
      status: 'in progress',
      project_key: 'DAV',
      type: 'work-item',
      created_at: '2026-10-04T00:00:00Z'
    },
    {
      id: 5,
      key: 'DAV-SUP-2',
      title: 'Support Ticket Done',
      status: 'done',
      project_key: 'DAV',
      type: 'user-support',
      created_at: '2026-10-05T00:00:00Z'
    },
    {
      id: 6,
      key: 'DAV-SUP-1',
      title: 'Support Ticket Planned',
      status: 'planned',
      project_key: 'DAV',
      type: 'user-support',
      created_at: '2026-10-06T00:00:00Z'
    }
  ]

  const setIsTrackingDrawerOpen = vi.fn()
  const untrackItem = vi.fn()
  const clearDoneTrackedItems = vi.fn()
  const toggleTrackItem = vi.fn()
  const isTracked = vi.fn((key: string) => mockTrackedItems.some(i => i.key === key))

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('does not render when closed', () => {
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: false,
      setIsTrackingDrawerOpen,
      trackedItems: mockTrackedItems,
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    expect(screen.queryByTestId('tracked-items-drawer')).not.toBeInTheDocument()
  })

  it('renders three independent sections in order: Incidents, Work items, User Support', () => {
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: true,
      setIsTrackingDrawerOpen,
      trackedItems: mockTrackedItems,
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    expect(screen.getByTestId('tracked-items-drawer')).toBeInTheDocument()

    // 1. Check sections exist
    const incSection = screen.getByTestId('tracking-section-incident')
    const wiSection = screen.getByTestId('tracking-section-work-item')
    const supSection = screen.getByTestId('tracking-section-user-support')

    expect(incSection).toBeInTheDocument()
    expect(wiSection).toBeInTheDocument()
    expect(supSection).toBeInTheDocument()

    // 2. Check DOM ordering: Work items first, User Support second, Incidents third
    const allSections = screen.getAllByTestId(/^tracking-section-/)
    expect(allSections[0]).toHaveAttribute('data-testid', 'tracking-section-work-item')
    expect(allSections[1]).toHaveAttribute('data-testid', 'tracking-section-user-support')
    expect(allSections[2]).toHaveAttribute('data-testid', 'tracking-section-incident')
  })

  it('does not show any "no tracked items" placeholder when a section has no items', () => {
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: true,
      setIsTrackingDrawerOpen,
      trackedItems: [],
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    expect(screen.queryByText(/no tracked items/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('tracked-items-list-work-item')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tracked-items-list-user-support')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tracked-items-list-incident')).not.toBeInTheDocument()
  })

  it('sorts items in each section with DONE at the bottom', () => {
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: true,
      setIsTrackingDrawerOpen,
      trackedItems: mockTrackedItems,
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    // Check Incidents section: INC-1 (ongoing) should be before INC-2 (done)
    const incRows = screen.getByTestId('tracked-items-list-incident').querySelectorAll('[data-testid^="tracked-item-row-"]')
    expect(incRows[0]).toHaveAttribute('data-testid', 'tracked-item-row-INC-1')
    expect(incRows[1]).toHaveAttribute('data-testid', 'tracked-item-row-INC-2')

    // Check Work items section: DAV-10 (in progress) before DAV-20 (done)
    const wiRows = screen.getByTestId('tracked-items-list-work-item').querySelectorAll('[data-testid^="tracked-item-row-"]')
    expect(wiRows[0]).toHaveAttribute('data-testid', 'tracked-item-row-DAV-10')
    expect(wiRows[1]).toHaveAttribute('data-testid', 'tracked-item-row-DAV-20')

    // Check User Support section: DAV-SUP-1 (planned) before DAV-SUP-2 (done)
    const supRows = screen.getByTestId('tracked-items-list-user-support').querySelectorAll('[data-testid^="tracked-item-row-"]')
    expect(supRows[0]).toHaveAttribute('data-testid', 'tracked-item-row-DAV-SUP-1')
    expect(supRows[1]).toHaveAttribute('data-testid', 'tracked-item-row-DAV-SUP-2')
  })

  it('clears only done items in that section when the red trash bin is clicked', () => {
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: true,
      setIsTrackingDrawerOpen,
      trackedItems: mockTrackedItems,
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    // Click clear done on Work items
    const clearWiButton = screen.getByTestId('clear-done-work-item-button')
    fireEvent.click(clearWiButton)
    expect(clearDoneTrackedItems).toHaveBeenCalledWith('work-item')

    // Click clear done on Incidents
    const clearIncButton = screen.getByTestId('clear-done-incident-button')
    fireEvent.click(clearIncButton)
    expect(clearDoneTrackedItems).toHaveBeenCalledWith('incident')

    // Click clear done on User Support
    const clearSupButton = screen.getByTestId('clear-done-user-support-button')
    fireEvent.click(clearSupButton)
    expect(clearDoneTrackedItems).toHaveBeenCalledWith('user-support')
  })

  it('disables red trash bin button when there are no done items in that section', () => {
    const noDoneItems: TrackedItem[] = [
      {
        key: 'DAV-1',
        title: 'Work Item',
        status: 'todo',
        project_key: 'DAV',
        type: 'work-item'
      }
    ]

    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: true,
      setIsTrackingDrawerOpen,
      trackedItems: noDoneItems,
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    const clearWiButton = screen.getByTestId('clear-done-work-item-button')
    expect(clearWiButton).toBeDisabled()
  })

  it('navigates to item route when clicked', () => {
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: true,
      setIsTrackingDrawerOpen,
      trackedItems: mockTrackedItems,
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    // Click on work item row
    fireEvent.click(screen.getByTestId('tracked-item-row-DAV-10'))
    expect(mockNavigate).toHaveBeenCalledWith('/projects/DAV/items/DAV-10')

    // Click on incident row
    fireEvent.click(screen.getByTestId('tracked-item-row-INC-1'))
    expect(mockNavigate).toHaveBeenCalledWith('/projects/DAV/incidents/INC-1')

    // Click on user support row
    fireEvent.click(screen.getByTestId('tracked-item-row-DAV-SUP-1'))
    expect(mockNavigate).toHaveBeenCalledWith('/projects/DAV/user-support/DAV-SUP-1')
  })

  it('untracks an item when clicking the X button', () => {
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: true,
      setIsTrackingDrawerOpen,
      trackedItems: mockTrackedItems,
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    const untrackBtn = screen.getByTestId('untrack-item-DAV-10')
    fireEvent.click(untrackBtn)
    expect(untrackItem).toHaveBeenCalledWith('DAV-10')
  })

  it('closes drawer on Escape key or close button', () => {
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: true,
      setIsTrackingDrawerOpen,
      trackedItems: mockTrackedItems,
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId('close-tracking-drawer-button'))
    expect(setIsTrackingDrawerOpen).toHaveBeenCalledWith(false)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(setIsTrackingDrawerOpen).toHaveBeenCalledWith(false)
  })

  it('renders docked on the page without a backdrop so the rest of the app is usable', () => {
    vi.spyOn(AppContextModule, 'useApp').mockReturnValue({
      isTrackingDrawerOpen: true,
      setIsTrackingDrawerOpen,
      trackedItems: mockTrackedItems,
      untrackItem,
      clearDoneTrackedItems,
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <TrackedItemsDrawer />
      </MemoryRouter>
    )

    // Verify there is no blocking backdrop
    expect(screen.queryByTestId('tracking-drawer-backdrop')).not.toBeInTheDocument()
    expect(screen.getByTestId('tracked-items-drawer')).toBeInTheDocument()
  })
})

describe('Tracking Plus Button Integrations', () => {
  const toggleTrackItem = vi.fn()
  const isTracked = vi.fn((key: string) => key === 'DAV-TRACKED')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(AppContextModule, 'useOptionalApp').mockReturnValue({
      isTrackingDrawerOpen: false,
      setIsTrackingDrawerOpen: vi.fn(),
      trackedItems: [],
      toggleTrackItem,
      isTracked
    } as any)
  })

  it('renders 3 horizontal lines button on the left of Header and toggles drawer', () => {
    const setIsTrackingDrawerOpen = vi.fn()
    vi.spyOn(AppContextModule, 'useOptionalApp').mockReturnValue({
      isTrackingDrawerOpen: false,
      setIsTrackingDrawerOpen,
      trackedItems: [],
      toggleTrackItem,
      isTracked
    } as any)

    render(
      <MemoryRouter>
        <Header userProfile={{ id: 1, username: 'testuser', email: 'test@ecmwf.int', is_staff: false }} />
      </MemoryRouter>
    )

    const toggleBtn = screen.getByTestId('tracking-drawer-toggle')
    expect(toggleBtn).toBeInTheDocument()
    fireEvent.click(toggleBtn)
    expect(setIsTrackingDrawerOpen).toHaveBeenCalled()
  })

  it('renders Plus button on the right side left of assignee badge in WorkItemList', () => {
    const sampleItem: WorkItem = {
      id: 1,
      key: 'DAV-42',
      title: 'Fix cache bug',
      status: 'in progress',
      priority: 'HIGH',
      project_key: 'DAV',
      active_assignee: 'jdoe',
      created_by: 'admin',
      updated_by: null,
      assigned: ['jdoe'],
      watching: [],
      source: '',
      start_date: null,
      target_date: null,
      sprint_id: null,
      release_id: null,
      created: '2026-10-01T00:00:00Z',
      updated: '2026-10-01T00:00:00Z',
      context: null,
      progress: []
    }

    render(
      <MemoryRouter>
        <WorkItemList
          projectKey="DAV"
          workItems={[sampleItem]}
          sprints={[]}
          releases={[]}
          statuses={[]}
          onSelectWorkItem={vi.fn()}
          onCreateWorkItem={vi.fn()}
        />
      </MemoryRouter>
    )

    const plusBtn = screen.getByTestId('track-item-button-DAV-42')
    expect(plusBtn).toBeInTheDocument()
    fireEvent.click(plusBtn)
    expect(toggleTrackItem).toHaveBeenCalledWith(sampleItem, 'work-item')
  })

  it('renders Plus button left of assignee in UserSupportList', () => {
    const sampleSupportItem: WorkItem = {
      id: 2,
      key: 'DAV-SUP-99',
      title: 'Password reset request',
      status: 'todo',
      priority: 'LOW',
      project_key: 'DAV',
      active_assignee: 'helpdesk',
      is_support: true,
      created_by: 'user1',
      updated_by: null,
      assigned: ['helpdesk'],
      watching: [],
      source: '',
      start_date: null,
      target_date: null,
      sprint_id: null,
      release_id: null,
      created: '2026-10-01T00:00:00Z',
      updated: '2026-10-01T00:00:00Z',
      context: null,
      progress: []
    }

    render(
      <MemoryRouter>
        <UserSupportList
          projectKey="DAV"
          userSupportItems={[sampleSupportItem]}
          statuses={[]}
          onSelectUserSupportItem={vi.fn()}
          onCreateUserSupportItem={vi.fn()}
        />
      </MemoryRouter>
    )

    const plusBtn = screen.getByTestId('track-item-button-DAV-SUP-99')
    expect(plusBtn).toBeInTheDocument()
    fireEvent.click(plusBtn)
    expect(toggleTrackItem).toHaveBeenCalledWith(sampleSupportItem, 'user-support')
  })

  it('renders Plus button on IncidentList items', () => {
    const sampleIncident: Incident = {
      id: 3,
      key: 'INC-77',
      project_key: 'DAV',
      title: 'GRIB service timeout',
      cause: 'DB connection limit reached',
      investigation_note: 'Check pgbouncer settings',
      status: 'ongoing',
      work_items: [],
      work_item_keys: [],
      monitoring_log_ids: [],
      monitoring_log_keys: [],
      monitoring_logs: [],
      created_by: 'admin',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z'
    }

    render(
      <MemoryRouter>
        <IncidentList
          projectKey="DAV"
          incidents={[sampleIncident]}
          onSelectIncident={vi.fn()}
          onCreateIncident={vi.fn()}
        />
      </MemoryRouter>
    )

    const plusBtn = screen.getByTestId('track-incident-button-INC-77')
    expect(plusBtn).toBeInTheDocument()
    fireEvent.click(plusBtn)
    expect(toggleTrackItem).toHaveBeenCalledWith(sampleIncident, 'incident')
  })

  it('renders Plus button on sprint assigned work items in SprintDetailModal', () => {
    const sprint: Sprint = {
      id: 1,
      project_key: 'DAV',
      name: 'Sprint 1',
      description: 'Initial sprint',
      release_id: null,
      start_date: null,
      end_date: null,
      created_at: '2026-10-01T00:00:00Z'
    }
    const sprintItem: WorkItem = {
      id: 10,
      key: 'DAV-10',
      title: 'Sprint work item',
      status: 'in progress',
      priority: 'MEDIUM',
      project_key: 'DAV',
      active_assignee: null,
      created_by: 'admin',
      updated_by: null,
      assigned: [],
      watching: [],
      source: '',
      start_date: null,
      target_date: null,
      sprint_id: 1,
      release_id: null,
      created: '2026-10-01T00:00:00Z',
      updated: '2026-10-01T00:00:00Z'
    }

    render(
      <MemoryRouter>
        <SprintDetailModal
          sprint={sprint}
          releases={[]}
          workItems={[sprintItem]}
          onClose={vi.fn()}
          onSelectWorkItem={vi.fn()}
        />
      </MemoryRouter>
    )

    const plusBtn = screen.getByTestId('track-sprint-item-button-DAV-10')
    expect(plusBtn).toBeInTheDocument()
    fireEvent.click(plusBtn)
    expect(toggleTrackItem).toHaveBeenCalledWith(sprintItem, 'work-item')
  })

  it('renders Plus button on release assigned work items in ReleaseDetailModal', () => {
    const release: Release = {
      id: 2,
      project_key: 'DAV',
      name: 'v1.0.0',
      description: 'First release',
      start_date: null,
      end_date: null,
      created_at: '2026-10-01T00:00:00Z'
    }
    const releaseItem: WorkItem = {
      id: 20,
      key: 'DAV-20',
      title: 'Release work item',
      status: 'review',
      priority: 'HIGH',
      project_key: 'DAV',
      active_assignee: null,
      created_by: 'admin',
      updated_by: null,
      assigned: [],
      watching: [],
      source: '',
      start_date: null,
      target_date: null,
      sprint_id: null,
      release_id: 2,
      created: '2026-10-01T00:00:00Z',
      updated: '2026-10-01T00:00:00Z'
    }

    render(
      <MemoryRouter>
        <ReleaseDetailModal
          release={release}
          sprints={[]}
          workItems={[releaseItem]}
          onClose={vi.fn()}
          onSelectWorkItem={vi.fn()}
          onSelectSprint={vi.fn()}
        />
      </MemoryRouter>
    )

    const plusBtn = screen.getByTestId('track-release-item-button-DAV-20')
    expect(plusBtn).toBeInTheDocument()
    fireEvent.click(plusBtn)
    expect(toggleTrackItem).toHaveBeenCalledWith(releaseItem, 'work-item')
  })

  it('renders Plus button on the LEFT of "Mark work item as Done" in WorkItemDetailModal', () => {
    const sampleItem: WorkItem = {
      id: 50,
      key: 'DAV-50',
      title: 'Auth fix',
      status: 'in progress',
      priority: 'HIGH',
      project_key: 'DAV',
      active_assignee: null,
      created_by: 'admin',
      updated_by: null,
      assigned: [],
      watching: [],
      source: '',
      start_date: null,
      target_date: null,
      sprint_id: null,
      release_id: null,
      created: '2026-10-01T00:00:00Z',
      updated: '2026-10-01T00:00:00Z',
      progress: []
    }

    render(
      <MemoryRouter>
        <WorkItemDetailModal
          item={sampleItem}
          itemKey="DAV-50"
          projectKey="DAV"
          sprints={[]}
          releases={[]}
          statuses={[]}
          onClose={vi.fn()}
          onSelectWorkItem={vi.fn()}
          onAddProgress={vi.fn()}
        />
      </MemoryRouter>
    )

    const trackBtn = screen.getByTestId('track-detail-button')
    const markDoneBtn = screen.getByTestId('mark-done-button')
    expect(trackBtn).toBeInTheDocument()
    expect(markDoneBtn).toBeInTheDocument()

    // Verify ordering: trackBtn is physically before markDoneBtn
    expect(trackBtn.compareDocumentPosition(markDoneBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(trackBtn)
    expect(toggleTrackItem).toHaveBeenCalledWith(sampleItem, 'work-item')
  })

  it('renders Plus button on the LEFT of "Mark incident as Done" in IncidentDetailModal', () => {
    const sampleIncident: Incident = {
      id: 99,
      key: 'INC-99',
      project_key: 'DAV',
      title: 'Network outage',
      cause: 'Switch failure',
      investigation_note: 'Replaced switch',
      status: 'ongoing',
      work_items: [],
      work_item_keys: [],
      monitoring_log_ids: [],
      monitoring_log_keys: [],
      monitoring_logs: [],
      created_by: 'admin',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z'
    }

    render(
      <MemoryRouter>
        <IncidentDetailModal
          incident={sampleIncident}
          onClose={vi.fn()}
          onUpdateIncident={vi.fn()}
        />
      </MemoryRouter>
    )

    const trackBtn = screen.getByTestId('track-incident-detail-button')
    const markDoneBtn = screen.getByTestId('mark-incident-done-button')
    expect(trackBtn).toBeInTheDocument()
    expect(markDoneBtn).toBeInTheDocument()

    // Verify ordering: trackBtn is physically before markDoneBtn
    expect(trackBtn.compareDocumentPosition(markDoneBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(trackBtn)
    expect(toggleTrackItem).toHaveBeenCalledWith(sampleIncident, 'incident')
  })
})
