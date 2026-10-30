import { KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Menu,
  PanelLeftClose,
  Flame,
  ListTodo,
  LifeBuoy,
  Zap,
  Rocket,
  Trash2,
  X,
  Loader2,
  LucideIcon
} from 'lucide-react'
import { TrackedItem, TrackedItemType, TrackedSection } from '../../types'
import { StatusBadge } from '../Common/Badge'
import { useTrackedItems } from '../../context/TrackedItemsContext'

/**
 * Shared done-like rule (also used by list sorting elsewhere):
 * done-like iff status is 'done' OR an incident marked 'no longer relevant'.
 */
export function isDoneLike(item: TrackedItem): boolean {
  const status = (item.status || '').toLowerCase()
  if (status === 'done') return true
  return item.item_type === 'incident' && status === 'no longer relevant'
}

interface SectionConfig {
  section: TrackedSection
  itemType: TrackedItemType
  label: string
  icon: LucideIcon
  /** Static Tailwind classes (full literals so the JIT can see them). */
  tileClass: string
  iconClass: string
  keyClass: string
}

// Render order is contractual: Work Items, User Support, Incidents, Sprints, Releases.
const SECTIONS: SectionConfig[] = [
  {
    section: 'work_items',
    itemType: 'work_item',
    label: 'Work Items',
    icon: ListTodo,
    tileClass: 'bg-emerald-500/10 border-emerald-500/20',
    iconClass: 'text-emerald-400',
    keyClass: 'text-emerald-400'
  },
  {
    section: 'user_support',
    itemType: 'user_support',
    label: 'User Support',
    icon: LifeBuoy,
    tileClass: 'bg-cyan-500/10 border-cyan-500/20',
    iconClass: 'text-cyan-400',
    keyClass: 'text-cyan-400'
  },
  {
    section: 'incidents',
    itemType: 'incident',
    label: 'Incidents',
    icon: Flame,
    tileClass: 'bg-rose-500/10 border-rose-500/20',
    iconClass: 'text-rose-400',
    keyClass: 'text-rose-400'
  },
  {
    section: 'sprints',
    itemType: 'sprint',
    label: 'Sprints',
    icon: Zap,
    tileClass: 'bg-amber-500/10 border-amber-500/20',
    iconClass: 'text-amber-400',
    keyClass: 'text-amber-400'
  },
  {
    section: 'releases',
    itemType: 'release',
    label: 'Releases',
    icon: Rocket,
    tileClass: 'bg-indigo-500/10 border-indigo-500/20',
    iconClass: 'text-indigo-400',
    keyClass: 'text-indigo-400'
  }
]

const DRAWER_OPEN_KEY = 'davai_drawer_open'
const DRAWER_WIDTH_KEY = 'davai_drawer_width'

const DRAWER_DEFAULT_WIDTH = 360
const DRAWER_MIN_WIDTH = 260
const DRAWER_MAX_WIDTH = 720
/** Pixels per arrow-key press when resizing from the keyboard. */
const RESIZE_KEY_STEP = 16

function readInitialOpen(): boolean {
  try {
    return localStorage.getItem(DRAWER_OPEN_KEY) === 'true'
  } catch {
    return false
  }
}

function clampDrawerWidth(width: number): number {
  if (!Number.isFinite(width)) return DRAWER_DEFAULT_WIDTH
  return Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, Math.round(width)))
}

function readInitialWidth(): number {
  try {
    const raw = localStorage.getItem(DRAWER_WIDTH_KEY)
    if (!raw) return DRAWER_DEFAULT_WIDTH
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? clampDrawerWidth(parsed) : DRAWER_DEFAULT_WIDTH
  } catch {
    return DRAWER_DEFAULT_WIDTH
  }
}

