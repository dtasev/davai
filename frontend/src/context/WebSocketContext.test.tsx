import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useEffect } from 'react'
import { WebSocketProvider, useWebSocket } from './WebSocketContext'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  url: string
  readyState: number = 0 // CONNECTING
  onopen: (() => void) | null = null
  onclose: ((event?: any) => void) | null = null
  onmessage: ((event: any) => void) | null = null
  onerror: ((err: any) => void) | null = null
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = 1 // OPEN
      if (this.onopen) this.onopen()
    }, 10)
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = 3 // CLOSED
    if (this.onclose) this.onclose()
  }

  simulateClose(code: number) {
    this.readyState = 3 // CLOSED
    if (this.onclose) this.onclose({ code })
  }

  simulateServerMessage(msg: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(msg) })
    }
  }
}

describe('WebSocketContext', () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    MockWebSocket.instances = []
    // @ts-ignore
    globalThis.WebSocket = MockWebSocket
    sessionStorage.clear()
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
  })

  it('connects and exposes status and subscribe methods', async () => {
    let wsContext: any = null

    function TestConsumer() {
      const ctx = useWebSocket()
      wsContext = ctx
      return <div>Status: {ctx.status}</div>
    }

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    )

    expect(screen.getByText(/Status: connecting/i)).toBeInTheDocument()

    // Wait for mock connection to open
    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
    })

    expect(screen.getByText(/Status: connected/i)).toBeInTheDocument()
    expect(wsContext.clientId).toBeTruthy()

    // Test subscribe
    act(() => {
      wsContext.subscribe('project:TEST')
    })

    const wsInstance = MockWebSocket.instances[0]
    expect(wsInstance.sentMessages).toContain(JSON.stringify({ action: 'subscribe', topic: 'project:TEST' }))

    // Test unsubscribe
    act(() => {
      wsContext.unsubscribe('project:TEST')
    })
    expect(wsInstance.sentMessages).toContain(JSON.stringify({ action: 'unsubscribe', topic: 'project:TEST' }))
  })

  it('stops reconnecting and reports unauthorized when the server rejects the socket', async () => {
    function TestConsumer() {
      const ctx = useWebSocket()
      return <div>Status: {ctx.status}</div>
    }

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    )

    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
    })
    expect(screen.getByText(/Status: connected/i)).toBeInTheDocument()

    const wsInstance = MockWebSocket.instances[0]
    act(() => {
      wsInstance.simulateClose(1008)
    })
    expect(screen.getByText(/Status: unauthorized/i)).toBeInTheDocument()

    // Backoff would fire within ~1.5s; a rejected socket must not create a new connection.
    await act(async () => {
      await new Promise(r => setTimeout(r, 1800))
    })
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('ignores visibility changes after an unauthorized close', async () => {
    function TestConsumer() {
      const ctx = useWebSocket()
      return <div>Status: {ctx.status}</div>
    }

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    )

    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
    })

    act(() => {
      MockWebSocket.instances[0].simulateClose(1008)
    })
    expect(screen.getByText(/Status: unauthorized/i)).toBeInTheDocument()

    // Coming back to the tab must not revive the loop.
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise(r => setTimeout(r, 300))
    })

    expect(MockWebSocket.instances).toHaveLength(1)
    expect(screen.getByText(/Status: unauthorized/i)).toBeInTheDocument()
  })

  it('treats the authentication_required frame as unauthorized and stops heartbeating', async () => {
    let wsContext: any = null

    function TestConsumer() {
      const ctx = useWebSocket()
      wsContext = ctx
      return <div>Status: {ctx.status}</div>
    }

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    )

    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
    })

    const wsInstance = MockWebSocket.instances[0]
    act(() => {
      wsInstance.simulateServerMessage({ event: 'error', code: 'authentication_required' })
    })

    expect(screen.getByText(/Status: unauthorized/i)).toBeInTheDocument()
    // The client closes itself so the 30s ping interval stops.
    expect(wsInstance.readyState).toBe(3)

    await act(async () => {
      await new Promise(r => setTimeout(r, 1800))
    })
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(wsContext.status).toBe('unauthorized')
  })

  it('dispatches incoming events to registered listeners and suppresses echoes', async () => {
    let wsContext: any = null
    const handler = vi.fn()

    function TestConsumer() {
      const ctx = useWebSocket()
      wsContext = ctx

      useEffect(() => {
        const cleanup = ctx.on('work_item.created', handler)
        return cleanup
      }, [ctx])

      return <div>Test Component</div>
    }

    render(
      <WebSocketProvider>
        <TestConsumer />
      </WebSocketProvider>
    )

    await act(async () => {
      await new Promise(r => setTimeout(r, 20))
    })

    const wsInstance = MockWebSocket.instances[0]

    // Simulate incoming event from another client
    act(() => {
      wsInstance.simulateServerMessage({
        event: 'work_item.created',
        project_key: 'TEST',
        key: 'TEST-1',
        origin_client_id: 'other-client-id'
      })
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      event: 'work_item.created',
      key: 'TEST-1'
    }))

    // Simulate echo event with our own clientId
    act(() => {
      wsInstance.simulateServerMessage({
        event: 'work_item.created',
        project_key: 'TEST',
        key: 'TEST-2',
        origin_client_id: wsContext.clientId
      })
    })

    // Handler should NOT be called for the echo!
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
