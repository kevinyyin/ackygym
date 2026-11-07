import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { WEEKDAY_SHORT } from './weekdays'
import { toDateString, formatDate } from './dateUtils'
import { displayName } from './displayName'
import { sortProfilesSelfFirst } from './groupByUser'
import Card from './Card'
import SegmentedControl from './SegmentedControl'
import WorkoutDayModal from './WorkoutDayModal'
import MuscleVolume from './MuscleVolume'
import { computeStreak } from './streak'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import Skeleton from './Skeleton'
import { useCachedState } from './pageCache'
import { usePersistedState } from './usePersistedState'

const DOT_COLORS = ['bg-blue-400', 'bg-emerald', 'bg-amber', 'bg-purple']
const VIEW_SEGMENTS = [
  { key: 'heatmap', label: 'Heatmap' },
  { key: 'month', label: 'Calendar' },
]

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

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

// Sun-first 6-row grid for the given month, padded with nulls so every row
// has 7 cells — a familiar "regular calendar" layout, as opposed to the
// GitHub-style contribution grid above.
function buildMonthScaffold(monthCursor, today) {
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = toDateString(today)

  const cells = []
  for (let i = 0; i < new Date(year, month, 1).getDay(); i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = toDateString(date)
    cells.push({
      date,
      dateStr,
      dayOfWeek: date.getDay(),
      isFuture: date > today,
      isToday: dateStr === todayStr,
    })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function ContributionGraph({ weeks, monthLabels, onWeekClick }) {
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
            className="flex items-center text-[11px] leading-none text-chalk-dim"
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
                className="absolute text-[11px] leading-none whitespace-nowrap text-chalk-dim"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {/* 13px days are an overview, not targets: a tap anywhere in a week's
                column opens that month in the Calendar view, where days are
                full-size. Pointer-only; keyboard users switch views directly. */}
            {weeks.map((week, weekIndex) => {
              const lastPastDay = week.filter((day) => !day.isFuture).at(-1)
              return (
                <div
                  key={weekIndex}
                  onClick={lastPastDay ? () => onWeekClick(lastPastDay.date) : undefined}
                  className={`flex flex-col gap-[3px]${lastPastDay ? ' cursor-pointer' : ''}`}
                >
                  {week.map((day) =>
                    day.isFuture ? (
                      <div key={day.dateStr} style={{ height: CELL_PX, width: CELL_PX }} />
                    ) : (
                      <div
                        key={day.dateStr}
                        title={`${day.label ?? 'No sets'} · ${formatDate(day.dateStr)}`}
                        style={{ height: CELL_PX, width: CELL_PX, backgroundColor: `var(--color-heat-${day.level})` }}
                        className="rounded-[2px]"
                      />
                    )
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function MonthGrid({ weeks, onDayClick }) {
  return (
    <div className="-mx-2 flex flex-col gap-1">
      <div className="grid grid-cols-7 gap-x-0.5">
        {WEEKDAY_SHORT.map((label, i) => (
          <div key={i} className="text-center text-caption text-chalk-dim">
            {label}
          </div>
        ))}
      </div>

      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-x-0.5">
          {week.map((day, dayIndex) => {
            if (!day) return <div key={dayIndex} />

            const numberClass = day.isFuture
              ? 'text-chalk-dim/50'
              : day.isToday
                ? 'font-semibold text-blue-400'
                : 'text-chalk'
            const clickable = !day.isFuture && onDayClick && day.level > 0
            const Cell = clickable ? 'button' : 'div'
            const description = day.isFuture ? undefined : `${day.label ?? 'No sets'} · ${formatDate(day.dateStr)}`

            return (
              <Cell
                key={dayIndex}
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => onDayClick(day.dateStr) : undefined}
                title={description}
                aria-label={clickable ? `View ${description}` : undefined}
                aria-current={day.isToday ? 'date' : undefined}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-full${clickable ? ' cursor-pointer active:bg-surface-2' : ''}`}
              >
                <span className={`text-[15px] tabular-nums ${numberClass}`}>{day.date.getDate()}</span>
                {!day.isFuture && day.level > 0 && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: `var(--color-heat-${day.level})` }}
                  />
                )}
              </Cell>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function CalendarPage({ profiles, userId, weightUnit, onError }) {
  const [dayDataByUser, setDayDataByUser] = useCachedState('calendar:dayDataByUser', new Map())
  const [setsLoaded, setSetsLoaded] = useCachedState('calendar:setsLoaded', false)
  const [scheduleMap, setScheduleMap] = useCachedState('calendar:scheduleMap', new Map())
  const [setsVersion, setSetsVersion] = useState(0)
  const [viewingDate, setViewingDate] = useState(null)
  const [viewMode, setViewMode] = usePersistedState('calendarViewMode', 'heatmap', Boolean)
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))

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
  }, [onError, setScheduleMap])

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
  }, [setsVersion, onError, setDayDataByUser, setSetsLoaded])

  const rows = sortProfilesSelfFirst(profiles, userId)

  const { today, start } = getContributionRange()
  const dateScaffold = buildDateScaffold(start, today)
  const monthLabels = getMonthLabels(dateScaffold)
  const monthScaffold = buildMonthScaffold(monthCursor, today)

  const earliestMonth = startOfMonth(start)
  const currentMonth = startOfMonth(today)
  const canGoPrevMonth = monthCursor > earliestMonth
  const canGoNextMonth = monthCursor < currentMonth

  function openMonth(date) {
    setMonthCursor(startOfMonth(date))
    setViewMode('month')
  }

  const streaksByUserId = Object.fromEntries(
    rows.map((profile) => {
      const dates = new Set((dayDataByUser.get(profile.id) ?? new Map()).keys())
      const scheduledDays = new Set([0, 1, 2, 3, 4, 5, 6].filter((d) => scheduleMap.has(`${profile.id}:${d}`)))
      return [profile.id, computeStreak(dates, scheduledDays)]
    })
  )

  if (!setsLoaded) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <span className="sr-only">Loading</span>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-9 rounded-full" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  return (
    <>
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {rows.map((profile, i) => {
          const streak = streaksByUserId[profile.id]
          return (
            <Card key={profile.id} className="flex flex-col gap-1 p-4">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                <p className="truncate text-caption text-chalk-dim">{displayName(profile)}</p>
              </div>
              <p className="text-title tabular-nums text-chalk">{streak}</p>
              <p className="text-caption text-chalk-dim">{streak === 1 ? 'workout' : 'workouts'} in a row</p>
            </Card>
          )
        })}
      </div>

      <div className="flex flex-col gap-2">
        <SegmentedControl
          segments={VIEW_SEGMENTS}
          value={viewMode}
          onChange={setViewMode}
          layoutId="seg-calendar-view"
        />
        <p className="px-1 text-caption text-chalk-dim">
          {viewMode === 'month'
            ? 'Tap one of your days to view or repeat that workout.'
            : 'Tap a week to open that month in Calendar.'}
        </p>
      </div>

      {viewMode === 'month' && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setMonthCursor((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() - 1, 1)))}
            disabled={!canGoPrevMonth}
            aria-label="Previous month"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-chalk active:bg-surface-2 disabled:opacity-30"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <p aria-live="polite" className="w-40 text-center text-[17px] font-semibold text-chalk">
            {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
          <button
            type="button"
            onClick={() => setMonthCursor((m) => startOfMonth(new Date(m.getFullYear(), m.getMonth() + 1, 1)))}
            disabled={!canGoNextMonth}
            aria-label="Next month"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-chalk active:bg-surface-2 disabled:opacity-30"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((profile, i) => {
          const byDate = dayDataByUser.get(profile.id) ?? new Map()
          const maxCount = Math.max(0, ...[...byDate.values()].map((e) => e.total))

          const withLevels = (day) => {
            if (!day || day.isFuture) return day
            const entry = byDate.get(day.dateStr)
            const routineExerciseIds = scheduleMap.get(`${profile.id}:${day.dayOfWeek}`)
            const { level, label } = levelAndLabelFor(entry, routineExerciseIds, maxCount)
            return { ...day, level, label }
          }

          const weeks = dateScaffold.map((week) => week.map(withLevels))
          const monthWeeks = monthScaffold.map((week) => week.map(withLevels))

          return (
            <Card key={profile.id} className="p-4">
              <h2 className="mb-3 flex items-center gap-2 text-[17px] font-semibold text-chalk">
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                <span className="truncate">{displayName(profile)}</span>
              </h2>

              {viewMode === 'heatmap' ? (
                <ContributionGraph weeks={weeks} monthLabels={monthLabels} onWeekClick={openMonth} />
              ) : (
                <MonthGrid
                  weeks={monthWeeks}
                  onDayClick={profile.id === userId ? setViewingDate : undefined}
                />
              )}

              <div aria-hidden="true" className="mt-2 flex items-center justify-end gap-1">
                <span className="mr-0.5 text-[11px] text-chalk-dim">Less</span>
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
                <span className="ml-0.5 text-[11px] text-chalk-dim">More</span>
              </div>
            </Card>
          )
        })}
      </div>

      <MuscleVolume userId={userId} onError={onError} />
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
