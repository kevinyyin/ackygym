import { displayName } from './displayName'

export function sortProfilesSelfFirst(profiles, currentUserId) {
  return [...profiles].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return displayName(a).localeCompare(displayName(b))
  })
}

export function groupByUser(rows, profiles, currentUserId, itemsKey = 'items') {
  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p]))

  const byUserId = new Map()
  for (const row of rows) {
    if (!byUserId.has(row.user_id)) byUserId.set(row.user_id, [])
    byUserId.get(row.user_id).push(row)
  }

  return [...byUserId.entries()]
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
