import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { WorkItemList, formatDate, formatItemDates } from './WorkItemList'
import { WorkItem, ProjectStatus } from '../../types'

const mockStatuses: ProjectStatus[] = [
  { id: 1, name: 'todo', order: 0, is_default: true },
  { id: 2, name: 'in progress', order: 1, is_default: false },
  { id: 3, name: 'done', order: 2, is_default: false }
]

const baseWorkItem: Omit<WorkItem, 'id' | 'key' | 'title' | 'status' | 'created'> = {
  parent_key: null,
  description: '',
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
  sprint_id: null,
  release_id: null,
  updated: '2026-09-20T00:00:00Z',
  context: null,
  progress: []
}

describe('WorkItemList - Sorting and Multi-Select Status Filter', () => {
  it('sorts work items by newest first (created date descending)', () => {
    const items: WorkItem[] = [
      {
        ...baseWorkItem,
        id: 1,
        key: 'DAV-1',
        title: 'Oldest Task',
        status: 'todo',
        created: '2026-09-01T10:00:00Z'
      },
      {
        ...baseWorkItem,
        id: 2,
        key: 'DAV-2',
        title: 'Newest Task',
        status: 'todo',
        created: '2026-09-20T10:00:00Z'
      },
      {
        ...baseWorkItem,
        id: 3,
        key: 'DAV-3',
        title: 'Middle Task',
        status: 'todo',
        created: '2026-09-10T10:00:00Z'
      }
    ]

    render(
      <WorkItemList
        workItems={items}
        sprints={[]}
        releases={[]}
        statuses={mockStatuses}
        onSelectWorkItem={vi.fn()}
        onCreateWorkItem={vi.fn()}
      />
    )

    const renderedItems = screen.getAllByTestId(/^work-item-DAV-/)
    expect(renderedItems).toHaveLength(3)
    // Newest first: DAV-2, then DAV-3, then DAV-1
    expect(renderedItems[0]).toHaveAttribute('data-testid', 'work-item-DAV-2')
    expect(renderedItems[1]).toHaveAttribute('data-testid', 'work-item-DAV-3')
    expect(renderedItems[2]).toHaveAttribute('data-testid', 'work-item-DAV-1')
  })

  it('hides DONE items by default and shows "Statuses (Done hidden)" on dropdown button', () => {
    const items: WorkItem[] = [
      {
        ...baseWorkItem,
        id: 1,
        key: 'DAV-1',
        title: 'Todo Task',
        status: 'todo',
        created: '2026-09-15T10:00:00Z'
      },
      {
        ...baseWorkItem,
        id: 2,
        key: 'DAV-2',
        title: 'In Progress Task',
        status: 'in progress',
        created: '2026-09-16T10:00:00Z'
      },
      {
        ...baseWorkItem,
        id: 3,
        key: 'DAV-3',
        title: 'Done Task',
        status: 'done',
        created: '2026-09-17T10:00:00Z'
      }
    ]

    render(
      <WorkItemList
        workItems={items}
        sprints={[]}
        releases={[]}
        statuses={mockStatuses}
        onSelectWorkItem={vi.fn()}
        onCreateWorkItem={vi.fn()}
      />
    )

    // Button indicates Done is hidden
    const dropdownBtn = screen.getByTestId('status-filter-dropdown-button')
    expect(dropdownBtn).toHaveTextContent('Statuses (Done hidden)')

    // Todo and In Progress are displayed
    expect(screen.getByTestId('work-item-DAV-1')).toBeInTheDocument()
    expect(screen.getByTestId('work-item-DAV-2')).toBeInTheDocument()

    // Done is hidden by default
    expect(screen.queryByTestId('work-item-DAV-3')).not.toBeInTheDocument()
  })

  it('allows multi-select toggling of statuses in the dropdown menu', async () => {
    const items: WorkItem[] = [
      {
        ...baseWorkItem,
        id: 1,
        key: 'DAV-1',
        title: 'Todo Task',
        status: 'todo',
        created: '2026-09-15T10:00:00Z'
      },
      {
        ...baseWorkItem,
        id: 2,
        key: 'DAV-2',
        title: 'Done Task',
        status: 'done',
        created: '2026-09-16T10:00:00Z'
      }
    ]

    render(
      <WorkItemList
        workItems={items}
        sprints={[]}
        releases={[]}
        statuses={mockStatuses}
        onSelectWorkItem={vi.fn()}
        onCreateWorkItem={vi.fn()}
      />
    )

    const dropdownBtn = screen.getByTestId('status-filter-dropdown-button')
    await act(async () => {
      fireEvent.click(dropdownBtn)
    })

    // Menu is opened
    expect(screen.getByTestId('status-filter-dropdown-menu')).toBeInTheDocument()

    // Check Done to show done tasks
    const doneOption = screen.getByTestId('status-option-done')
    await act(async () => {
      fireEvent.click(doneOption)
    })

    // Now Done task is visible too
    expect(screen.getByTestId('work-item-DAV-2')).toBeInTheDocument()
    expect(screen.getByTestId('work-item-DAV-1')).toBeInTheDocument()

    // Uncheck Todo
    const todoOption = screen.getByTestId('status-option-todo')
    await act(async () => {
      fireEvent.click(todoOption)
    })

    // Todo task is now hidden
    expect(screen.queryByTestId('work-item-DAV-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('work-item-DAV-2')).toBeInTheDocument()
  })

  it('selects only that status when clicking the "only" button on an entry', async () => {
    const items: WorkItem[] = [
      {
        ...baseWorkItem,
        id: 1,
        key: 'DAV-1',
        title: 'Todo Task',
        status: 'todo',
        created: '2026-09-15T10:00:00Z'
      },
      {
        ...baseWorkItem,
        id: 2,
        key: 'DAV-2',
        title: 'In Progress Task',
        status: 'in progress',
        created: '2026-09-16T10:00:00Z'
      },
      {
        ...baseWorkItem,
        id: 3,
        key: 'DAV-3',
        title: 'Done Task',
        status: 'done',
        created: '2026-09-17T10:00:00Z'
      }
    ]

    render(
      <WorkItemList
        workItems={items}
        sprints={[]}
        releases={[]}
        statuses={mockStatuses}
        onSelectWorkItem={vi.fn()}
        onCreateWorkItem={vi.fn()}
      />
    )

    // Open dropdown
    const dropdownBtn = screen.getByTestId('status-filter-dropdown-button')
    await act(async () => {
      fireEvent.click(dropdownBtn)
    })

    // Click "only" on "done"
    const doneOnlyBtn = screen.getByTestId('status-only-done')
    await act(async () => {
      fireEvent.click(doneOnlyBtn)
    })

    // Only Done task should be visible
    expect(screen.getByTestId('work-item-DAV-3')).toBeInTheDocument()
    expect(screen.queryByTestId('work-item-DAV-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('work-item-DAV-2')).not.toBeInTheDocument()
    expect(dropdownBtn).toHaveTextContent('Done')

    // Click "only" on "todo"
    const todoOnlyBtn = screen.getByTestId('status-only-todo')
    await act(async () => {
      fireEvent.click(todoOnlyBtn)
    })

    // Only Todo task should be visible
    expect(screen.getByTestId('work-item-DAV-1')).toBeInTheDocument()
    expect(screen.queryByTestId('work-item-DAV-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('work-item-DAV-3')).not.toBeInTheDocument()
    expect(dropdownBtn).toHaveTextContent('Todo')
  })

  it('supports header action buttons: All, Hide Done, and Clear', async () => {
    const items: WorkItem[] = [
      {
        ...baseWorkItem,
        id: 1,
        key: 'DAV-1',
        title: 'Todo Task',
        status: 'todo',
        created: '2026-09-15T10:00:00Z'
      },
      {
        ...baseWorkItem,
        id: 2,
        key: 'DAV-2',
        title: 'Done Task',
        status: 'done',
        created: '2026-09-16T10:00:00Z'
      }
    ]

    render(
      <WorkItemList
        workItems={items}
        sprints={[]}
        releases={[]}
        statuses={mockStatuses}
        onSelectWorkItem={vi.fn()}
        onCreateWorkItem={vi.fn()}
      />
    )

    const dropdownBtn = screen.getByTestId('status-filter-dropdown-button')
    await act(async () => {
      fireEvent.click(dropdownBtn)
    })

    // 1. Click "All"
    const selectAllBtn = screen.getByTestId('status-filter-select-all')
    await act(async () => {
      fireEvent.click(selectAllBtn)
    })
    expect(screen.getByTestId('work-item-DAV-1')).toBeInTheDocument()
    expect(screen.getByTestId('work-item-DAV-2')).toBeInTheDocument()
    expect(dropdownBtn).toHaveTextContent('All Statuses')

    // 2. Click "Hide Done"
    const hideDoneBtn = screen.getByTestId('status-filter-hide-done')
    await act(async () => {
      fireEvent.click(hideDoneBtn)
    })
    expect(screen.getByTestId('work-item-DAV-1')).toBeInTheDocument()
    expect(screen.queryByTestId('work-item-DAV-2')).not.toBeInTheDocument()
    expect(dropdownBtn).toHaveTextContent('Statuses (Done hidden)')

    // 3. Click "Clear"
    const clearBtn = screen.getByTestId('status-filter-clear')
    await act(async () => {
      fireEvent.click(clearBtn)
    })
    expect(screen.queryByTestId('work-item-DAV-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('work-item-DAV-2')).not.toBeInTheDocument()
    expect(dropdownBtn).toHaveTextContent('No Statuses')
    expect(screen.getByText('No work items match the search / filter criteria.')).toBeInTheDocument()
  })

  it('supports toggling semantic search mode and filtering by keyword', async () => {
    const items: WorkItem[] = [
      {
        ...baseWorkItem,
        id: 1,
        key: 'DAV-1',
        title: 'Kubernetes ingress networking',
        status: 'todo',
        created: '2026-09-01T10:00:00Z'
      },
      {
        ...baseWorkItem,
        id: 2,
        key: 'DAV-2',
        title: 'React dashboard button styling',
        status: 'todo',
        created: '2026-09-02T10:00:00Z'
      }
    ]

    render(
      <WorkItemList
        workItems={items}
        sprints={[]}
        releases={[]}
        statuses={mockStatuses}
        onSelectWorkItem={vi.fn()}
        onCreateWorkItem={vi.fn()}
      />
    )

    const toggleBtn = screen.getByTestId('search-mode-toggle')
    expect(toggleBtn).toHaveTextContent('Semantic')

    // Toggle to keyword
    await act(async () => {
      fireEvent.click(toggleBtn)
    })
    expect(toggleBtn).toHaveTextContent('Keyword')

    // Filter using keyword
    const searchInput = screen.getByPlaceholderText('Search items...')
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'ingress' } })
    })

    expect(screen.getByTestId('work-item-DAV-1')).toBeInTheDocument()
    expect(screen.queryByTestId('work-item-DAV-2')).not.toBeInTheDocument()
  })

  describe('WorkItemList - Date Display (start_date and target_date)', () => {
    it('formatItemDates formats combinations correctly', () => {
      const s = '2026-10-01'
      const t = '2026-10-15'
      const expectedStart = formatDate(s)
      const expectedTarget = formatDate(t)

      expect(formatItemDates(s, t)).toBe(`${expectedStart} -> ${expectedTarget}`)
      expect(formatItemDates(null, t)).toBe(expectedTarget)
      expect(formatItemDates('', t)).toBe(expectedTarget)
      expect(formatItemDates(s, null)).toBe(`${expectedStart} ->`)
      expect(formatItemDates(s, '')).toBe(`${expectedStart} ->`)
      expect(formatItemDates(null, null)).toBeNull()
      expect(formatItemDates(undefined, undefined)).toBeNull()
    })

    it('shows start date -> target date when both dates are set', () => {
      const items: WorkItem[] = [
        {
          ...baseWorkItem,
          id: 1,
          key: 'DAV-1',
          title: 'Scheduled Feature Task',
          status: 'todo',
          created: '2026-09-01T10:00:00Z',
          start_date: '2026-10-01',
          target_date: '2026-10-15'
        }
      ]

      render(
        <WorkItemList
          workItems={items}
          sprints={[]}
          releases={[]}
          statuses={mockStatuses}
          onSelectWorkItem={vi.fn()}
          onCreateWorkItem={vi.fn()}
        />
      )

      const dateBadge = screen.getByTestId('work-item-dates-DAV-1')
      expect(dateBadge).toBeInTheDocument()
      const expectedStart = formatDate('2026-10-01')
      const expectedTarget = formatDate('2026-10-15')
      expect(dateBadge).toHaveTextContent(`${expectedStart} -> ${expectedTarget}`)
    })

    it('shows just target date if only target date is set', () => {
      const items: WorkItem[] = [
        {
          ...baseWorkItem,
          id: 2,
          key: 'DAV-2',
          title: 'Deadline Task',
          status: 'todo',
          created: '2026-09-02T10:00:00Z',
          start_date: null,
          target_date: '2026-10-20'
        }
      ]

      render(
        <WorkItemList
          workItems={items}
          sprints={[]}
          releases={[]}
          statuses={mockStatuses}
          onSelectWorkItem={vi.fn()}
          onCreateWorkItem={vi.fn()}
        />
      )

      const dateBadge = screen.getByTestId('work-item-dates-DAV-2')
      expect(dateBadge).toBeInTheDocument()
      const expectedTarget = formatDate('2026-10-20')
      expect(dateBadge).toHaveTextContent(expectedTarget)
      expect(dateBadge).not.toHaveTextContent('->')
    })

    it('shows start date -> if only start date is set', () => {
      const items: WorkItem[] = [
        {
          ...baseWorkItem,
          id: 3,
          key: 'DAV-3',
          title: 'Started Task Without Target',
          status: 'todo',
          created: '2026-09-03T10:00:00Z',
          start_date: '2026-10-05',
          target_date: null
        }
      ]

      render(
        <WorkItemList
          workItems={items}
          sprints={[]}
          releases={[]}
          statuses={mockStatuses}
          onSelectWorkItem={vi.fn()}
          onCreateWorkItem={vi.fn()}
        />
      )

      const dateBadge = screen.getByTestId('work-item-dates-DAV-3')
      expect(dateBadge).toBeInTheDocument()
      const expectedStart = formatDate('2026-10-05')
      expect(dateBadge).toHaveTextContent(`${expectedStart} ->`)
    })

    it('does not show any date badge if neither start date nor target date is set', () => {
      const items: WorkItem[] = [
        {
          ...baseWorkItem,
          id: 4,
          key: 'DAV-4',
          title: 'Unscheduled Task',
          status: 'todo',
          created: '2026-09-04T10:00:00Z',
          start_date: null,
          target_date: null
        }
      ]

      render(
        <WorkItemList
          workItems={items}
          sprints={[]}
          releases={[]}
          statuses={mockStatuses}
          onSelectWorkItem={vi.fn()}
          onCreateWorkItem={vi.fn()}
        />
      )

      expect(screen.queryByTestId('work-item-dates-DAV-4')).not.toBeInTheDocument()
    })
  })
})


