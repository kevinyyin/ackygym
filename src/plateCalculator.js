export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
export const STANDARD_BAR_KG = 20

export const STANDARD_PLATES_LB = [45, 35, 25, 10, 5, 2.5]
export const STANDARD_BAR_LB = 45

const EPSILON = 0.001

export function calculatePlates(targetWeight, barWeight, availablePlates) {
  const perSide = (targetWeight - barWeight) / 2

  if (!(perSide > 0)) {
    return {
      platesPerSide: [],
      achievedWeight: barWeight,
      remainder: Math.max(0, targetWeight - barWeight),
    }
  }

  let remaining = perSide
  const platesPerSide = []
  const sorted = [...availablePlates].sort((a, b) => b - a)

  for (const plate of sorted) {
    while (remaining >= plate - EPSILON) {
      platesPerSide.push(plate)
      remaining -= plate
    }
  }

  const usedPerSide = platesPerSide.reduce((sum, p) => sum + p, 0)

  return {
    platesPerSide,
    achievedWeight: barWeight + usedPerSide * 2,
    remainder: remaining > EPSILON ? remaining * 2 : 0,
  }
}
