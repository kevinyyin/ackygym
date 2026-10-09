import { motion } from 'motion/react'
import { snappy } from './motionPresets'

const VARIANTS = {
  primary: 'bg-chalk text-ink',
  secondary: 'bg-surface-2 text-chalk',
  destructive: 'bg-surface-2 text-danger',
}

// data-press opts out of index.css's global CSS :active scale so the spring
// below isn't fighting a second transform.
function Button({
  variant = 'primary',
  loading = false,
  type = 'button',
  disabled,
  className = '',
  children,
  ...rest
}) {
  return (
    <motion.button
      data-press
      type={type}
      whileTap={{ scale: 0.97 }}
      transition={snappy}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex h-[52px] w-full shrink-0 items-center justify-center rounded-full px-6 text-[17px] font-semibold disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      <span className={loading ? 'invisible' : ''}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
    </motion.button>
  )
}

export default Button
