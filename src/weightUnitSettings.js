const STORAGE_KEY = 'gym-tracker:weight-unit'

export const DEFAULT_WEIGHT_UNIT = 'kg'

export function loadWeightUnit() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'lb' ? 'lb' : DEFAULT_WEIGHT_UNIT
}

export function saveWeightUnit(unit) {
  localStorage.setItem(STORAGE_KEY, unit)
}
