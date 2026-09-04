export const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', hint: 'little or no exercise', multiplier: 1.2 },
  { value: 'light', label: 'Light', hint: 'exercise 1-3 days/week', multiplier: 1.375 },
  { value: 'moderate', label: 'Moderate', hint: 'exercise 3-5 days/week', multiplier: 1.55 },
  { value: 'active', label: 'Active', hint: 'exercise 6-7 days/week', multiplier: 1.725 },
  { value: 'very_active', label: 'Very active', hint: 'hard exercise daily', multiplier: 1.9 },
]

export const GOAL_ADJUSTMENT_KCAL = 500

export function cmToIn(cm) {
  return cm / 2.54
}

export function inToCm(inches) {
  return inches * 2.54
}

// Mifflin-St Jeor equation.
export function calculateBMR({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function getProfileStorageKey(userId) {
  return `gym-tracker:calorie-calc-profile:${userId}`
}

export function loadStoredProfile(userId) {
  try {
    const raw = localStorage.getItem(getProfileStorageKey(userId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function calculateCalorieTargets({ weightKg, heightCm, age, sex, activityLevel, goal }) {
  const bmr = calculateBMR({ weightKg, heightCm, age, sex })
  const activity = ACTIVITY_LEVELS.find((a) => a.value === activityLevel) ?? ACTIVITY_LEVELS[0]
  const maintenance = bmr * activity.multiplier
  const delta = goal === 'lose' ? -GOAL_ADJUSTMENT_KCAL : goal === 'gain' ? GOAL_ADJUSTMENT_KCAL : 0

  return {
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
    target: Math.round(maintenance + delta),
  }
}
