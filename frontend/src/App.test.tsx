import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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
          json: () => Promise.resolve({
            python: '3.14.5',
            django: '6.1.1',
            ninja: '1.7.1',
            database: 'sqlite3',
          }),
        } as Response)
      }

      if (urlStr.includes('/api/work-items/preview')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 1,
              key: 'DAV-1',
              parent_key: null,
              title: 'Build AI-Native Data Models',
              status: 'done',
              priority: 'HIGH',
              active_assignee: 'admin',
            },
          ]),
        } as Response)
      }

      if (urlStr.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
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
          json: () => Promise.resolve([
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

  it('renders the header brand title "Davai"', async () => {
    await renderApp()
    expect(screen.getByText('Davai')).toBeInTheDocument()
    expect(screen.getByText('Tracker')).toBeInTheDocument()
  })

  it('renders the GraphQL IDE link with correct href and target="_blank"', async () => {
    await renderApp()
    const graphqlLink = screen.getByTestId('graphql-link')
    expect(graphqlLink).toBeInTheDocument()
    expect(graphqlLink).toHaveTextContent('GraphQL IDE')
    expect(graphqlLink).toHaveAttribute('target', '_blank')
    expect(graphqlLink).toHaveAttribute('rel', 'noreferrer')
    expect(graphqlLink.getAttribute('href')).toMatch(/^\/graphql\/\?api_key=dav_live_/)
  })

  it('renders the Swagger API link with target="_blank"', async () => {
    await renderApp()
    const swaggerLink = screen.getByTestId('swagger-link')
    expect(swaggerLink).toBeInTheDocument()
    expect(swaggerLink).toHaveTextContent('Swagger API')
    expect(swaggerLink).toHaveAttribute('href', '/api/docs')
    expect(swaggerLink).toHaveAttribute('target', '_blank')
  })

  it('switches tabs between Work Board and Settings & API Keys', async () => {
    await renderApp()

    // Initially in Work Board view
    expect(screen.getByText('Work Item Board')).toBeInTheDocument()

    // Click "Settings & API Keys" tab
    const settingsTab = screen.getByRole('button', { name: /Settings & API Keys/i })
    await act(async () => {
      fireEvent.click(settingsTab)
    })

    // Settings view should now be displayed
    await waitFor(() => {
      expect(screen.getByText('User Profile & API Keys')).toBeInTheDocument()
    })
    expect(screen.getByText('Identity Profile')).toBeInTheDocument()
    expect(screen.getByText('Active Browser API Key')).toBeInTheDocument()
    expect(screen.getByText('Active API Keys')).toBeInTheDocument()

    // Switch back to Work Board
    const boardTab = screen.getByRole('button', { name: /Work Board/i })
    await act(async () => {
      fireEvent.click(boardTab)
    })

    await waitFor(() => {
      expect(screen.getByText('Work Item Board')).toBeInTheDocument()
    })
  })
})
