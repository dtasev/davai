import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { getClientId } from '../utils/apiFetch'

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected'

export interface WebSocketEvent {
  event: string
  topic?: string
  project_key?: string
  key?: string
  origin_client_id?: string
  [key: string]: any
}

export type EventHandler = (event: WebSocketEvent) => void

interface WebSocketContextType {
  status: WebSocketStatus
  clientId: string
  subscribe: (topic: string) => void
  unsubscribe: (topic: string) => void
  on: (eventType: string, handler: EventHandler) => () => void
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const clientId = getClientId()

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<any>(null)
  const pingIntervalRef = useRef<any>(null)
  const reconnectAttemptsRef = useRef<number>(0)
  const isUnmountedRef = useRef<boolean>(false)

  // Track all currently desired topics so they survive reconnects
  const activeTopicsRef = useRef<Set<string>>(new Set())

  // Event handlers: eventType -> Set of handlers
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map())

  const dispatchEvent = useCallback((event: WebSocketEvent) => {
    // If the event has an origin_client_id matching our own, suppress it
    if (event.origin_client_id && event.origin_client_id === clientId) {
      return
    }

    const typeHandlers = handlersRef.current.get(event.event)
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        try {
          handler(event)
        } catch (err) {
          console.error(`Error in WebSocket handler for ${event.event}:`, err)
        }
      })
    }

    // Also dispatch to wildcard '*' handlers
    const wildcardHandlers = handlersRef.current.get('*')
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(event)
        } catch (err) {
          console.error('Error in WebSocket wildcard handler:', err)
        }
      })
    }
  }, [clientId])

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return
    }

    clearTimeout(reconnectTimeoutRef.current)
    clearInterval(pingIntervalRef.current)

    setStatus('connecting')

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/ws?client_id=${encodeURIComponent(clientId)}`

      const ws = new WebSocket(wsUrl)
      socketRef.current = ws

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close()
          return
        }
        setStatus('connected')
        reconnectAttemptsRef.current = 0

        // Re-subscribe to all active topics
        activeTopicsRef.current.forEach(topic => {
          ws.send(JSON.stringify({ action: 'subscribe', topic }))
        })

        // Heartbeat ping every 30s
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'ping' }))
          }
        }, 30000)
      }

      ws.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data)
          if (data && data.event) {
            dispatchEvent(data)
          }
        } catch {
          // Non-JSON or malformed frame
        }
      }

      ws.onclose = () => {
        clearInterval(pingIntervalRef.current)
        if (isUnmountedRef.current) return
        setStatus('disconnected')

        // Exponential backoff reconnect: min 1s, max 10s + jitter
        const attempts = reconnectAttemptsRef.current
        const delay = Math.min(1000 * Math.pow(1.5, attempts), 10000) + Math.random() * 500
        reconnectAttemptsRef.current = attempts + 1

        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, delay)
      }

      ws.onerror = () => {
        // ws.onclose will fire after onerror and trigger reconnect
      }
    } catch {
      setStatus('disconnected')
    }
  }, [clientId, dispatchEvent])

  useEffect(() => {
    isUnmountedRef.current = false
    connect()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
          connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isUnmountedRef.current = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(reconnectTimeoutRef.current)
      clearInterval(pingIntervalRef.current)
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [connect])

  const subscribe = useCallback((topic: string) => {
    const cleanTopic = topic.trim()
    if (!cleanTopic) return
    activeTopicsRef.current.add(cleanTopic)
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action: 'subscribe', topic: cleanTopic }))
    }
  }, [])

  const unsubscribe = useCallback((topic: string) => {
    const cleanTopic = topic.trim()
    if (!cleanTopic) return
    activeTopicsRef.current.delete(cleanTopic)
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action: 'unsubscribe', topic: cleanTopic }))
    }
  }, [])

  const on = useCallback((eventType: string, handler: EventHandler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set())
    }
    handlersRef.current.get(eventType)!.add(handler)

    return () => {
      const set = handlersRef.current.get(eventType)
      if (set) {
        set.delete(handler)
        if (set.size === 0) {
          handlersRef.current.delete(eventType)
        }
      }
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ status, clientId, subscribe, unsubscribe, on }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

export function useOptionalWebSocket() {
  return useContext(WebSocketContext)
}
