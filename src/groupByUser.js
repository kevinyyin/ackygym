import { displayName } from './displayName'

// Map.groupBy (keys in first-seen order), minus its iOS 17.4 floor.
export function groupBy(list, keyOf) {
  const groups = new Map()
  for (const item of list) {
    const key = keyOf(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return groups
}

export function groupSetsByDate(sets) {
  return [...groupBy(sets, (set) => set.workouts.date)].map(([date, daySets]) => ({ date, sets: daySets }))
}

export function groupSetsByExercise(sets) {
  return [...groupBy(sets, (set) => set.exercise_id)].map(([exerciseId, exerciseSets]) => ({
    exerciseId,
    name: exerciseSets[0].exercises.name,
    sets: exerciseSets,
  }))
}

export function sortProfilesSelfFirst(profiles, currentUserId) {
  return [...profiles].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return displayName(a).localeCompare(displayName(b))
  })
}

export function groupByUser(rows, profiles, currentUserId, itemsKey = 'items') {
  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return [...groupBy(rows, (row) => row.user_id)]
    .map(([userId, items]) => ({
      userId,
      name: profileByUserId[userId] ? displayName(profileByUserId[userId]) : userId,
      [itemsKey]: items,
    }))
    .sort((a, b) => {
      if (a.userId === currentUserId) return -1
      if (b.userId === currentUserId) return 1
      return a.name.localeCompare(b.name)
    })
}
