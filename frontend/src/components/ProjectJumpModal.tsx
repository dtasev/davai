import { useState, useMemo, useRef, useEffect, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { Project } from '../types'

export interface ProjectJumpModalProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  onSelectProject: (project: Project) => void
  currentProjectKey?: string | null
}

export function ProjectJumpModal({
  isOpen,
  onClose,
  projects,
  onSelectProject,
  currentProjectKey
}: ProjectJumpModalProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Lock body scroll and auto-focus when opened
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      setSearch('')
      setSelectedIndex(0)

      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 30)

      return () => {
        document.body.style.overflow = prevOverflow
        clearTimeout(timer)
      }
    }
  }, [isOpen])

  // Escape closes the modal even when focus is outside the input
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const displayProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      p => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
    )
  }, [projects, search])

  // Reset selectedIndex whenever the result list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search, displayProjects.length])

  // Scroll active row into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex]
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < displayProjects.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (displayProjects.length > 0 && displayProjects[selectedIndex]) {
        onSelectProject(displayProjects[selectedIndex])
        onClose()
      }
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Jump to project"
      data-testid="project-jump-modal"
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
                placeholder="Search projects by name or key..."
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
                data-testid="project-jump-input"
              />
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close project jump"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition shrink-0"
              data-testid="project-jump-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results List */}
          <div
            className="max-h-80 overflow-y-auto divide-y divide-zinc-800/40 p-1 sm:p-1.5"
            data-testid="project-jump-results"
          >
            {displayProjects.length === 0 ? (
              <div
                className="py-8 text-center text-sm text-zinc-500"
                data-testid="project-jump-empty"
              >
                {projects.length === 0 ? (
                  'No projects available yet.'
                ) : (
                  <>
                    No projects match{' '}
                    <span className="font-mono text-zinc-300">"{search.trim()}"</span>
                  </>
                )}
              </div>
            ) : (
              displayProjects.map((project, index) => {
                const isSelected = index === selectedIndex

                return (
                  <div
                    key={project.key}
                    ref={el => {
                      itemRefs.current[index] = el
                    }}
                    onClick={() => {
                      onSelectProject(project)
                      onClose()
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    data-testid={`project-jump-item-${project.key}`}
                    className={`px-3 py-2.5 rounded-lg cursor-pointer transition flex items-center justify-between gap-3 select-none ${
                      isSelected
                        ? 'bg-indigo-600/20 border-l-2 border-indigo-500 text-white'
                        : 'hover:bg-zinc-800/50 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-indigo-400">
                          {project.key}
                        </span>
                        {project.key === currentProjectKey && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 leading-none">
                            current
                          </span>
                        )}
                      </div>

                      <div className="text-sm truncate font-medium text-zinc-200">
                        {project.name}
                      </div>
                    </div>

                    <div className="shrink-0 text-[11px] text-zinc-500">
                      {project.item_count} items
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

            <span className="flex items-center gap-1 text-zinc-400 font-medium text-[11px]">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 text-zinc-400 font-mono text-[10px]">
                T
              </kbd>
              <span>to jump</span>
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
