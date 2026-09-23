import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { snappy } from './motionPresets'

// iOS segmented control. The thumb is a shared-layout element, so switching
// segments slides it rather than blinking it. layoutId must be unique per
// control on screen.
function SegmentedControl({ segments, value, onChange, layoutId }) {
  const thumb = (
    <motion.span
      layoutId={layoutId}
      transition={snappy}
      className="absolute inset-0 rounded-full bg-surface-2 shadow-[0_1px_4px_var(--shadow-tint)] [html[data-theme=light]_&]:bg-ink"
    />
  )
  const segmentClass = (active) =>
    `relative flex h-8 flex-1 items-center justify-center rounded-full text-[13px] font-semibold after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] ${
      active ? 'text-chalk' : 'text-chalk-dim'
    }`

  return (
    <div className="flex rounded-full bg-surface p-0.5">
      {segments.map((segment) =>
        segment.to ? (
          <NavLink key={segment.key} to={segment.to} end={segment.end} data-press className={({ isActive }) => segmentClass(isActive)}>
            {({ isActive }) => (
              <>
                {isActive && thumb}
                <span className="relative">{segment.label}</span>
              </>
            )}
          </NavLink>
        ) : (
          <button
            key={segment.key}
            type="button"
            data-press
            aria-pressed={value === segment.key}
            onClick={() => onChange(segment.key)}
            className={segmentClass(value === segment.key)}
          >
            {value === segment.key && thumb}
            <span className="relative">{segment.label}</span>
          </button>
        )
      )}
    </div>
  )
}

export default SegmentedControl
