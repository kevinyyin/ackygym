const KG_PER_LB = 0.45359237

export function convertWeight(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value
  return toUnit === 'kg' ? value * KG_PER_LB : value / KG_PER_LB
}

export function roundWeight(value) {
  return Math.round(value * 10) / 10
}

export function toDisplayWeight(weightKg, unit) {
  return roundWeight(convertWeight(weightKg, 'kg', unit))
}

export function toStorageWeightKg(displayValue, unit) {
  return convertWeight(Number(displayValue), unit, 'kg')
}

// A typed weight re-expressed after a unit flip; blank or non-numeric input
// is left as typed.
export function convertWeightInput(input, fromUnit, toUnit) {
  const numeric = Number(input)
  return input === '' || Number.isNaN(numeric) ? input : String(roundWeight(convertWeight(numeric, fromUnit, toUnit)))
}
