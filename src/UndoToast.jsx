// Purely presentational — the timing lives in useDeferredDelete. Positioned
// above App.jsx's bottom tab bar (which carries no z-* class of its own) and
// above modals (z-20), so it stays visible even if a confirm dialog is still
// closing underneath it.
function UndoToast({ message, onUndo }) {
  if (!message) return null

  return (
    <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-line bg-surface-2 px-4 py-2 shadow-lg">
        <span role="status" aria-live="polite" className="text-sm text-chalk">
          {message}
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 font-mono text-xs font-bold tracking-wide text-blue-400 uppercase"
        >
          Undo
        </button>
      </div>
    </div>
  )
}

export default UndoToast
