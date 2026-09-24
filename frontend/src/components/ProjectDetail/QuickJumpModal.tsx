import { useState, useMemo, useRef, useEffect, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  Sparkles,
  X,
  Loader2,
  CornerDownRight,
  CornerDownLeft
} from 'lucide-react'
import { WorkItem, SearchItemResult, SearchResponse } from '../../types'
import { PriorityBadge, StatusBadge } from '../Common/Badge'
import { apiFetch } from '../../utils/apiFetch'

interface QuickJumpModalProps {
  isOpen: boolean
  onClose: () => void
  projectKey: string
  workItems: WorkItem[]
  onSelectWorkItem: (item: WorkItem) => void
}

function getRelevanceScore(item: WorkItem, rawQuery: string, projKey: string): number {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return 0
  const itemKey = item.key.toLowerCase()
  const projKeyLower = projKey.toLowerCase()
  const expectedFullKey = `${projKeyLower}-${q}`

  // Extract number part of key, e.g. "50" from "DAV-50"
  const keyNum = itemKey.includes('-') ? itemKey.split('-').slice(1).join('-') : itemKey

  // 1. Exact match with item key or key number (e.g. "50" -> "DAV-50")
  if (itemKey === q || itemKey === expectedFullKey || keyNum === q) {
    return 100000
  }

  // 2. Key ends with -<q>
  if (itemKey.endsWith(`-${q}`)) {
    return 90000
  }

  // 3. Key or keyNum starts with expectedFullKey or query
  if (itemKey.startsWith(expectedFullKey) || keyNum.startsWith(q)) {
    return 50000
  }

  // 4. Key starts with query directly
  if (itemKey.startsWith(q)) {
    return 40000
  }

  // 5. Key contains query
  if (itemKey.includes(q)) {
    return 20000
  }

  const title = item.title.toLowerCase()
  // 6. Title exact match or starts with query
  if (title === q) {
    return 15000
  }
  if (title.startsWith(q)) {
    return 10000
  }

  // 7. Title word match
  if (title.includes(` ${q}`) || title.includes(`(${q}`) || title.includes(`[${q}`)) {
    return 5000
  }

  // 8. Title contains query anywhere
  if (title.includes(q)) {
    return 2000
  }

  // 9. Description contains query
  const desc = (item.description || '').toLowerCase()
  if (desc.includes(q)) {
    return 500
  }

  return 0
}

