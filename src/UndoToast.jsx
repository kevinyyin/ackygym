import { AnimatePresence, motion } from 'motion/react'
import { smooth } from './motionPresets'

// Purely presentational — the timing lives in useDeferredDelete. Sits above
// the tab bar and the timer pill's slot. z-30 keeps it under open sheets
// (z-40), which is fine: every deferred delete is triggered from a page,
// not from inside a sheet.
function UndoToast({ message, onUndo }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="undo"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={smooth}
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8rem)] z-30 flex justify-center px-5"
        >
          <div className="flex items-center gap-4 rounded-full bg-surface-2 py-2.5 pr-3 pl-5 shadow-[0_10px_30px_var(--shadow-tint)]">
            <span role="status" aria-live="polite" className="text-[15px] text-chalk">
              {message}
            </span>
            <button type="button" onClick={onUndo} className="shrink-0 text-[15px] font-semibold text-blue-400">
              Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default UndoToast
