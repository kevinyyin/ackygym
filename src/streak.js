import { toDateString } from './dateUtils.js'

const STREAK_WINDOW_DAYS = 90

// Workout days in a row, walking back from today. `scheduledDays` holds the
// weekdays (0 = Sun) the user has a routine on: a missed day only breaks the
// streak if it was scheduled, so planned rest days don't reset it. With no
// schedule at all, every day counts (plain consecutive days).
export function computeStreak(workoutDates, scheduledDays, today = new Date()) {
  let streak = 0
  const cursor = new Date(today)

  for (let daysAgo = 0; daysAgo < STREAK_WINDOW_DAYS; daysAgo++) {
    const isScheduled = scheduledDays.size === 0 || scheduledDays.has(cursor.getDay())

    if (workoutDates.has(toDateString(cursor))) {
      streak++
    } else if (daysAgo > 0 && isScheduled) {
      break
    }
    // Today not logged yet (the day isn't over), or an unscheduled rest day:
    // neither extends nor breaks the streak.

    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}
