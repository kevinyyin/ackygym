import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Shared by every modal — none of them previously moved focus in on open,
// trapped Tab within the dialog, or returned focus on close, which left a
// screen-reader or keyboard-only user with no announcement that a dialog
// appeared and full access to the (still-tabbable) page behind it. Pair
// with `role="dialog"`/`aria-modal="true"` on the dialog element and attach
// the returned ref to that same element.
export function useModalFocusTrap(active) {
  const containerRef = useRef(null)
  const previouslyFocusedRef = useRef(null)

  useEffect(() => {
    if (!active) return

    previouslyFocusedRef.current = document.activeElement
    const container = containerRef.current
    const focusable = container?.querySelectorAll(FOCUSABLE_SELECTOR)
    ;(focusable?.[0] ?? container)?.focus({ preventScroll: true })

    function handleKeyDown(e) {
      if (e.key !== 'Tab' || !container) return

      const nodes = [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus?.()
    }
  }, [active])

  return containerRef
}
