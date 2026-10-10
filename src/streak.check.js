// Run: node src/streak.check.js
import assert from 'node:assert/strict'
import { computeStreak } from './streak.js'

// Wed 2026-10-14. Mon/Wed/Fri schedule = weekdays 1, 3, 5.
const today = new Date(2026, 9, 14)
const mwf = new Set([1, 3, 5])
const none = new Set()
const dates = (...days) => new Set(days.map((d) => `2026-10-${String(d).padStart(2, '0')}`))

assert.equal(computeStreak(dates(14, 13, 12), none, today), 3, 'no schedule: consecutive days')
assert.equal(computeStreak(dates(13, 12), none, today), 2, 'today not logged yet neither breaks nor counts')
assert.equal(computeStreak(dates(14, 12), none, today), 1, 'no schedule: any missed day breaks')
assert.equal(computeStreak(dates(14, 12, 9, 7), mwf, today), 4, 'unscheduled rest days are skipped')
assert.equal(computeStreak(dates(14, 9, 7), mwf, today), 1, 'a missed scheduled day (Mon 12) breaks')
assert.equal(computeStreak(dates(14, 13, 12), mwf, today), 3, 'an extra unscheduled workout still counts')
assert.equal(computeStreak(dates(), mwf, today), 0)

console.log('streak: ok')
