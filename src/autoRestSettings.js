const STORAGE_KEY = 'gym-tracker:auto-rest'

export function loadAutoRest() {
  return localStorage.getItem(STORAGE_KEY) !== 'false'
}

export function saveAutoRest(enabled) {
  localStorage.setItem(STORAGE_KEY, String(enabled))
}
