import { useState } from 'react'
import Card from './Card'
import Button from './Button'
import SegmentedControl from './SegmentedControl'

const PRESETS = [
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
]

const STATUS_LABEL = {
  idle: 'Ready',
  running: 'Resting',
  paused: 'Paused',
  finished: 'Time’s up',
}

const DIAL_RADIUS = 82
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS
const DIAL_TICKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * 30 * Math.PI) / 180
  const outer = 94
  const inner = i % 3 === 0 ? 80 : 87
  return {
    x1: 100 + outer * Math.sin(angle),
    y1: 100 - outer * Math.cos(angle),
    x2: 100 + inner * Math.sin(angle),
    y2: 100 - inner * Math.cos(angle),
    major: i % 3 === 0,
  }
})

function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function TimerPanel({ duration, remaining, status, selectDuration, onStart, onPause, onReset }) {
  const [customValue, setCustomValue] = useState('')

  function handleCustomSubmit(e) {
    e.preventDefault()
    selectDuration(Math.round(Number(customValue)))
    setCustomValue('')
  }

  const isFinished = status === 'finished'
  const fraction = duration > 0 ? remaining / duration : 0
  const dialColor = isFinished ? 'var(--color-blue-300)' : 'var(--color-blue-500)'

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        layoutId="timer-presets"
        value={duration}
        onChange={selectDuration}
        segments={PRESETS.map((p) => ({ key: p.seconds, label: p.label }))}
      />

      <form onSubmit={handleCustomSubmit} className="flex gap-2">
        <input
          type="number"
          min="1"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          placeholder="Custom seconds"
          className="w-full min-w-0 rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-line bg-surface-2 px-4 py-2 font-body text-sm font-semibold text-chalk-dim active:border-blue-500 active:text-blue-400"
        >
          Set
        </button>
      </form>

      <Card
        className={`flex flex-col items-center gap-1 border-0 bg-transparent py-4 transition ${
          isFinished ? 'motion-safe:animate-pulse' : ''
        }`}
      >
        <div className="relative flex h-64 w-64 items-center justify-center">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            {DIAL_TICKS.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="var(--color-line)"
                strokeWidth={t.major ? 2.5 : 1.25}
                strokeLinecap="round"
              />
            ))}
            <circle
              cx="100"
              cy="100"
              r={DIAL_RADIUS}
              fill="none"
              stroke="var(--color-surface-2)"
              strokeWidth="10"
            />
            <circle
              cx="100"
              cy="100"
              r={DIAL_RADIUS}
              fill="none"
              stroke={dialColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={DIAL_CIRCUMFERENCE}
              strokeDashoffset={DIAL_CIRCUMFERENCE * (1 - fraction)}
              transform="rotate(-90 100 100)"
              className="transition-[stroke-dashoffset] duration-200 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p
              className={`text-hero tabular-nums ${
                isFinished ? 'text-blue-300' : 'text-chalk'
              }`}
            >
              {formatTime(remaining)}
            </p>
            <p
              className={`mt-2 text-caption ${
                isFinished ? 'text-blue-300' : 'text-chalk-dim'
              }`}
            >
              {STATUS_LABEL[status]}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <Button size="lg" onClick={onStart} disabled={status === 'running'}>
          {status === 'paused' ? 'Resume' : 'Start'}
        </Button>
        <Button size="lg" variant="secondary" onClick={onPause} disabled={status !== 'running'}>
          Pause
        </Button>
        <Button size="lg" variant="secondary" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  )
}

export default TimerPanel
