const STORAGE_KEY = 'gym-tracker:auto-rest'

export function loadAutoRest() {
  return localStorage.getItem(STORAGE_KEY) !== 'false'
}

export function saveAutoRest(enabled) {
  localStorage.setItem(STORAGE_KEY, String(enabled))
}

const DURATION_KEY = 'gym-tracker:rest-duration'

export const REST_PRESETS = [
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
]

export function loadRestDuration() {
  const seconds = Number(localStorage.getItem(DURATION_KEY))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 60
}

export function saveRestDuration(seconds) {
  localStorage.setItem(DURATION_KEY, String(seconds))
}
