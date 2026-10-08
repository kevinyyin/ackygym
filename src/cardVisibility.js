const STORAGE_KEY = 'gym-tracker:card-visibility'

export const TOGGLEABLE_CARDS = [
  { key: 'water', label: 'Water tracker' },
  { key: 'creatine', label: 'Creatine check' },
  { key: 'calorie', label: 'Calorie calculator' },
  { key: 'calorieTracker', label: 'Calorie tracker' },
]

function defaults() {
  return Object.fromEntries(TOGGLEABLE_CARDS.map((card) => [card.key, true]))
}

export function loadCardVisibility() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return { ...defaults(), ...stored }
  } catch {
    return defaults()
  }
}

export function saveCardVisibility(visibility) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility))
}
