export function isValidSet({ weight, reps }) {
  return Number(weight) >= 0 && Number(reps) >= 1
}

export function isPositiveNumber(value) {
  return Number(value) > 0
}
