import { sortMuscleGroups } from './muscleGroupOrder'

// An exercise's group for display purposes: its primary muscle (falling back
// to secondary), matching the convention used elsewhere (see LiftsPage.jsx).
export function primaryMuscleGroup(exercise) {
  const muscles = exercise?.exercise_muscles || []
  for (const role of ['primary', 'secondary']) {
    const candidates = muscles
      .filter((m) => m.role === role)
      .map((m) => ({ name: m.muscle, label: m.muscle_groups?.label ?? m.muscle }))
    if (candidates.length > 0) return sortMuscleGroups(candidates)[0]
  }
  return { name: null, label: 'Other' }
}

// Buckets items by their exercise's main muscle group, ordered via
// MUSCLE_GROUP_ORDER with ungrouped ("Other") items last. Within a bucket,
// items keep their relative order from the input list.
export function groupByMuscle(list, getExercise) {
  const buckets = new Map()
  for (const item of list) {
    const group = primaryMuscleGroup(getExercise(item))
    const key = group.name ?? '__other__'
    if (!buckets.has(key)) buckets.set(key, { key, name: group.name, label: group.label, items: [] })
    buckets.get(key).items.push(item)
  }
  const groups = [...buckets.values()]
  const named = groups.filter((g) => g.key !== '__other__')
  const other = groups.find((g) => g.key === '__other__')
  const sortedNamed = sortMuscleGroups(named)
  return other ? [...sortedNamed, other] : sortedNamed
}
