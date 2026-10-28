import { MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { TrackedItemType } from '../../types'
import { TrackedItemIdent, useTrackedItems } from '../../context/TrackedItemsContext'

// Types identified by `key` vs by numeric `id` (mirrors TrackedItemsContext).
const KEY_IDENT_TYPES: readonly TrackedItemType[] = ['work_item', 'user_support', 'incident']

/**
 * Access the tracked-items context without crashing when no provider is
 * present (e.g. isolated unit tests that render lists directly). The hook is
 * still called unconditionally on every render; the throw happens after
 * `useContext`, so hook ordering stays stable.
 */
function useOptionalTrackedItems() {
  try {
    return useTrackedItems()
  } catch {
    return null
  }
}

interface TrackButtonProps {
  itemType: TrackedItemType
  /** work_item / user_support / incident → ticket key, e.g. "DAV-83" */
  itemKey?: string
  /** sprint / release → numeric item id (backend ref_id contract) */
  itemId?: number
  size?: 'sm' | 'md'
}

/**
 * Shared track/untrack toggle for the per-user tracking drawer (DAV-83).
 * State comes from the shared TrackedItemsContext, so toggling in a list is
 * immediately reflected in detail modals and vice versa.
 */
export function TrackButton({ itemType, itemKey, itemId, size = 'sm' }: TrackButtonProps) {
  const ctx = useOptionalTrackedItems()

  if (itemKey === undefined && itemId === undefined) {
    return null
  }

  const ident: TrackedItemIdent = itemKey !== undefined ? { key: itemKey } : { id: itemId }
  const usesKey = KEY_IDENT_TYPES.includes(itemType)

  const trackedRow = ctx
    ? ctx.trackedItems.find(
        row =>
          row.item_type === itemType &&
          (usesKey ? itemKey !== undefined && row.key === itemKey : itemId !== undefined && row.ref_id === itemId)
      )
    : undefined

  const tracked = ctx ? ctx.isTracked(itemType, ident) : false

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Rows/cards navigate on click — never let the toggle bubble.
    e.stopPropagation()
    e.preventDefault()
    if (!ctx) return
    if (trackedRow) {
      ctx.removeTrack(trackedRow.id)
    } else if (!tracked) {
      ctx.addTrack(itemType, ident)
    }
  }

  const sizeClasses = size === 'md' ? 'p-1.5' : 'p-1'
  const iconClass = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'

  return (
    <button
      type="button"
      onClick={handleClick}
      title={tracked ? 'Remove from tracking' : 'Track in sidebar'}
      aria-label={tracked ? 'Remove from tracking' : 'Track in sidebar'}
      aria-pressed={tracked}
      data-testid={`track-${itemType}-${itemKey ?? itemId}`}
      className={`shrink-0 rounded-lg border transition cursor-pointer flex items-center ${sizeClasses} ${
        tracked
          ? 'border-indigo-400/40 bg-zinc-800 text-indigo-400 hover:bg-zinc-700 hover:text-indigo-300'
          : 'border-transparent text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800'
      }`}
    >
      <Plus className={iconClass} />
    </button>
  )
}
