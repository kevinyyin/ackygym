import Sheet from './Sheet'
import Button from './Button'

// A real confirmation for hard-to-reverse deletes (a whole routine, a
// library exercise, a photo) — as opposed to ConfirmDeleteButton's
// tap-to-arm pattern, still used for low-blast-radius deletes. Shaped like
// an iOS action sheet: message, destructive action, cancel.
function ConfirmModal({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="text-[15px] text-chalk-dim">{message}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Button variant="destructive" size="lg" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" size="lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Sheet>
  )
}

export default ConfirmModal