export function QuickJumpModal({
  isOpen,
  onClose,
  projectKey,
  workItems,
  onSelectWorkItem
}: QuickJumpModalProps) {
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<'keyword' | 'hybrid'>('keyword')
  const [searchResults, setSearchResults] = useState<SearchItemResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  // Lock body scroll and auto-focus when opened
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      setSearch('')
      setSelectedIndex(0)
      setSearchResults(null)
      setIsSearching(false)

      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 30)

      return () => {
        document.body.style.overflow = prevOverflow
        clearTimeout(timer)
      }
    }
  }, [isOpen])

  // Debounced search when hybrid/semantic mode is selected
  useEffect(() => {
    if (!isOpen) return

    const q = search.trim()
    if (!q || searchMode === 'keyword') {
      setSearchResults(null)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/projects/${projectKey}/search?q=${encodeURIComponent(q)}&mode=${searchMode}`,
          { signal: controller.signal }
        )
        if (res.ok) {
          const data: SearchResponse = await res.json()
          setSearchResults(data.results)
        } else {
          setSearchResults(null)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setSearchResults(null)
        }
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, searchMode, projectKey, isOpen])

  const searchResultMap = useMemo(() => {
    if (!searchResults) return null
    const map = new Map<string, SearchItemResult>()
    for (const r of searchResults) {
      map.set(r.work_item.key, r)
    }
    return map
  }, [searchResults])

  // Filtered and ranked items
  const displayResults = useMemo(() => {
    if (searchMode === 'hybrid' && searchResults !== null) {
      return searchResults.map(r => r.work_item)
    }

    const trimmed = search.trim()
    if (!trimmed) {
      return workItems.slice(0, 20)
    }

    // Keyword scoring & ranking
    const scored: { item: WorkItem; score: number }[] = []
    for (const item of workItems) {
      const score = getRelevanceScore(item, trimmed, projectKey)
      if (score > 0) {
        scored.push({ item, score })
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Extract numeric suffix if available
      const numA = parseInt(a.item.key.replace(/^[a-z0-9]+-/i, ''), 10) || 0
      const numB = parseInt(b.item.key.replace(/^[a-z0-9]+-/i, ''), 10) || 0
      if (numA !== numB) return numA - numB
      return String(a.item.key).localeCompare(String(b.item.key), undefined, { numeric: true })
    })

    return scored.map(s => s.item).slice(0, 30)
  }, [workItems, search, searchMode, searchResults, projectKey])

  // Reset selectedIndex whenever results list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [displayResults.length, search, searchMode])

  // Scroll active item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex]
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({
        block: 'nearest'
      })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < displayResults.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (displayResults.length > 0 && displayResults[selectedIndex]) {
        const target = displayResults[selectedIndex]
        onSelectWorkItem(target)
        onClose()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Jump to Work Item"
      data-testid="quick-jump-modal"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        className="flex min-h-full items-center justify-center p-4 text-center"
        onClick={onClose}
      >
        <div
          className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl text-left overflow-hidden z-10 transition-all flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header & Input */}
          <div className="p-3 sm:p-3.5 border-b border-zinc-800/80 flex items-center gap-2">
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchMode === 'hybrid'
                    ? 'Semantic search issues...'
                    : `Issue number or keyword in ${projectKey}... (e.g. 50)`
                }
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                data-testid="quick-jump-input"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin absolute right-3 pointer-events-none" />
              )}
            </div>

            {/* Mode toggle */}
            <button
              type="button"
              onClick={() => setSearchMode(prev => (prev === 'hybrid' ? 'keyword' : 'hybrid'))}
              data-testid="quick-jump-mode-toggle"
              aria-label={`Toggle search mode: current is ${searchMode}`}
              title={
                searchMode === 'hybrid'
                  ? 'Semantic AI vector search active. Click to switch to keyword matching.'
                  : 'Exact keyword search active. Click to switch to AI semantic search.'
              }
              className={`px-2.5 py-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition shrink-0 ${
                searchMode === 'hybrid'
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 shadow-sm'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Sparkles
                className={`w-3.5 h-3.5 ${
                  searchMode === 'hybrid' ? 'text-purple-400' : 'text-zinc-500'
                }`}
              />
              <span className="hidden sm:inline">
                {searchMode === 'hybrid' ? 'Semantic' : 'Keyword'}
              </span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quick jump"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition shrink-0"
              data-testid="quick-jump-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results List */}
          <div
            ref={listRef}
            className="max-h-80 overflow-y-auto divide-y divide-zinc-800/40 p-1 sm:p-1.5"
            data-testid="quick-jump-results"
          >
            {displayResults.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                {search.trim() ? (
                  <>
                    No work items match{' '}
                    <span className="font-mono text-zinc-300">"{search}"</span>
                  </>
                ) : (
                  'No work items available in this project.'
                )}
              </div>
            ) : (
              displayResults.map((item, index) => {
                const isSelected = index === selectedIndex
                const searchResult = searchResultMap?.get(item.key)

                return (
                  <div
                    key={item.key}
                    ref={el => {
                      itemRefs.current[index] = el
                    }}
                    onClick={() => {
                      onSelectWorkItem(item)
                      onClose()
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    data-testid={`quick-jump-item-${item.key}`}
                    className={`px-3 py-2.5 rounded-lg cursor-pointer transition flex items-center justify-between gap-3 select-none ${
                      isSelected
                        ? 'bg-indigo-600/20 border-l-2 border-indigo-500 text-white'
                        : 'hover:bg-zinc-800/50 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-mono text-xs font-bold ${
                            isSelected ? 'text-indigo-300' : 'text-indigo-400'
                          }`}
                        >
                          {item.key}
                        </span>
                        <StatusBadge status={item.status} />
                        <PriorityBadge priority={item.priority} />

                        {item.parent_key && (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded leading-none">
                            <CornerDownRight className="w-2.5 h-2.5 text-zinc-500" />
                            <span>{item.parent_key}</span>
                          </span>
                        )}

                        {searchResult && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/60 leading-none flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                            <span>{Math.round(searchResult.score * 100)}%</span>
                          </span>
                        )}
                      </div>

                      <div
                        className={`text-sm truncate font-medium ${
                          isSelected ? 'text-zinc-100' : 'text-zinc-200'
                        }`}
                      >
                        {item.title}
                      </div>

                      {searchResult?.snippet && (
                        <p className="text-[10px] text-zinc-400 font-mono truncate">
                          {searchResult.snippet}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-zinc-500">
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[11px] text-indigo-300 font-medium">
                          <span>Open</span>
                          <CornerDownLeft className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Navigation Bar */}
          <div className="px-3.5 py-2 border-t border-zinc-800/80 bg-zinc-950/50 flex items-center justify-between text-[11px] text-zinc-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 text-zinc-400 font-mono text-[10px]">
                  ↵
                </kbd>
                <span>to open</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 text-zinc-400 font-mono text-[10px]">
                  ↑↓
                </kbd>
                <span>to navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 text-zinc-400 font-mono text-[10px]">
                  esc
                </kbd>
                <span>to close</span>
              </span>
            </div>

            <div className="text-zinc-400 font-medium text-[11px]">
              {searchMode === 'keyword' ? 'Keyword' : 'Semantic'}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
