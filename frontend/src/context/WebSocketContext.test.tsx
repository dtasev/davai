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
  onclose: (() => void) | null = null
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
