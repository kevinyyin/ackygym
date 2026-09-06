import { useEffect } from 'react'

// Shared by every modal that isn't already handling this itself (see
// ProgressPhotosPage's lightbox) — Escape should close a modal the same way
// clicking the backdrop or the ✕ button already does.
export function useEscapeToClose(active, onClose) {
  useEffect(() => {
    if (!active) return

    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, onClose])
}
