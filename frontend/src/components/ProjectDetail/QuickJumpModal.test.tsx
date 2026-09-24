import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuickJumpModal } from './QuickJumpModal'
import { WorkItem } from '../../types'

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

describe('QuickJumpModal', () => {
  const sampleItems: WorkItem[] = [
    {
      ...baseWorkItem,
      id: 5,
      key: 'DAV-5',
      title: 'Setup Docker',
      status: 'done',
      created: '2026-09-01T10:00:00Z'
    },
    {
      ...baseWorkItem,
      id: 50,
      key: 'DAV-50',
      title: 'Refactor Auth Middleware',
      status: 'in progress',
      created: '2026-09-15T10:00:00Z'
    },
    {
      ...baseWorkItem,
      id: 150,
      key: 'DAV-150',
      title: 'Update 50 dependencies',
      status: 'todo',
      created: '2026-09-18T10:00:00Z'
    },
    {
      ...baseWorkItem,
      id: 500,
      key: 'DAV-500',
      title: 'Large Scale Benchmark',
      status: 'todo',
      created: '2026-09-20T10:00:00Z'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    render(
      <QuickJumpModal
        isOpen={false}
        onClose={vi.fn()}
        projectKey="DAV"
        workItems={sampleItems}
        onSelectWorkItem={vi.fn()}
      />
    )
    expect(screen.queryByTestId('quick-jump-modal')).not.toBeInTheDocument()
  })

  it('renders modal with keyword mode by default', () => {
    render(
      <QuickJumpModal
        isOpen={true}
        onClose={vi.fn()}
        projectKey="DAV"
        workItems={sampleItems}
        onSelectWorkItem={vi.fn()}
      />
    )
    expect(screen.getByTestId('quick-jump-modal')).toBeInTheDocument()
    const modeToggle = screen.getByTestId('quick-jump-mode-toggle')
    expect(modeToggle).toHaveTextContent(/Keyword/i)
  })

  it('ranks exact number match DAV-50 first when user types "50", and Enter selects it', () => {
    const handleSelect = vi.fn()
    const handleClose = vi.fn()

    render(
      <QuickJumpModal
        isOpen={true}
        onClose={handleClose}
        projectKey="DAV"
        workItems={sampleItems}
        onSelectWorkItem={handleSelect}
      />
    )

    const input = screen.getByTestId('quick-jump-input')
    fireEvent.change(input, { target: { value: '50' } })

    // Results container should contain DAV-50 at index 0
    const items = screen.getAllByTestId(/^quick-jump-item-/)
    expect(items[0]).toHaveAttribute('data-testid', 'quick-jump-item-DAV-50')

    // Press Enter to open first item
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'DAV-50' })
    )
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('supports arrow down and arrow up navigation before pressing Enter', () => {
    const handleSelect = vi.fn()
    const handleClose = vi.fn()

    render(
      <QuickJumpModal
        isOpen={true}
        onClose={handleClose}
        projectKey="DAV"
        workItems={sampleItems}
        onSelectWorkItem={handleSelect}
      />
    )

    const input = screen.getByTestId('quick-jump-input')
    fireEvent.change(input, { target: { value: '5' } })

    // Arrow down to move to second item
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(handleSelect).toHaveBeenCalledTimes(1)
    // The second item should have been selected
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape key press or close button click', () => {
    const handleClose = vi.fn()

    render(
      <QuickJumpModal
        isOpen={true}
        onClose={handleClose}
        projectKey="DAV"
        workItems={sampleItems}
        onSelectWorkItem={vi.fn()}
      />
    )

    const input = screen.getByTestId('quick-jump-input')
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)

    handleClose.mockClear()
    const closeBtn = screen.getByTestId('quick-jump-close')
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('allows clicking an item directly to select and close', () => {
    const handleSelect = vi.fn()
    const handleClose = vi.fn()

    render(
      <QuickJumpModal
        isOpen={true}
        onClose={handleClose}
        projectKey="DAV"
        workItems={sampleItems}
        onSelectWorkItem={handleSelect}
      />
    )

    const item50 = screen.getByTestId('quick-jump-item-DAV-50')
    fireEvent.click(item50)

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'DAV-50' })
    )
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('allows toggling between Keyword and Semantic search modes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'auth',
        mode: 'hybrid',
        total: 1,
        results: [
          {
            work_item: sampleItems[1],
            score: 0.95,
            vector_distance: 0.05,
            rank_vector: 1,
            rank_keyword: 1,
            match_type: 'hybrid',
            snippet: 'Refactor Auth Middleware snippet'
          }
        ]
      })
    } as Response)

    render(
      <QuickJumpModal
        isOpen={true}
        onClose={vi.fn()}
        projectKey="DAV"
        workItems={sampleItems}
        onSelectWorkItem={vi.fn()}
      />
    )

    const toggle = screen.getByTestId('quick-jump-mode-toggle')
    expect(toggle).toHaveTextContent(/Keyword/i)

    // Toggle to Semantic
    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent(/Semantic/i)

    const input = screen.getByTestId('quick-jump-input')
    fireEvent.change(input, { target: { value: 'auth' } })

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/DAV/search?q=auth&mode=hybrid'),
        expect.any(Object)
      )
    })
  })
})
