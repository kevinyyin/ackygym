import { useEffect, useRef, useState } from 'react'
import Card from './Card'

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

function playAlertSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return

  const ctx = new AudioContextClass()
  const beepCount = 3
  const beepDuration = 0.15
  const gap = 0.15

  for (let i = 0; i < beepCount; i++) {
    const startTime = ctx.currentTime + i * (beepDuration + gap)
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gainNode.gain.setValueAtTime(0.0001, startTime)
    gainNode.gain.exponentialRampToValueAtTime(0.3, startTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + beepDuration)
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.start(startTime)
    oscillator.stop(startTime + beepDuration)
  }

  setTimeout(() => ctx.close(), (beepCount * (beepDuration + gap) + 0.2) * 1000)
}

function TimerPage() {
  const [duration, setDuration] = useState(60)
  const [remaining, setRemaining] = useState(60)
  const [status, setStatus] = useState('idle')
  const [customValue, setCustomValue] = useState('')
  const endTimeRef = useRef(null)

  useEffect(() => {
    if (status !== 'running') return

    function tick() {
      const secondsLeft = (endTimeRef.current - Date.now()) / 1000
      if (secondsLeft <= 0) {
        setRemaining(0)
        setStatus('finished')
        playAlertSound()
        return
      }
      setRemaining(Math.ceil(secondsLeft))
    }

    tick()
    const intervalId = setInterval(tick, 250)

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [status])

  function selectDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    endTimeRef.current = null
    setDuration(seconds)
    setRemaining(seconds)
    setStatus('idle')
  }

  function handleCustomSubmit(e) {
    e.preventDefault()
    selectDuration(Math.round(Number(customValue)))
    setCustomValue('')
  }

  function handleStart() {
    const secondsToRun = status === 'paused' ? remaining : duration
    endTimeRef.current = Date.now() + secondsToRun * 1000
    setRemaining(secondsToRun)
    setStatus('running')
  }

  function handlePause() {
    if (status !== 'running') return
    const secondsLeft = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000))
    endTimeRef.current = null
    setRemaining(secondsLeft)
    setStatus('paused')
  }

  function handleReset() {
    endTimeRef.current = null
    setRemaining(duration)
    setStatus('idle')
  }

  const isFinished = status === 'finished'
  const fraction = duration > 0 ? remaining / duration : 0
  const dialColor = isFinished ? 'var(--color-blue-300)' : 'var(--color-blue-500)'

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            type="button"
            onClick={() => selectDuration(preset.seconds)}
            className={`rounded-md border py-3 font-mono text-sm font-semibold ${
              duration === preset.seconds
                ? 'border-blue-500 bg-blue-500 text-chalk'
                : 'border-line bg-surface text-chalk-dim active:border-blue-500'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Card className="p-3">
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
      </Card>

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
              className={`font-mono text-6xl font-bold tabular-nums ${
                isFinished ? 'text-blue-300' : 'text-chalk'
              }`}
            >
              {formatTime(remaining)}
            </p>
            <p
              className={`mt-2 font-mono text-xs tracking-[0.3em] uppercase ${
                isFinished ? 'text-blue-300' : 'text-chalk-dim'
              }`}
            >
              {STATUS_LABEL[status]}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={status === 'running'}
          className="rounded-md bg-blue-500 py-4 font-body text-base font-bold text-chalk active:bg-blue-600 disabled:pointer-events-none disabled:opacity-40"
        >
          {status === 'paused' ? 'Resume' : 'Start'}
        </button>
        <button
          type="button"
          onClick={handlePause}
          disabled={status !== 'running'}
          className="rounded-md border border-line bg-surface py-4 font-body text-base font-semibold text-chalk active:border-blue-500 disabled:pointer-events-none disabled:opacity-40"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-md border border-line bg-surface py-4 font-body text-base font-semibold text-chalk-dim active:border-blue-500 active:text-blue-400"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export default TimerPage
