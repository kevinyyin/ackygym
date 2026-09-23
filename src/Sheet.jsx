import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEscapeToClose } from './useEscapeToClose'
import { useModalFocusTrap } from './useModalFocusTrap'
import { smooth } from './motionPresets'
import { CloseIcon } from './icons'

// Counted, not a boolean, because sheets nest (e.g. WorkoutDayModal opens a
// ConfirmModal on top of itself) and the background must stay receded until
// the last one closes. index.css keys the scale-down off this attribute.
let openSheetCount = 0

function useBackgroundRecede(open) {
  useEffect(() => {
    if (!open) return
    openSheetCount += 1
    document.documentElement.setAttribute('data-sheet-open', '')
    return () => {
      openSheetCount -= 1
      if (openSheetCount === 0) document.documentElement.removeAttribute('data-sheet-open')
    }
  }, [open])
}

const DISMISS_DISTANCE_RATIO = 0.3
const DISMISS_VELOCITY = 500

// Always render this (with open={false} when closed) rather than returning
// null from the caller — AnimatePresence needs the element to stay in the
// tree to play the exit, and it keeps the last-rendered children for it.
function Sheet({ open, onClose, title, size = 'auto', children }) {
  const titleId = useId()
  const dragControls = useDragControls()
  const containerRef = useModalFocusTrap(open)
  useEscapeToClose(open, onClose)
  useBackgroundRecede(open)

  function handleDragEnd(_event, info) {
    const height = containerRef.current?.offsetHeight ?? 0
    if (info.offset.y > height * DISMISS_DISTANCE_RATIO || info.velocity.y > DISMISS_VELOCITY) {
      onClose()
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="sheet" className="fixed inset-0 z-40 flex items-end justify-center">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={smooth}
            onClick={onClose}
          />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : 'Dialog'}
            tabIndex={-1}
            className={`relative flex w-full max-w-md flex-col rounded-t-card bg-surface pb-[env(safe-area-inset-bottom)] text-chalk shadow-[0_-20px_60px_var(--shadow-tint)] focus:outline-none ${
              size === 'large' ? 'h-[92svh]' : 'max-h-[92svh]'
            }`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={smooth}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={handleDragEnd}
          >
            {/* Only this header starts a drag, so scrolling the body never
                gets hijacked into a dismiss. */}
            <div
              className="shrink-0 cursor-grab touch-none px-5 pt-2 pb-3 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="mx-auto h-1.5 w-10 rounded-full bg-chalk-dim/40" />
              <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
                {title ? (
                  <h2 id={titleId} className="min-w-0 truncate text-headline">
                    {title}
                  </h2>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-chalk-dim"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default Sheet
