import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './icons'

const ARM_TIMEOUT_MS = 4000

// Tap-to-arm confirm: first tap arms the button (visually distinct, no layout
// shift), a second tap within ARM_TIMEOUT_MS confirms. Reserved for
// low-blast-radius actions (a set, a note, a water/weight/calorie entry,
// one exercise out of a routine) — anything harder to reverse (a whole
// routine, a library exercise, a photo) goes through ConfirmModal instead.
// `danger={false}` swaps the red armed styling for a neutral blue one, for
// actions (like sign-out) that need the same friction but destroy no data.
function ConfirmDeleteButton({
  onConfirm,
  label,
  idleLabel = `Delete ${label}`,
  armedLabel = `Tap again to confirm deleting ${label}`,
  children = <CloseIcon className="h-4 w-4" />,
  armedChildren,
  disabled = false,
  danger = true,
  className = '',
  idleClassName = 'text-chalk-dim hover:text-danger',
  armedClassName = '',
}) {
  const [armed, setArmed] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  function handleClick() {
    if (!armed) {
      setArmed(true)
      timeoutRef.current = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS)
      return
    }
    clearTimeout(timeoutRef.current)
    setArmed(false)
    onConfirm()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onBlur={() => setArmed(false)}
        disabled={disabled}
        aria-label={armed ? armedLabel : idleLabel}
        className={
          armed
            ? `${className} ${armedClassName} scale-105 font-bold ${
                danger ? 'text-danger ring-1 ring-danger/50' : 'text-blue-400 ring-1 ring-blue-500/50'
              }`
            : `${className} ${idleClassName}`
        }
      >
        {armed ? (armedChildren ?? children) : children}
      </button>
      {/* Announces the arm/disarm transition for screen-reader users, since
          the button's own aria-label change alone isn't announced without a
          focus move. */}
      <span className="sr-only" role="status" aria-live="polite">
        {armed ? armedLabel : ''}
      </span>
    </>
  )
}

export default ConfirmDeleteButton
