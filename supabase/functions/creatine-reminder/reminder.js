// Local hours (inclusive) during which an unchecked creatine box gets a push.
export const FIRST_HOUR = 10
export const LAST_HOUR = 23

// Cron runs hourly; anything sent within this window counts as "already nagged this hour",
// which also makes stray/duplicate invocations harmless.
const MIN_GAP_MS = 50 * 60 * 1000

export function localDateAndHour(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}

// The subscriber's local YYYY-MM-DD to check creatine_logs against, or null if they shouldn't be
// reminded right now. Throws RangeError for an unknown time zone.
export function reminderDate(now, timeZone, lastNotifiedAt) {
  const { date, hour } = localDateAndHour(now, timeZone)
  if (hour < FIRST_HOUR || hour > LAST_HOUR) return null
  if (lastNotifiedAt && now - new Date(lastNotifiedAt) < MIN_GAP_MS) return null
  return date
}
