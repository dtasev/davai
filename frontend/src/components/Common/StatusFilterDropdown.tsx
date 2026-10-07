import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { ProjectStatus } from '../../types'
import { formatStatus } from './Badge'

interface StatusFilterDropdownProps {
  statuses: ProjectStatus[]
  selectedStatuses: string[]
  onChangeSelectedStatuses: (statuses: string[]) => void
  getCountForStatus: (statusLower: string) => number
  excludedByDefault?: string[]
  hideExcludedLabel?: string
  hideExcludedTitle?: string
  excludedButtonSummary?: string
}

export function StatusFilterDropdown({
  statuses,
  selectedStatuses,
  onChangeSelectedStatuses,
  getCountForStatus,
  excludedByDefault = ['done'],
  hideExcludedLabel = 'Hide Done',
  hideExcludedTitle = 'Hide Done statuses',
  excludedButtonSummary = 'Statuses (Done hidden)'
}: StatusFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const normalizedExcluded = useMemo(
    () => excludedByDefault.map(s => s.toLowerCase()),
    [excludedByDefault]
  )

  const toggleStatus = (statusName: string) => {
    const norm = statusName.toLowerCase()
    if (selectedStatuses.includes(norm)) {
      onChangeSelectedStatuses(selectedStatuses.filter(s => s !== norm))
    } else {
      onChangeSelectedStatuses([...selectedStatuses, norm])
    }
  }

  const selectOnly = (statusName: string) => {
    onChangeSelectedStatuses([statusName.toLowerCase()])
  }

  const selectAll = () => {
    onChangeSelectedStatuses(statuses.map(st => st.name.toLowerCase()))
  }

  const selectAllExceptDefaultExcluded = () => {
    onChangeSelectedStatuses(
      statuses
        .map(st => st.name.toLowerCase())
        .filter(name => !normalizedExcluded.includes(name))
    )
  }

  const clearAll = () => {
    onChangeSelectedStatuses([])
  }

  const isAllSelected =
    statuses.length > 0 &&
    statuses.every(st => selectedStatuses.includes(st.name.toLowerCase()))

  const nonExcludedStatuses = statuses.filter(
    s => !normalizedExcluded.includes(s.name.toLowerCase())
  )
  const isDefaultExcludedHidden =
    normalizedExcluded.length > 0 &&
    normalizedExcluded.every(ex => !selectedStatuses.includes(ex)) &&
    nonExcludedStatuses.length > 0 &&
    nonExcludedStatuses.every(st =>
      selectedStatuses.includes(st.name.toLowerCase())
    )

  const statusButtonLabel = useMemo(() => {
    if (selectedStatuses.length === 0) return 'No Statuses'
    if (isAllSelected) return 'All Statuses'
    if (isDefaultExcludedHidden) return excludedButtonSummary
    if (selectedStatuses.length === 1) {
      return formatStatus(selectedStatuses[0])
    }
    return `Statuses (${selectedStatuses.length})`
  }, [selectedStatuses, isAllSelected, isDefaultExcludedHidden, excludedButtonSummary])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        data-testid="status-filter-dropdown-button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`px-2.5 py-1.5 rounded-lg border text-sm flex items-center gap-2 transition focus:outline-none ${
          isOpen
            ? 'bg-zinc-800 border-indigo-500 text-zinc-100 shadow-sm'
            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700'
        }`}
      >
        <span className="truncate max-w-[150px] sm:max-w-none">{statusButtonLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          data-testid="status-filter-dropdown-menu"
          className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-60 sm:w-64 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden"
        >
          {/* Header Actions */}
          <div className="px-3 py-1.5 border-b border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-300">Filter by Status</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="status-filter-select-all"
                onClick={selectAll}
                className="hover:text-indigo-400 transition text-[11px]"
              >
                All
              </button>
              {normalizedExcluded.length > 0 && (
                <>
                  <span className="text-zinc-700">|</span>
                  <button
                    type="button"
                    data-testid="status-filter-hide-done"
                    onClick={selectAllExceptDefaultExcluded}
                    className="hover:text-indigo-400 transition text-[11px]"
                    title={hideExcludedTitle}
                  >
                    {hideExcludedLabel}
                  </button>
                </>
              )}
              <span className="text-zinc-700">|</span>
              <button
                type="button"
                data-testid="status-filter-clear"
                onClick={clearAll}
                className="hover:text-rose-400 transition text-[11px]"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Status Options */}
          <div className="max-h-60 overflow-y-auto py-1 divide-y divide-zinc-800/40">
            {statuses.map(st => {
              const normSt = st.name.toLowerCase()
              const isSelected = selectedStatuses.includes(normSt)
              const count = getCountForStatus(normSt)
              const slug = normSt.replace(/\s+/g, '-')

              return (
                <div
                  key={st.id || st.name}
                  data-testid={`status-option-${slug}`}
                  onClick={() => toggleStatus(st.name)}
                  className={`flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800/60 cursor-pointer transition select-none group ${
                    isSelected ? 'bg-zinc-800/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      data-testid={`status-checkbox-${slug}`}
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer accent-indigo-600 shrink-0"
                    />
                    <span
                      className={`text-xs truncate capitalize ${
                        isSelected ? 'text-zinc-200 font-medium' : 'text-zinc-400'
                      }`}
                    >
                      {formatStatus(st.name)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono ml-auto mr-1">
                      ({count})
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid={`status-only-${slug}`}
                    onClick={e => {
                      e.stopPropagation()
                      selectOnly(st.name)
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-mono lowercase text-zinc-500 hover:text-indigo-300 hover:bg-indigo-950/80 border border-zinc-800/80 hover:border-indigo-700/60 rounded transition shrink-0 ml-1.5"
                    title={`Show only ${formatStatus(st.name)}`}
                  >
                    only
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
