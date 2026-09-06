import { useEffect, useRef, useState } from 'react'

const DEFAULT_DELAY_MS = 5500

// Backs an "Undo" toast for a delete that's already been confirmed (via
// ConfirmModal/ConfirmDeleteButton) — this is an additional safety net for
// "I meant to confirm but regret it a few seconds later," not a replacement
// for that confirmation step. Nothing is actually removed from Supabase (or
// Storage) until `delay` elapses with no Undo tap; `commit` is the caller's
// real delete logic, so a failure there still surfaces via the caller's own
// onError, just after the delay rather than immediately.
//
// Deliberately page-scoped, not global: navigating away (or closing the tab)
// during the grace window unmounts this hook, whose cleanup only clears the
// timer — the pending delete never commits. Nothing is ever silently deleted
// without `commit` actually running, but it does mean a fast navigation away
// quietly cancels a delete the user may have assumed went through.
export function useDeferredDelete({ delay = DEFAULT_DELAY_MS } = {}) {
  const [pending, setPending] = useState(null) // { ids: Set, message, commit }
  const timeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  function stageDelete({ ids, message, commit }) {
    if (pending) {
      // A second delete staged before the first's grace period elapsed —
      // commit the earlier one immediately rather than losing track of it.
      clearTimeout(timeoutRef.current)
      pending.commit()
    }

    timeoutRef.current = setTimeout(async () => {
      await commit()
      setPending(null)
    }, delay)

    setPending({ ids: new Set(ids), message, commit })
  }

  function undo() {
    if (!pending) return
    clearTimeout(timeoutRef.current)
    setPending(null)
  }

  return {
    isPending: (id) => pending?.ids.has(id) ?? false,
    message: pending?.message ?? '',
    stageDelete,
    undo,
  }
}
