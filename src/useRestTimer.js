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
  const [remaining, setRemaining] = useState(duration)
  const [status, setStatus] = useState('idle')
  const endTimeRef = useRef(null)
  const audioCtxRef = useRef(null)

  // AudioContext playback started outside a user gesture is silently
  // blocked on iOS Safari. Creating/resuming it here — inside the Start
  // button's own click handler — unlocks it for the later, gesture-less
  // setInterval callback that actually plays the alert.
  function unlockAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass()
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
  }

  useEffect(() => {
    if (status !== 'running') return

    function tick() {
      const secondsLeft = (endTimeRef.current - Date.now()) / 1000
      if (secondsLeft <= 0) {
        setRemaining(0)
        setStatus('finished')
        playAlert(audioCtxRef.current)
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
    saveRestDuration(seconds)
    endTimeRef.current = null
    setDuration(seconds)
    setRemaining(seconds)
    setStatus('idle')
  }

  function start() {
    unlockAudio()
    const secondsToRun = status === 'paused' ? remaining : duration
    endTimeRef.current = Date.now() + secondsToRun * 1000
    setRemaining(secondsToRun)
    setStatus('running')
  }

  function pause() {
    if (status !== 'running') return
    const secondsLeft = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000))
    endTimeRef.current = null
    setRemaining(secondsLeft)
    setStatus('paused')
  }

  function reset() {
    endTimeRef.current = null
    setRemaining(duration)
    setStatus('idle')
  }

  // For auto-rest after logging a set: always a fresh full countdown, even
  // mid-rest or paused. start() can't do this — it resumes from `remaining`
  // when paused, and reads `status` from this render's closure.
  function restart() {
    unlockAudio()
    endTimeRef.current = Date.now() + duration * 1000
    setRemaining(duration)
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

  return { duration, remaining, status, selectDuration, start, pause, reset, restart }
}
