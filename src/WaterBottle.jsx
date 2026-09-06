import { useId } from 'react'

const BOTTLE_PATH =
  'M38 18 H62 V34 Q86 34 90 60 V154 Q90 168 76 168 H24 Q10 168 10 154 V60 Q14 34 38 34 V18 Z'
const HANDLE_PATH = 'M44 18 Q44 4 50 4 Q56 4 56 18'
const WAVE_PATH = 'M-10 0 C15 -6 35 6 60 0 C85 -6 105 6 130 0 L130 200 L-10 200 Z'

// Fill travels between the bottle floor and just into the neck, so a "full"
// bottle reads as full rather than stopping short at the shoulder.
const FILL_BOTTOM = 168
const FILL_TOP = 26

function WaterBottle({ progress, className }) {
  const gradientId = useId()
  const clipId = useId()
  const clamped = Math.min(Math.max(progress, 0), 1)
  const fillY = FILL_BOTTOM - clamped * (FILL_BOTTOM - FILL_TOP)

  return (
    <svg viewBox="0 0 100 172" className={className} role="img" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={BOTTLE_PATH} />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-blue-400)" />
          <stop offset="100%" stopColor="var(--color-blue-600)" />
        </linearGradient>
      </defs>

      <path d={BOTTLE_PATH} fill="var(--color-surface-2)" stroke="var(--color-line)" strokeWidth="2" />

      <g clipPath={`url(#${clipId})`}>
        <g
          style={{
            transform: `translateY(${fillY}px)`,
            transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <path className="water-wave" d={WAVE_PATH} fill={`url(#${gradientId})`} />
        </g>
      </g>

      <path d={BOTTLE_PATH} fill="none" stroke="var(--color-line)" strokeWidth="2" />
      <path d={HANDLE_PATH} fill="none" stroke="var(--color-line)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default WaterBottle
