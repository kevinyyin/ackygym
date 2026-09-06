import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { WEEKDAY_SHORT } from './weekdays'
import { toDateString, formatDate } from './dateUtils'
import { displayName } from './displayName'
import { sortProfilesSelfFirst } from './groupByUser'
import Card from './Card'
import WorkoutDayModal from './WorkoutDayModal'

const DOT_COLORS = ['bg-blue-400', 'bg-emerald', 'bg-amber', 'bg-purple']
const STREAK_WINDOW_DAYS = 90

const WEEKS_COUNT = 53
const DAYS_COUNT = WEEKS_COUNT * 7
const CELL_PX = 13
const GAP_PX = 3
const COLUMN_PITCH_PX = CELL_PX + GAP_PX
const LEVEL_COUNT = 4
const LABELED_WEEKDAYS = new Set([1, 3, 5]) // Mon, Wed, Fri

// Contribution grid spans the trailing 53 weeks (Sun..Sat columns) ending
// on the Saturday of the current week, matching GitHub's contribution graph.
function getContributionRange() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()))

  const start = new Date(endOfWeek)
  start.setDate(endOfWeek.getDate() - (DAYS_COUNT - 1))

  return { today, start }
}

// Pure date scaffold for the grid — shared across every user's heatmap.
function buildDateScaffold(start, today) {
  const weeks = []

  for (let w = 0; w < WEEKS_COUNT; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      days.push({
        date,
        dateStr: toDateString(date),
        dayOfWeek: d,
        isFuture: date > today,
      })
    }
    weeks.push(days)
  }

  return weeks
}

function getMonthLabels(weeks) {
  const labels = []
  let lastMonth = -1

  weeks.forEach((week, weekIndex) => {
    const month = week[0].date.getMonth()
    if (month !== lastMonth) {
      labels.push({
        weekIndex,
        label: week[0].date.toLocaleDateString(undefined, { month: 'short' }),
      })
      lastMonth = month
    }
  })

  return labels
}

// Fallback scale: relative to each user's own busiest logged day (like
// GitHub's relative scale), so someone who logs 6 sets/day and someone who
// logs 30 both get a full range of shading.
function levelForSetCount(count, maxCount) {
  if (count <= 0 || maxCount <= 0) return 0
  return Math.max(1, Math.min(LEVEL_COUNT, Math.ceil((count / maxCount) * LEVEL_COUNT)))
}

// If the day's scheduled routine had any of its exercises logged, shade by
// how much of that routine got done. Otherwise fall back to the day's total
// set count relative to the user's busiest day.
function levelAndLabelFor(entry, routineExerciseIds, maxCount) {
  const total = entry?.total ?? 0
  if (total === 0) return { level: 0, label: null }

  if (routineExerciseIds && routineExerciseIds.size > 0) {
    const done = [...entry.exerciseIds].filter((id) => routineExerciseIds.has(id)).length
    if (done > 0) {
      const ratio = Math.min(1, done / routineExerciseIds.size)
      return {
        level: Math.max(1, Math.ceil(ratio * LEVEL_COUNT)),
        label: `${done}/${routineExerciseIds.size} exercises`,
      }
    }
  }

  return { level: levelForSetCount(total, maxCount), label: `${total} set${total === 1 ? '' : 's'}` }
}

