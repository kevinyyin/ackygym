import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from './weekdays'
import { toDateString } from './dateUtils'
import { displayName } from './displayName'
import Card from './Card'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

const DOT_COLORS = ['bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-purple-400']
const STREAK_WINDOW_DAYS = 90

function getMonthWeeks(year, month) {
  const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7 // Mon = 0 .. Sun = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
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

function CalendarPage({ profiles, schedule, userId, onError }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [workouts, setWorkouts] = useState([])
  const [streakWorkouts, setStreakWorkouts] = useState([])

  useEffect(() => {
    async function fetchWorkouts() {
      const monthStart = toDateString(new Date(year, month, 1))
      const monthEnd = toDateString(new Date(year, month + 1, 0))

      const { data, error } = await supabase
        .from('workouts')
        .select('id, user_id, date')
        .gte('date', monthStart)
        .lte('date', monthEnd)

      if (error) {
        onError(error.message)
        return
      }
      setWorkouts(data)
    }

    fetchWorkouts()
  }, [year, month, onError])

  useEffect(() => {
    async function fetchStreakWorkouts() {
      const windowStart = new Date()
      windowStart.setDate(windowStart.getDate() - (STREAK_WINDOW_DAYS - 1))

      const { data, error } = await supabase
        .from('workouts')
        .select('id, user_id, date')
        .gte('date', toDateString(windowStart))
        .lte('date', toDateString(new Date()))

      if (error) {
        onError(error.message)
        return
      }
      setStreakWorkouts(data)
    }

    fetchStreakWorkouts()
  }, [onError])

  function goToPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const rows = [...profiles].sort((a, b) => {
    if (a.id === userId) return -1
    if (b.id === userId) return 1
    return displayName(a).localeCompare(displayName(b))
  })

  const weeks = getMonthWeeks(year, month)
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
  const todayStr = toDateString(today)

  const workoutDatesByUser = new Map()
  for (const w of streakWorkouts) {
    if (!workoutDatesByUser.has(w.user_id)) workoutDatesByUser.set(w.user_id, new Set())
    workoutDatesByUser.get(w.user_id).add(w.date)
  }

  const streaksByUserId = Object.fromEntries(
    rows.map((profile) => [
      profile.id,
      computeStreak(workoutDatesByUser.get(profile.id) ?? new Set()),
    ])
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-chalk-dim active:border-blue-500 active:text-blue-400"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <h2 className="font-display text-2xl tracking-tight text-chalk uppercase">
          {monthLabel}
        </h2>
        <button
          onClick={goToNextMonth}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-chalk-dim active:border-blue-500 active:text-blue-400"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

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

      <Card className="p-3">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_ORDER.map((day) => (
            <div
              key={day}
              className="text-center font-mono text-[10px] font-medium tracking-wide text-chalk-dim uppercase"
            >
              {WEEKDAY_SHORT[day].slice(0, 2)}
            </div>
          ))}

          {weeks.map((week, weekIndex) =>
            week.map((date, dayIndex) => {
              if (!date) return <div key={`${weekIndex}-${dayIndex}`} />

              const dateStr = toDateString(date)
              const dayOfWeek = date.getDay()
              const isToday = dateStr === todayStr

              return (
                <div
                  key={dateStr}
                  className={`flex min-h-16 min-w-0 flex-col gap-1 rounded p-1 ${
                    isToday ? 'bg-blue-500/10 ring-1 ring-blue-500' : ''
                  }`}
                >
                  <span className="font-mono text-xs text-chalk-dim">
                    {date.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {rows.map((profile, i) => {
                      const hasWorkout = workouts.some(
                        (w) => w.user_id === profile.id && w.date === dateStr
                      )
                      const routineName = schedule.find(
                        (s) => s.user_id === profile.id && s.day_of_week === dayOfWeek
                      )?.routines?.name

                      if (!routineName && !hasWorkout) return null

                      return (
                        <div
                          key={profile.id}
                          className="flex min-w-0 items-center gap-1"
                          title={routineName || ''}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]} ${
                              hasWorkout ? '' : 'opacity-30'
                            }`}
                          />
                          <span className="truncate text-[10px] text-chalk-dim">
                            {routineName || '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}

export default CalendarPage
