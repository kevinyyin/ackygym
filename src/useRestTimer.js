import { useEffect, useRef, useState } from 'react'
import { loadRestDuration, saveRestDuration } from './autoRestSettings'

function beep(ctx, startTime) {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gainNode.gain.setValueAtTime(0.0001, startTime)
  gainNode.gain.exponentialRampToValueAtTime(0.3, startTime + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.15)
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + 0.15)
}

function playAlert(ctx) {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
  if (!ctx) return

  const beepCount = 3
  const beepDuration = 0.15
  const gap = 0.15
  for (let i = 0; i < beepCount; i++) {
    beep(ctx, ctx.currentTime + i * (beepDuration + gap))
  }
}

// Lifted out of TimerPanel so the countdown keeps running (and fires its
// alert at the right wall-clock moment) no matter which tab is on screen —
// a component-local timer is destroyed the instant the user taps away to
// log a set mid-rest, which is the single most common thing to do while
// resting.
export function useRestTimer() {
  const [duration, setDuration] = useState(loadRestDuration)
  // While running, the countdown is stored as an end time and ticked only by
  // useRemaining() in the pill/panel. Ticking `remaining` here re-rendered App
  // — and with it every page on screen — every second of every rest.
  const [endTime, setEndTime] = useState(null)
  // Seconds left when last paused, or when the current run started.
  const [startRemaining, setStartRemaining] = useState(duration)
  const [status, setStatus] = useState('idle')
  const audioCtxRef = useRef(null)

  // AudioContext playback started outside a user gesture is silently
  // blocked on iOS Safari. Creating/resuming it here — inside the Start
  // button's own click handler — unlocks it for the later, gesture-less
  // timeout callback that actually plays the alert.
  function unlockAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass()
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
  }

  useEffect(() => {
    if (status !== 'running') return

    let done = false
    function finishIfDue() {
      if (done || Date.now() < endTime) return
      done = true
      setStatus('finished')
      playAlert(audioCtxRef.current)
    }

    // Backgrounded tabs throttle timers; the visibility check catches up on return.
    const timeoutId = setTimeout(finishIfDue, endTime - Date.now())
    document.addEventListener('visibilitychange', finishIfDue)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', finishIfDue)
    }
  }, [status, endTime])

  function selectDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    saveRestDuration(seconds)
    setDuration(seconds)
    setStatus('idle')
  }

  function start() {
    unlockAudio()
    const secondsToRun = status === 'paused' ? startRemaining : duration
    setStartRemaining(secondsToRun)
    setEndTime(Date.now() + secondsToRun * 1000)
    setStatus('running')
  }

  function pause() {
    if (status !== 'running') return
    setStartRemaining(Math.max(0, Math.round((endTime - Date.now()) / 1000)))
    setStatus('paused')
  }

  function reset() {
    setStatus('idle')
  }

  // For auto-rest after logging a set: always a fresh full countdown, even
  // mid-rest or paused. start() can't do this — it resumes from the paused
  // remainder, and reads `status` from this render's closure.
  function restart() {
    unlockAudio()
    setStartRemaining(duration)
    setEndTime(Date.now() + duration * 1000)
    setStatus('running')
  }

  // restart() usually runs after an awaited Supabase insert — no longer
  // inside a user gesture, so iOS Safari won't let it create/resume the
  // AudioContext. Unlocking on the app's first tap means the alert can
  // still play when an auto-started rest finishes.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockAudio)
  }, [])

  // Static; while running useRemaining() derives the live value from endTime.
  const remaining =
    status === 'idle' ? duration : status === 'finished' ? 0 : startRemaining

  return { duration, remaining, endTime, status, selectDuration, start, pause, reset, restart }
}

// Live seconds left, re-rendering only the component that calls it.
export function useRemaining({ status, endTime, remaining }) {
  // Tagged with the endTime it was measured against, so a new run shows its
  // starting value until the first tick instead of the last run's leftover.
  const [tick, setTick] = useState({ endTime: null, seconds: 0 })

  useEffect(() => {
    if (status !== 'running') return
    const intervalId = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
      setTick((prev) => (prev.endTime === endTime && prev.seconds === seconds ? prev : { endTime, seconds }))
    }, 250)
    return () => clearInterval(intervalId)
  }, [status, endTime])

  return status === 'running' && tick.endTime === endTime ? tick.seconds : remaining
}
