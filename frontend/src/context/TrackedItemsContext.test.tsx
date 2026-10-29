import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { TrackedItemsProvider, useTrackedItems } from './TrackedItemsContext'
import type { TrackedItem, TrackedItemType } from '../types'

/**
 * DAV-89: the tracking drawer receives `tracked_item.updated` on the user's own
 * topic (no project subscription), so row matching must be keyed on item_type as
 * well as key, and partial events must never blank the row's title/project.
 *
 * The WebSocket context is mocked so the registered handlers can be invoked
 * directly; the tracked rows are seeded through the provider's own
 * `/api/tracked-items` fetch (same fetch-mocking style as App.test.tsx).
 */

type Handler = (event: any) => void

const { handlers, wsMock } = vi.hoisted(() => {
  const handlers = new Map<string, Handler>()
  const wsMock = {
    status: 'connected',
    clientId: 'test-client',
    subscribe: () => {},
    unsubscribe: () => {},
    on: (eventType: string, handler: (event: any) => void) => {
      handlers.set(eventType, handler)
      return () => {
        handlers.delete(eventType)
      }
    }
  }
  return { handlers, wsMock }
})

vi.mock('./WebSocketContext', () => ({
  useOptionalWebSocket: () => wsMock
}))

vi.mock('./AppContext', () => ({
  useApp: () => ({ userProfile: { id: 1, username: 'tester' } })
}))

function makeRow(
  id: number,
  itemType: TrackedItemType,
  key: string,
  overrides: Partial<TrackedItem> = {}
): TrackedItem {
  return {
    id,
    item_type: itemType,
    ref_id: id,
    key,
    title: `Title ${id}`,
    status: 'todo',
    project_key: 'DAV',
    added_at: '2026-10-01T00:00:00Z',
    ...overrides
  }
}

function Probe() {
  const { trackedItems, loadingTracked } = useTrackedItems()
  return (
    <div>
      <div data-testid="loading">{loadingTracked ? 'loading' : 'idle'}</div>
      {trackedItems.map(item => (
        <div key={item.id} data-testid={`row-${item.id}`}>
          <span data-testid={`row-${item.id}-type`}>{item.item_type}</span>
          <span data-testid={`row-${item.id}-status`}>{item.status}</span>
          <span data-testid={`row-${item.id}-title`}>{item.title}</span>
          <span data-testid={`row-${item.id}-project`}>{item.project_key}</span>
        </div>
      ))}
    </div>
  )
}

async function renderWithRows(rows: TrackedItem[]) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => rows
  })) as unknown as typeof fetch

  render(
    <TrackedItemsProvider>
      <Probe />
    </TrackedItemsProvider>
  )

  await waitFor(() => {
    expect(screen.getByTestId(`row-${rows[0].id}`)).toBeInTheDocument()
  })
}

function emit(eventType: string, payload: Record<string, any>) {
  const handler = handlers.get(eventType)
  expect(handler, `no handler registered for ${eventType}`).toBeTruthy()
  act(() => {
    handler!({ event: eventType, ...payload })
  })
}

function text(testId: string): string {
  return screen.getByTestId(testId).textContent ?? ''
}

describe('TrackedItemsContext websocket sync (DAV-89)', () => {
  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('applies work_item.updated to a work_item row but not to a user_support row with the same key', async () => {
    // Synthetic key collision: the type guard, not the key, must discriminate.
    await renderWithRows([
      makeRow(1, 'work_item', 'dav-1', { title: 'Original Title', status: 'todo' }),
      makeRow(2, 'user_support', 'DAV-1', { title: 'Support View', status: 'todo' })
    ])

    // Key matching stays case-insensitive; title and status both come from `changes`.
    emit('work_item.updated', {
      key: 'DAV-1',
      changes: { status: 'done', title: 'Renamed Title' }
    })

    expect(text('row-1-type')).toBe('work_item')
    expect(text('row-1-status')).toBe('done')
    expect(text('row-1-title')).toBe('Renamed Title')

    expect(text('row-2-type')).toBe('user_support')
    expect(text('row-2-status')).toBe('todo')
    expect(text('row-2-title')).toBe('Support View')
  })

  it('does not cross-update rows of a different item_type with the same numeric key', async () => {
    await renderWithRows([
      makeRow(3, 'sprint', '7', { title: 'Sprint Seven', status: 'planned' }),
      makeRow(4, 'release', '7', { title: 'Release Seven', status: 'planned' })
    ])

    emit('tracked_item.updated', {
      item_type: 'sprint',
      key: '7',
      status: 'done',
      title: 'Sprint Seven Renamed',
      project_key: 'DAV'
    })

    expect(text('row-3-status')).toBe('done')
    expect(text('row-3-title')).toBe('Sprint Seven Renamed')

    // Same key, different item_type: untouched.
    expect(text('row-4-status')).toBe('planned')
    expect(text('row-4-title')).toBe('Release Seven')
  })

  it('keeps title and project_key when a tracked_item.updated event only carries status', async () => {
    await renderWithRows([
      makeRow(5, 'work_item', 'DAV-5', {
        title: 'Keep Me Intact',
        status: 'todo',
        project_key: 'DAV'
      })
    ])

    emit('tracked_item.updated', {
      item_type: 'work_item',
      key: 'DAV-5',
      status: 'done'
    })

    expect(text('row-5-status')).toBe('done')
    expect(text('row-5-title')).toBe('Keep Me Intact')
    expect(text('row-5-project')).toBe('DAV')
  })

  it('applies title, project_key and status from a fully populated tracked_item.updated', async () => {
    await renderWithRows([
      makeRow(6, 'incident', 'DAV-INC-6', {
        title: 'Old Incident Title',
        status: 'reported',
        project_key: 'DAV'
      })
    ])

    emit('tracked_item.updated', {
      item_type: 'incident',
      key: 'DAV-INC-6',
      status: 'ongoing',
      title: 'New Incident Title',
      project_key: 'OTHER'
    })

    expect(text('row-6-status')).toBe('ongoing')
    expect(text('row-6-title')).toBe('New Incident Title')
    expect(text('row-6-project')).toBe('OTHER')
  })
})
