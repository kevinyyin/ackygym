export const MUSCLE_GROUP_ORDER = [
  'chest',
  'back',
  'lats',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
  'lower_back',
  'neck',
]

export function sortMuscleGroups(muscleGroups) {
  return [...muscleGroups].sort(
    (a, b) => MUSCLE_GROUP_ORDER.indexOf(a.name) - MUSCLE_GROUP_ORDER.indexOf(b.name)
  )
}
