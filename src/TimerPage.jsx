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
  running: 'Resting…',
  paused: 'Paused',
  finished: 'Time’s up!',
}

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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            type="button"
            onClick={() => selectDuration(preset.seconds)}
            className={`rounded-2xl py-3 text-sm font-semibold ${
              duration === preset.seconds
                ? 'bg-blue-500 text-white'
                : 'bg-neutral-900 text-neutral-300 active:bg-neutral-800'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <input
            type="number"
            min="1"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Custom seconds"
            className="w-full min-w-0 rounded-xl border border-neutral-800 bg-neutral-800/60 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-200 active:bg-neutral-700"
          >
            Set
          </button>
        </form>
      </Card>

      <Card
        className={`flex flex-col items-center gap-2 p-8 transition ${
          isFinished ? 'bg-emerald-500/10 ring-2 ring-emerald-500' : ''
        }`}
      >
        <p className={`text-sm ${isFinished ? 'text-emerald-400' : 'text-neutral-500'}`}>
          {STATUS_LABEL[status]}
        </p>
        <p
          className={`text-7xl font-bold tabular-nums ${
            isFinished ? 'animate-pulse text-emerald-400' : 'text-white'
          }`}
        >
          {formatTime(remaining)}
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={status === 'running'}
          className="rounded-2xl bg-blue-500 py-4 text-base font-semibold text-white active:bg-blue-600 disabled:pointer-events-none disabled:opacity-40"
        >
          {status === 'paused' ? 'Resume' : 'Start'}
        </button>
        <button
          type="button"
          onClick={handlePause}
          disabled={status !== 'running'}
          className="rounded-2xl bg-neutral-900 py-4 text-base font-semibold text-white active:bg-neutral-800 disabled:pointer-events-none disabled:opacity-40"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-2xl bg-neutral-900 py-4 text-base font-semibold text-neutral-300 active:bg-neutral-800"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export default TimerPage
