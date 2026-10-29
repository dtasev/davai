import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectJumpModal } from './ProjectJumpModal'
import { Project } from '../types'

describe('ProjectJumpModal', () => {
  const davProject: Project = {
    id: 1,
    key: 'DAV',
    name: 'Davai Tracker',
    description: 'Internal tracker',
    item_count: 3,
    statuses: []
  }

  const cemsProject: Project = {
    id: 2,
    key: 'CEMS',
    name: 'CEMS Operations',
    description: 'Operations project',
    item_count: 0,
    statuses: []
  }

  const sampleProjects: Project[] = [davProject, cemsProject]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    render(
      <ProjectJumpModal
        isOpen={false}
        onClose={vi.fn()}
        projects={sampleProjects}
        onSelectProject={vi.fn()}
      />
    )
    expect(screen.queryByTestId('project-jump-modal')).not.toBeInTheDocument()
  })

  it('renders every supplied project with its key and name when open', () => {
    render(
      <ProjectJumpModal
        isOpen={true}
        onClose={vi.fn()}
        projects={sampleProjects}
        onSelectProject={vi.fn()}
      />
    )

    expect(screen.getByTestId('project-jump-modal')).toBeInTheDocument()

    const davRow = screen.getByTestId('project-jump-item-DAV')
    expect(davRow).toHaveTextContent('DAV')
    expect(davRow).toHaveTextContent('Davai Tracker')
    expect(davRow).toHaveTextContent('3 items')

    const cemsRow = screen.getByTestId('project-jump-item-CEMS')
    expect(cemsRow).toHaveTextContent('CEMS')
    expect(cemsRow).toHaveTextContent('CEMS Operations')
    expect(cemsRow).toHaveTextContent('0 items')

    expect(screen.getAllByTestId(/^project-jump-item-/)).toHaveLength(2)
  })

  it('filters by project key, case-insensitively', () => {
    render(
      <ProjectJumpModal
        isOpen={true}
        onClose={vi.fn()}
        projects={sampleProjects}
        onSelectProject={vi.fn()}
      />
    )

    fireEvent.change(screen.getByTestId('project-jump-input'), {
      target: { value: 'cems' }
    })

    expect(screen.getAllByTestId(/^project-jump-item-/)).toHaveLength(1)
    expect(screen.getByTestId('project-jump-item-CEMS')).toBeInTheDocument()
    expect(screen.queryByTestId('project-jump-item-DAV')).not.toBeInTheDocument()
  })

  it('filters by project name substring', () => {
    render(
      <ProjectJumpModal
        isOpen={true}
        onClose={vi.fn()}
        projects={sampleProjects}
        onSelectProject={vi.fn()}
      />
    )

    fireEvent.change(screen.getByTestId('project-jump-input'), {
      target: { value: 'oper' }
    })

    expect(screen.getAllByTestId(/^project-jump-item-/)).toHaveLength(1)
    expect(screen.getByTestId('project-jump-item-CEMS')).toBeInTheDocument()
    expect(screen.queryByTestId('project-jump-item-DAV')).not.toBeInTheDocument()
  })

  it('selects the second project with ArrowDown then Enter', () => {
    const handleSelect = vi.fn()
    const handleClose = vi.fn()

    render(
      <ProjectJumpModal
        isOpen={true}
        onClose={handleClose}
        projects={sampleProjects}
        onSelectProject={handleSelect}
      />
    )

    const input = screen.getByTestId('project-jump-input')
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'CEMS', name: 'CEMS Operations' })
    )
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('selects a project by clicking its row', () => {
    const handleSelect = vi.fn()
    const handleClose = vi.fn()

    render(
      <ProjectJumpModal
        isOpen={true}
        onClose={handleClose}
        projects={sampleProjects}
        onSelectProject={handleSelect}
      />
    )

    fireEvent.click(screen.getByTestId('project-jump-item-DAV'))

    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'DAV', name: 'Davai Tracker' })
    )
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape pressed on window', () => {
    const handleClose = vi.fn()

    render(
      <ProjectJumpModal
        isOpen={true}
        onClose={handleClose}
        projects={sampleProjects}
        onSelectProject={vi.fn()}
      />
    )

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('shows "No projects available yet." when there are no projects', () => {
    render(
      <ProjectJumpModal
        isOpen={true}
        onClose={vi.fn()}
        projects={[]}
        onSelectProject={vi.fn()}
      />
    )

    const empty = screen.getByTestId('project-jump-empty')
    expect(empty).toHaveTextContent('No projects available yet.')
    expect(screen.queryAllByTestId(/^project-jump-item-/)).toHaveLength(0)
  })

  it('shows the "No projects match" state for a non-matching query', () => {
    render(
      <ProjectJumpModal
        isOpen={true}
        onClose={vi.fn()}
        projects={sampleProjects}
        onSelectProject={vi.fn()}
      />
    )

    fireEvent.change(screen.getByTestId('project-jump-input'), {
      target: { value: 'zzz' }
    })

    const empty = screen.getByTestId('project-jump-empty')
    expect(empty).toHaveTextContent(/No projects match/)
    expect(empty).toHaveTextContent('"zzz"')
    expect(screen.queryAllByTestId(/^project-jump-item-/)).toHaveLength(0)
  })

  it('re-clamps the selection after filtering narrows the list', () => {
    const handleSelect = vi.fn()
    const handleClose = vi.fn()

    render(
      <ProjectJumpModal
        isOpen={true}
        onClose={handleClose}
        projects={sampleProjects}
        onSelectProject={handleSelect}
        currentProjectKey="DAV"
      />
    )

    const input = screen.getByTestId('project-jump-input')

    // Move the highlight to the second row, which no longer exists after filtering.
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
    fireEvent.change(input, { target: { value: 'dav' } })

    expect(screen.getAllByTestId(/^project-jump-item-/)).toHaveLength(1)

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'DAV' })
    )
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
