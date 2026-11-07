// Run: node supabase/functions/creatine-reminder/reminder.check.js
import assert from 'node:assert/strict'
import { localDateAndHour, reminderDate } from './reminder.js'

const tz = 'America/New_York' // UTC-4 on this date (EDT)
const at = (iso) => new Date(iso)

assert.deepEqual(localDateAndHour(at('2026-06-01T14:00:00Z'), tz), { date: '2026-06-01', hour: 10 })
// 01:30 UTC is still the previous evening in New York.
assert.deepEqual(localDateAndHour(at('2026-06-02T01:30:00Z'), tz), { date: '2026-06-01', hour: 21 })
// Midnight renders as 0, not 24.
assert.equal(localDateAndHour(at('2026-06-01T04:00:00Z'), tz).hour, 0)

assert.equal(reminderDate(at('2026-06-01T13:00:00Z'), tz, null), null, '9am: too early')
assert.equal(reminderDate(at('2026-06-01T14:00:00Z'), tz, null), '2026-06-01', '10am: first reminder')
assert.equal(reminderDate(at('2026-06-02T03:00:00Z'), tz, null), '2026-06-01', '11pm: last reminder')
assert.equal(reminderDate(at('2026-06-02T04:00:00Z'), tz, null), null, 'midnight: stop')

const lastSent = '2026-06-01T14:00:05Z'
assert.equal(reminderDate(at('2026-06-01T14:20:00Z'), tz, lastSent), null, 'already sent this hour')
assert.equal(reminderDate(at('2026-06-01T15:00:00Z'), tz, lastSent), '2026-06-01', 'next hour sends')

assert.throws(() => reminderDate(new Date(), 'Not/AZone', null), RangeError)

console.log('reminder checks passed')
