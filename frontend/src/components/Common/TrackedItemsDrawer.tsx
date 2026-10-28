import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Flame,
  ListTodo,
  LifeBuoy,
  Trash2,
  ChevronRight,
  Pin
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { StatusBadge } from './Badge'
import { TrackedItem, TrackedItemType } from '../../types'

function sortSectionItems(items: TrackedItem[]): TrackedItem[] {
  return [...items].sort((a, b) => {
    const isDoneA = (a.status || '').toLowerCase() === 'done'
    const isDoneB = (b.status || '').toLowerCase() === 'done'
    if (!isDoneA && isDoneB) return -1
    if (isDoneA && !isDoneB) return 1
    return a.key.localeCompare(b.key)
  })
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  type: TrackedItemType
  items: TrackedItem[]
  onSelect: (item: TrackedItem) => void
  onUntrack: (key: string, e: React.MouseEvent) => void
  onClearDone: (type: TrackedItemType) => void
}

function DrawerSection({
  title,
  icon,
  type,
  items,
  onSelect,
  onUntrack,
  onClearDone
}: SectionProps) {
  const sortedItems = sortSectionItems(items)
  const doneCount = items.filter(
    i => (i.status || '').toLowerCase() === 'done'
  ).length

  return (
    <div className="space-y-2" data-testid={`tracking-section-${type}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-1.5">
          {icon}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            {title}
          </h3>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400">
            {items.length}
          </span>
        </div>

        {/* Red trash bin icon to clear ONLY items in this section with status DONE */}
        <button
          type="button"
          onClick={() => onClearDone(type)}
          disabled={doneCount === 0}
          title={
            doneCount > 0
              ? `Clear ${doneCount} done ${title.toLowerCase()}`
              : `No done items to clear in ${title.toLowerCase()}`
          }
          aria-label={`Clear done ${title.toLowerCase()}`}
          data-testid={`clear-done-${type}-button`}
          className={`p-1 rounded transition flex items-center justify-center ${
            doneCount > 0
              ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer'
              : 'text-zinc-600 opacity-40 cursor-not-allowed'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Section Items List */}
      {sortedItems.length > 0 && (
        <div className="space-y-1.5" data-testid={`tracked-items-list-${type}`}>
          {sortedItems.map(item => {
            const isDone = (item.status || '').toLowerCase() === 'done'
            return (
              <div
                key={item.key}
                onClick={() => onSelect(item)}
                data-testid={`tracked-item-row-${item.key}`}
                className={`group p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2.5 text-sm ${
                  isDone
                    ? 'bg-zinc-950/40 border-zinc-900 opacity-70 hover:opacity-100 hover:border-zinc-800'
                    : 'bg-zinc-900/70 border-zinc-800/80 hover:border-indigo-500/50 hover:bg-zinc-900'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/40 leading-none">
                      {item.key}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <h4 className="text-sm font-medium text-zinc-200 truncate group-hover:text-white">
                    {item.title}
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={e => onUntrack(item.key, e)}
                    title={`Untrack ${item.key}`}
                    aria-label={`Untrack ${item.key}`}
                    data-testid={`untrack-item-${item.key}`}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function TrackedItemsDrawer() {
  const {
    isTrackingDrawerOpen,
    setIsTrackingDrawerOpen,
    trackedItems,
    untrackItem,
    clearDoneTrackedItems
  } = useApp()
  const navigate = useNavigate()
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isTrackingDrawerOpen) {
        setIsTrackingDrawerOpen(false)
      }
    }
    if (isTrackingDrawerOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isTrackingDrawerOpen, setIsTrackingDrawerOpen])

  const handleSelectItem = (item: TrackedItem) => {
    const projectKey = item.project_key || item.key.split('-')[0]
    if (item.type === 'incident') {
      navigate(`/projects/${projectKey}/incidents/${item.key}`)
    } else if (item.type === 'user-support') {
      navigate(`/projects/${projectKey}/user-support/${item.key}`)
    } else {
      navigate(`/projects/${projectKey}/items/${item.key}`)
    }
  }

  const handleUntrack = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    untrackItem(key)
  }

  const incidents = trackedItems.filter(i => i.type === 'incident')
  const workItems = trackedItems.filter(i => i.type === 'work-item')
  const userSupportItems = trackedItems.filter(i => i.type === 'user-support')

  if (!isTrackingDrawerOpen) {
    return null
  }

  return (
    <aside
      ref={drawerRef}
      data-testid="tracked-items-drawer"
      role="region"
      aria-label="Tracked Items Drawer"
      className="w-80 sm:w-88 md:w-96 shrink-0 border-r border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-16 h-[calc(100vh-4rem)] flex flex-col z-30 transition-all duration-200"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Pin className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100 leading-tight">
              Tracked Items
            </h2>
            <p className="text-[10px] text-zinc-400">
              {trackedItems.length} {trackedItems.length === 1 ? 'item' : 'items'} actively monitored
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsTrackingDrawerOpen(false)}
          aria-label="Close drawer"
          title="Collapse drawer"
          data-testid="close-tracking-drawer-button"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body: 3 Independent Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* 1. Work items */}
        <DrawerSection
          title="Work items"
          icon={<ListTodo className="w-3.5 h-3.5 text-indigo-400" />}
          type="work-item"
          items={workItems}
          onSelect={handleSelectItem}
          onUntrack={handleUntrack}
          onClearDone={clearDoneTrackedItems}
        />

        {/* 2. User Support */}
        <DrawerSection
          title="User Support"
          icon={<LifeBuoy className="w-3.5 h-3.5 text-emerald-400" />}
          type="user-support"
          items={userSupportItems}
          onSelect={handleSelectItem}
          onUntrack={handleUntrack}
          onClearDone={clearDoneTrackedItems}
        />

        {/* 3. Incidents */}
        <DrawerSection
          title="Incidents"
          icon={<Flame className="w-3.5 h-3.5 text-rose-400" />}
          type="incident"
          items={incidents}
          onSelect={handleSelectItem}
          onUntrack={handleUntrack}
          onClearDone={clearDoneTrackedItems}
        />
      </div>
    </aside>
  )
}
