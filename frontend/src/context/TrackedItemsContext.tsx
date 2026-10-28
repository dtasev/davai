import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { TrackedItem, TrackedItemType, TrackedSection } from '../types'
import { apiFetch } from '../utils/apiFetch'
import { useApp } from './AppContext'

/**
 * Identifies a trackable item.
 * - work_item / user_support / incident → identified by `key` (e.g. "DAV-83")
 * - sprint / release → identified by numeric `id` (the backend's `ref_id` contract)
 */
export interface TrackedItemIdent {
  key?: string
  id?: number
}

interface TrackedItemsContextType {
  trackedItems: TrackedItem[]
  loadingTracked: boolean
  isTracked: (itemType: TrackedItemType, ident: TrackedItemIdent) => boolean
  addTrack: (itemType: TrackedItemType, ident: TrackedItemIdent) => Promise<void>
  removeTrack: (id: number) => Promise<void>
  clearDone: (section: TrackedSection) => Promise<void>
  refreshTracked: () => Promise<void>
}

const TrackedItemsContext = createContext<TrackedItemsContextType | null>(null)

const KEY_IDENT_TYPES: readonly TrackedItemType[] = ['work_item', 'user_support', 'incident']

export function TrackedItemsProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useApp()
  const [trackedItems, setTrackedItems] = useState<TrackedItem[]>([])
  const [loadingTracked, setLoadingTracked] = useState<boolean>(false)

  const userId = userProfile?.id ?? null

  // Guards against in-flight fetches resolving after a logout / user switch.
  const userIdRef = useRef<number | null>(userId)
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const refreshTracked = useCallback(async () => {
    const requestedFor = userIdRef.current
    if (requestedFor === null) {
      return
    }
    setLoadingTracked(true)
    try {
      const res = await apiFetch('/api/tracked-items', {
        credentials: 'same-origin'
      })
      if (res && res.ok) {
        const data = await res.json()
        if (userIdRef.current === requestedFor) {
          setTrackedItems(Array.isArray(data) ? data : [])
        }
      }
    } catch {
      // Swallow network errors: the tracking drawer is a convenience layer.
    } finally {
      if (userIdRef.current === requestedFor) {
        setLoadingTracked(false)
      }
    }
  }, [])

  // Fetch on mount and whenever the logged-in user changes; logout (userProfile
  // → null) clears the in-memory list and skips fetching entirely.
  useEffect(() => {
    if (userId === null) {
      setTrackedItems([])
      setLoadingTracked(false)
      return
    }
    refreshTracked()
  }, [userId, refreshTracked])

  const isTracked = useCallback(
    (itemType: TrackedItemType, ident: TrackedItemIdent): boolean => {
      return trackedItems.some(row => {
        if (row.item_type !== itemType) {
          return false
        }
        if (KEY_IDENT_TYPES.includes(itemType)) {
          return ident.key !== undefined && row.key === ident.key
        }
        return ident.id !== undefined && row.ref_id === ident.id
      })
    },
    [trackedItems]
  )

  const addTrack = useCallback(
    async (itemType: TrackedItemType, ident: TrackedItemIdent): Promise<void> => {
      const requestedFor = userIdRef.current
      if (requestedFor === null) {
        return
      }
      try {
        const body: Record<string, unknown> = { item_type: itemType }
        if (KEY_IDENT_TYPES.includes(itemType)) {
          if (!ident.key) {
            return
          }
          body.key = ident.key
        } else {
          if (ident.id === undefined) {
            return
          }
          body.id = ident.id
        }
        const res = await apiFetch('/api/tracked-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body)
        })
        if (res && res.ok) {
          const row: TrackedItem = await res.json()
          if (userIdRef.current === requestedFor) {
            // Optimistically append (dedupe: backend get_or_create may echo an existing row).
            setTrackedItems(prev =>
              prev.some(t => t.id === row.id) ? prev : [...prev, row]
            )
          }
        }
      } catch {
        // Swallow network errors.
      }
    },
    []
  )

  const removeTrack = useCallback(
    async (id: number): Promise<void> => {
      if (userIdRef.current === null) {
        return
      }
      // Optimistic local removal, then reconcile with the server.
      setTrackedItems(prev => prev.filter(t => t.id !== id))
      try {
        await apiFetch(`/api/tracked-items/${id}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        })
      } catch {
        // Swallow network errors.
      }
      await refreshTracked()
    },
    [refreshTracked]
  )

  const clearDone = useCallback(
    async (section: TrackedSection): Promise<void> => {
      if (userIdRef.current === null) {
        return
      }
      try {
        await apiFetch(`/api/tracked-items/done?section=${section}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        })
      } catch {
        // Swallow network errors.
      }
      await refreshTracked()
    },
    [refreshTracked]
  )

  return (
    <TrackedItemsContext.Provider
      value={{
        trackedItems,
        loadingTracked,
        isTracked,
        addTrack,
        removeTrack,
        clearDone,
        refreshTracked
      }}
    >
      {children}
    </TrackedItemsContext.Provider>
  )
}

export function useTrackedItems() {
  const context = useContext(TrackedItemsContext)
  if (!context) {
    throw new Error('useTrackedItems must be used within a TrackedItemsProvider')
  }
  return context
}
