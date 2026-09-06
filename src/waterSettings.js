const STORAGE_KEY = 'gym-tracker:water-settings'

export const DEFAULT_BOTTLE_SIZE_ML = 750

function defaults() {
  return { mode: 'volume', bottleSizeMl: DEFAULT_BOTTLE_SIZE_ML }
}

export function loadWaterSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return { ...defaults(), ...stored }
  } catch {
    return defaults()
  }
}

export function saveWaterSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
