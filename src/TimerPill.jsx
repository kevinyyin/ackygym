import { AnimatePresence, motion } from 'motion/react'
import { smooth } from './motionPresets'

const RING_RADIUS = 9
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(clamped / 60)}:${String(clamped % 60).padStart(2, '0')}`
}

// Floats above the tab bar on every tab whenever a rest is in progress, so
// the countdown is never more than a glance away mid-workout.
//
// Wrapped in a non-motion positioning div rather than positioning the
// motion.button itself: motion writes `transform` inline for its own
// animation, which would override Tailwind's -translate-x-1/2 and render
// the pill off-center.
function TimerPill({ timer, onOpen }) {
  const { status, remaining, duration } = timer
  const visible = status !== 'idle'
  const finished = status === 'finished'
  const fraction = duration > 0 ? remaining / duration : 0

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-20 flex justify-center">
      <AnimatePresence>
        {visible && (
          <motion.button
            key="timer-pill"
            type="button"
            data-press
            onClick={onOpen}
            aria-label={finished ? 'Rest finished — open timer' : `Rest timer, ${formatTime(remaining)} left — open timer`}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            whileTap={{ scale: 0.96 }}
            transition={smooth}
            className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-surface-2 py-2.5 pr-4 pl-3 text-[15px] font-semibold shadow-[0_10px_30px_var(--shadow-tint)]"
          >
            <svg viewBox="0 0 22 22" className="h-[22px] w-[22px] -rotate-90">
              <circle cx="11" cy="11" r={RING_RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="3" />
              <circle
                cx="11"
                cy="11"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--color-blue-400)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={finished ? 0 : RING_CIRCUMFERENCE * (1 - fraction)}
                className="transition-[stroke-dashoffset] duration-200 ease-linear"
              />
            </svg>
            <span className="tabular-nums">{finished ? 'Done' : formatTime(remaining)}</span>
            <span className="font-medium text-chalk-dim">{status === 'paused' ? 'Paused' : 'Rest'}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TimerPill
