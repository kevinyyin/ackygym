import { useId } from 'react'
import Card from './Card'
import { useEscapeToClose } from './useEscapeToClose'
import { useModalFocusTrap } from './useModalFocusTrap'

// A real confirmation dialog for hard-to-reverse deletes (a whole routine,
// a library exercise, a photo) — as opposed to ConfirmDeleteButton's
// tap-to-arm pattern, which suits the low-blast-radius deletes (sets,
// notes, water/weight/calorie entries) it's still used for everywhere else.
function ConfirmModal({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  useEscapeToClose(open, onCancel)
  const containerRef = useModalFocusTrap(open)
  // useId, not a static string — some pages (e.g. RoutinesPage) mount two
  // ConfirmModal instances at once, and a static id would collide.
  const titleId = useId()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 p-4"
      onClick={onCancel}
    >
      <Card
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-display text-xl leading-none tracking-tight text-chalk uppercase">
          {title}
        </h2>
        <p className="mt-2 text-sm text-chalk-dim">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line px-4 py-2 font-body text-sm font-semibold text-chalk-dim active:border-blue-500 active:text-blue-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md border border-danger px-4 py-2 font-body text-sm font-bold text-danger active:bg-danger/10"
          >
            {confirmLabel}
          </button>
        </div>
      </Card>
    </div>
  )
}

export default ConfirmModal
