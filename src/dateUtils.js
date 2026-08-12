export function toDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayDateString() {
  return toDateString(new Date())
}

export function getDateDaysAgoString(daysAgo) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return toDateString(date)
}