function routePathForItem(item: TrackedItem): string | null {
  if (!item.project_key) {
    return null
  }
  const base = `/projects/${item.project_key}`
  switch (item.item_type) {
    case 'work_item':
      return `${base}/items/${item.key}`
    case 'user_support':
      return `${base}/user-support/${item.key}`
    case 'incident':
      return `${base}/incidents/${item.key}`
    case 'sprint':
      return `${base}/sprints/${item.ref_id}`
    case 'release':
      return `${base}/releases/${item.ref_id}`
    default:
      return null
  }
}

export function TrackingDrawer() {
  const { trackedItems, loadingTracked, removeTrack, clearDone } = useTrackedItems()
  const navigate = useNavigate()
  const [open, setOpen] = useState<boolean>(readInitialOpen)
  const [width, setWidth] = useState<number>(readInitialWidth)
  const [resizing, setResizing] = useState(false)

  const setDrawerOpen = (next: boolean) => {
    setOpen(next)
    try {
      localStorage.setItem(DRAWER_OPEN_KEY, String(next))
    } catch {
      // Private-browsing localStorage failures are non-fatal.
    }
  }

  // Persist the width whenever a drag finishes (resizing -> false) or the width
  // changes from the keyboard, not on every mousemove.
  useEffect(() => {
    if (resizing) return
    try {
      localStorage.setItem(DRAWER_WIDTH_KEY, String(width))
    } catch {
      // Private-browsing localStorage failures are non-fatal.
    }
  }, [width, resizing])

  // Tear down an in-flight drag if the drawer unmounts mid-drag (the window
  // listeners and the body cursor/user-select overrides would otherwise leak).
  const endDragRef = useRef<(() => void) | null>(null)
  useEffect(() => () => endDragRef.current?.(), [])

  const handleResizeStart = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    // preventDefault() suppresses the implicit focus on mousedown.
    event.currentTarget.focus()
    const startX = event.clientX
    const startWidth = width
    setResizing(true)

    const handleMove = (moveEvent: globalThis.MouseEvent) => {
      setWidth(clampDrawerWidth(startWidth + moveEvent.clientX - startX))
    }
    const endDrag = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', endDrag)
      window.removeEventListener('blur', endDrag)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      endDragRef.current = null
      setResizing(false)
    }
    endDragRef.current = endDrag

    // Suppress text selection / keep the col-resize cursor while dragging
    // outside the handle. `blur` covers losing the mouseup outside the window.
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', endDrag)
    window.addEventListener('blur', endDrag)
  }

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? RESIZE_KEY_STEP * 2 : RESIZE_KEY_STEP
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setWidth(current => clampDrawerWidth(current - step))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setWidth(current => clampDrawerWidth(current + step))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setWidth(DRAWER_DEFAULT_WIDTH)
    }
  }

  // Sectioned + sorted views: non-done-like first (newest added_at first),
  // done-like pushed to the bottom (newest added_at first), like SprintList.
  const sectionViews = useMemo(
    () =>
      SECTIONS.map(config => {
        const items = [...trackedItems.filter(t => t.item_type === config.itemType)].sort(
          (a, b) => {
            const aDone = isDoneLike(a)
            const bDone = isDoneLike(b)
            if (!aDone && bDone) return -1
            if (aDone && !bDone) return 1
            return new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
          }
        )
        return { config, items, doneCount: items.filter(isDoneLike).length }
      }),
    [trackedItems]
  )

  const handleRowClick = (item: TrackedItem) => {
    const path = routePathForItem(item)
    if (path) {
      navigate(path)
    }
  }

  const handleRemoveClick = (event: MouseEvent, id: number) => {
    event.stopPropagation()
    removeTrack(id)
  }

  const handleClearDoneClick = (event: MouseEvent, section: TrackedSection) => {
    event.stopPropagation()
    clearDone(section)
  }

  return (
    <aside
      className={`relative shrink-0 border-r border-zinc-800/80 bg-zinc-900/40 flex flex-col ${
        resizing ? '' : 'transition-[width] duration-150'
      } ${open ? '' : 'w-11'}`}
      style={open ? { width: `${width}px` } : undefined}
      data-testid={open ? 'tracking-drawer' : undefined}
    >
      {open && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize tracking drawer"
          aria-valuemin={DRAWER_MIN_WIDTH}
          aria-valuemax={DRAWER_MAX_WIDTH}
          aria-valuenow={width}
          tabIndex={0}
          data-testid="drawer-resize-handle"
          title="Drag to resize · double-click to reset"
          onMouseDown={handleResizeStart}
          onDoubleClick={() => setWidth(DRAWER_DEFAULT_WIDTH)}
          onKeyDown={handleResizeKeyDown}
          className="group absolute inset-y-0 right-0 w-1.5 cursor-col-resize z-10 flex justify-center focus:outline-none"
        >
          <span
            className={`h-full w-0.5 rounded-full transition-colors ${
              resizing
                ? 'bg-indigo-400'
                : 'bg-transparent group-hover:bg-indigo-400/70 group-focus-visible:bg-indigo-400/70'
            }`}
          />
        </div>
      )}
      <div
        className={`flex items-center py-3 border-b border-zinc-800/80 ${
          open ? 'justify-between gap-2 px-3' : 'justify-center'
        }`}
      >
        {open ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-bold text-zinc-100 tracking-tight">Tracking</h2>
              {loadingTracked && (
                <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" data-testid="drawer-loading" />
              )}
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              data-testid="drawer-collapse"
              title="Collapse tracking drawer"
              aria-label="Collapse tracking drawer"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            data-testid="drawer-toggle"
            title="Open tracking drawer"
            aria-label="Open tracking drawer"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {sectionViews.map(({ config, items, doneCount }) => {
          const SectionIcon = config.icon
          return (
            <section key={config.section} data-testid={`drawer-section-${config.section}`}>
              <div className="flex items-center gap-2 px-0.5 mb-1.5">
                <div
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${config.tileClass} ${config.iconClass}`}
                >
                  <SectionIcon className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200 truncate flex-1 min-w-0">
                  {config.label}
                  <span className="ml-1.5 font-mono text-xs text-zinc-500 font-normal">
                    ({items.length})
                  </span>
                </h3>
                {doneCount > 0 && (
                  <button
                    type="button"
                    onClick={event => handleClearDoneClick(event, config.section)}
                    data-testid={`drawer-clear-done-${config.section}`}
                    title="Clear done items"
                    aria-label={`Clear done ${config.label.toLowerCase()}`}
                    className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {items.length > 0 && (
                <ul className="space-y-0.5">
                  {items.map(item => (
                    <li key={item.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleRowClick(item)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') handleRowClick(item)
                        }}
                        className="group flex items-start gap-1.5 px-1.5 py-1.5 rounded-lg cursor-pointer transition hover:bg-zinc-800/40"
                        data-testid={`drawer-item-${item.item_type}-${item.key}`}
                      >
                        <div className="flex-1 min-w-0">
                          {/* Row 1: key (or type icon) + status badge. */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.item_type === 'sprint' || item.item_type === 'release' ? (
                              item.item_type === 'sprint' ? (
                                <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                              ) : (
                                <Rocket className="w-3 h-3 text-indigo-400 shrink-0" />
                              )
                            ) : (
                              <span className={`font-mono text-[11px] leading-none shrink-0 ${config.keyClass}`}>
                                {item.key}
                              </span>
                            )}
                            <StatusBadge status={item.status} compact />
                          </div>
                          {/* Row 2: title on its own line, same size as the rest of the app. */}
                          <span className="mt-1 block text-sm text-zinc-200 truncate">
                            {item.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={event => handleRemoveClick(event, item.id)}
                          data-testid={`drawer-remove-${item.id}`}
                          title="Remove from tracking"
                          aria-label="Remove from tracking"
                          className="mt-0.5 p-0.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60 transition opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      )}
    </aside>
  )
}
