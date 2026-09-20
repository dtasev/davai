import { useEffect, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  maxWidth?: string
  closeOnOverlayClick?: boolean
  headerActions?: ReactNode
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
  closeOnOverlayClick = true,
  headerActions
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        document.body.style.overflow = prevOverflow
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOverlayClick = closeOnOverlayClick ? onClose : undefined

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div
        className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center"
        onClick={handleOverlayClick}
      >
        <div
          className={`relative bg-zinc-900 border border-zinc-800 rounded-xl w-full ${maxWidth} p-5 sm:p-6 space-y-4 shadow-2xl text-left my-8 transition-all z-10`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5 gap-2">
            <div className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2 min-w-0">
              {title}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {headerActions}
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>{children}</div>
        </div>
      </div>
    </div>,
    document.body
  )
}
