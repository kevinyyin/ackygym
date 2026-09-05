import { useEffect, useRef, useState } from 'react'

const ARM_TIMEOUT_MS = 2500

// Tap-to-arm delete: first tap arms the button (visually distinct, no layout
// shift), a second tap within ARM_TIMEOUT_MS confirms. Guards irrecoverable
// deletes (routines, exercises, photos) against mid-workout mis-taps without
// a modal.
function ConfirmDeleteButton({
  onConfirm,
  label,
  idleLabel = `Delete ${label}`,
  armedLabel = `Tap again to confirm deleting ${label}`,
  children = '✕',
  armedChildren,
  disabled = false,
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
    <button
      type="button"
      onClick={handleClick}
      onBlur={() => setArmed(false)}
      disabled={disabled}
      aria-label={armed ? armedLabel : idleLabel}
      className={
        armed
          ? `${className} ${armedClassName} scale-105 font-bold text-danger ring-1 ring-danger/50`
          : `${className} ${idleClassName}`
      }
    >
      {armed ? (armedChildren ?? children) : children}
    </button>
  )
}

export default ConfirmDeleteButton
