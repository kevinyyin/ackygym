import { motion } from 'motion/react'
import { snappy } from './motionPresets'
import { ChevronRightIcon } from './icons'

// `onPress` (not onClick) makes the card a pressable tile — onClick is
// still passed through untouched for the existing callers that use it to
// stop propagation inside overlays.
function Card({ className = '', onPress, chevron = false, children, ...rest }) {
  const base = `rounded-card bg-surface ${className}`

  if (!onPress) {
    return (
      <div className={base} {...rest}>
        {children}
      </div>
    )
  }

  return (
    <motion.button
      data-press
      type="button"
      onClick={onPress}
      whileTap={{ scale: 0.98 }}
      transition={snappy}
      className={`flex w-full items-center gap-3 text-left ${base}`}
      {...rest}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {chevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-chalk-dim" />}
    </motion.button>
  )
}

export default Card
