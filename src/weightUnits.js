const KG_PER_LB = 0.45359237

export function kgToLb(kg) {
  return kg / KG_PER_LB
}

export function lbToKg(lb) {
  return lb * KG_PER_LB
}

export function convertWeight(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value
  return toUnit === 'kg' ? lbToKg(value) : kgToLb(value)
}

export function roundWeight(value) {
  return Math.round(value * 10) / 10
}

export function toDisplayWeight(weightKg, unit) {
  return roundWeight(convertWeight(weightKg, 'kg', unit))
}

export function toStorageWeightKg(displayValue, unit) {
  const numeric = Number(displayValue)
  return unit === 'kg' ? numeric : convertWeight(numeric, 'lb', 'kg')
}