function computeStreak(workoutDates) {
  let streak = 0
  const cursor = new Date()

  for (let daysAgo = 0; daysAgo < STREAK_WINDOW_DAYS; daysAgo++) {
    const dateStr = toDateString(cursor)

    if (workoutDates.has(dateStr)) {
      streak++
    } else if (daysAgo > 0) {
      break
    }
    // daysAgo === 0 (today) and not logged yet: the day isn't over,
    // so it neither extends nor breaks the streak.

    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function ContributionGraph({ weeks, monthLabels, onDayClick }) {
  const gridWidth = WEEKS_COUNT * COLUMN_PITCH_PX - GAP_PX
  const scrollRef = useRef(null)

  // The grid always ends on the current week (see getContributionRange), so
  // land scrolled all the way right on mount — otherwise the graph opens on
  // last year's data, which is never what someone opens this page to check.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  return (
    <div className="flex gap-1.5">
      <div className="flex shrink-0 flex-col gap-[3px] pt-[16px]">
        {[0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => (
          <div
            key={dayOfWeek}
            style={{ height: CELL_PX }}
            className="flex items-center font-mono text-[11px] leading-none text-chalk-dim"
          >
            {LABELED_WEEKDAYS.has(dayOfWeek) ? WEEKDAY_SHORT[dayOfWeek] : ''}
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div style={{ width: gridWidth }}>
          <div className="relative" style={{ height: 16 }}>
            {monthLabels.map(({ weekIndex, label }) => (
              <span
                key={weekIndex}
                style={{ left: weekIndex * COLUMN_PITCH_PX }}
                className="absolute font-mono text-[11px] leading-none text-chalk-dim"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map((day) =>
                  day.isFuture ? (
                    <div key={day.dateStr} style={{ height: CELL_PX, width: CELL_PX }} />
                  ) : onDayClick && day.level > 0 ? (
                    <button
                      key={day.dateStr}
                      type="button"
                      onClick={() => onDayClick(day.dateStr)}
                      title={`${day.label ?? 'No sets'} · ${formatDate(day.dateStr)} — tap to view or repeat`}
                      style={{
                        height: CELL_PX,
                        width: CELL_PX,
                        backgroundColor: `var(--color-heat-${day.level})`,
                      }}
                      className="cursor-pointer rounded-[2px]"
                    />
                  ) : (
                    <div
                      key={day.dateStr}
                      title={`${day.label ?? 'No sets'} · ${formatDate(day.dateStr)}`}
                      style={{
                        height: CELL_PX,
                        width: CELL_PX,
                        backgroundColor: `var(--color-heat-${day.level})`,
                      }}
                      className="rounded-[2px]"
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarPage({ profiles, userId, weightUnit, onError }) {
  const [dayDataByUser, setDayDataByUser] = useState(new Map())
  const [setsLoaded, setSetsLoaded] = useState(false)
  const [scheduleMap, setScheduleMap] = useState(new Map())
  const [setsVersion, setSetsVersion] = useState(0)
  const [viewingDate, setViewingDate] = useState(null)

  useEffect(() => {
    async function fetchSchedule() {
      const { data, error } = await supabase
        .from('schedule')
        .select('user_id, day_of_week, routine_id, routines(routine_exercises(exercise_id))')

      if (error) {
        onError(error.message)
        return
      }

      const map = new Map()
      for (const row of data) {
        const exerciseIds = new Set((row.routines?.routine_exercises ?? []).map((re) => re.exercise_id))
        if (exerciseIds.size === 0) continue
        map.set(`${row.user_id}:${row.day_of_week}`, exerciseIds)
      }
      setScheduleMap(map)
    }

    fetchSchedule()
  }, [onError])

  useEffect(() => {
    async function fetchSets() {
      const { start } = getContributionRange()

      const { data, error } = await supabase
        .from('sets')
        .select('id, user_id, exercise_id, workouts!inner(date)')
        .gte('workouts.date', toDateString(start))

      if (error) {
        onError(error.message)
        return
      }

      const byUser = new Map()
      for (const set of data) {
        if (!byUser.has(set.user_id)) byUser.set(set.user_id, new Map())
        const byDate = byUser.get(set.user_id)
        const entry = byDate.get(set.workouts.date) ?? { total: 0, exerciseIds: new Set() }
        entry.total += 1
        entry.exerciseIds.add(set.exercise_id)
        byDate.set(set.workouts.date, entry)
      }
      setDayDataByUser(byUser)
      setSetsLoaded(true)
    }

    fetchSets()
  }, [setsVersion, onError])

  const rows = sortProfilesSelfFirst(profiles, userId)

  const { today, start } = getContributionRange()
  const dateScaffold = buildDateScaffold(start, today)
  const monthLabels = getMonthLabels(dateScaffold)

  const streaksByUserId = Object.fromEntries(
    rows.map((profile) => {
      const dates = new Set((dayDataByUser.get(profile.id) ?? new Map()).keys())
      return [profile.id, computeStreak(dates)]
    })
  )

  if (!setsLoaded) {
    return (
      <Card className="p-4">
        <p className="text-sm text-chalk-dim">Loading…</p>
      </Card>
    )
  }

  return (
    <>
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {rows.map((profile, i) => {
          const streak = streaksByUserId[profile.id]
          return (
            <Card key={profile.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                <p className="truncate font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
                  {displayName(profile)}
                </p>
              </div>
              <p className="font-mono text-3xl font-bold text-blue-400">
                {streak}
                <span className="ml-1.5 font-body text-xs font-normal text-chalk-dim">
                  day{streak === 1 ? '' : 's'}
                </span>
              </p>
              <div className="flex gap-1">
                {Array.from({ length: 7 }, (_, tick) => (
                  <span
                    key={tick}
                    className={`h-2.5 w-1.5 rounded-[1px] ${
                      tick < Math.min(streak, 7) ? 'bg-blue-500' : 'bg-surface-2'
                    }`}
                  />
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-chalk-dim">Tap a day to view or repeat that workout.</p>

      <div className="flex flex-col gap-3">
        {rows.map((profile, i) => {
          const byDate = dayDataByUser.get(profile.id) ?? new Map()
          const maxCount = Math.max(0, ...[...byDate.values()].map((e) => e.total))

          const weeks = dateScaffold.map((week) =>
            week.map((day) => {
              if (day.isFuture) return day
              const entry = byDate.get(day.dateStr)
              const routineExerciseIds = scheduleMap.get(`${profile.id}:${day.dayOfWeek}`)
              const { level, label } = levelAndLabelFor(entry, routineExerciseIds, maxCount)
              return { ...day, level, label }
            })
          )

          return (
            <Card key={profile.id} className="p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                <p className="truncate font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
                  {displayName(profile)}
                </p>
              </div>

              <ContributionGraph
                weeks={weeks}
                monthLabels={monthLabels}
                onDayClick={profile.id === userId ? setViewingDate : undefined}
              />

              <div className="mt-1 flex items-center justify-end gap-1">
                <span className="font-mono text-[11px] text-chalk-dim">Less</span>
                {Array.from({ length: LEVEL_COUNT + 1 }, (_, level) => (
                  <span
                    key={level}
                    style={{
                      height: CELL_PX,
                      width: CELL_PX,
                      backgroundColor: `var(--color-heat-${level})`,
                    }}
                    className="rounded-[2px]"
                  />
                ))}
                <span className="font-mono text-[11px] text-chalk-dim">More</span>
              </div>
            </Card>
          )
        })}
      </div>

      <Link
        to="/history"
        className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface p-4 shadow-[inset_0_1px_0_var(--card-highlight)] active:border-blue-500"
      >
        <span className="text-sm font-medium text-chalk">Search all sets</span>
        <span className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
          Open →
        </span>
      </Link>
    </div>

    <WorkoutDayModal
      date={viewingDate}
      userId={userId}
      weightUnit={weightUnit}
      onClose={() => setViewingDate(null)}
      onError={onError}
      onRepeated={() => setSetsVersion((v) => v + 1)}
    />
    </>
  )
}

export default CalendarPage
