import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from './weekdays'
import { toDateString } from './dateUtils'
import { displayName } from './displayName'
import Card from './Card'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

const DOT_COLORS = ['bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-purple-400']

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

function CalendarPage({ profiles, schedule, userId, onError }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [workouts, setWorkouts] = useState([])

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-neutral-400 active:bg-neutral-800"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold text-white">{monthLabel}</h2>
        <button
          onClick={goToNextMonth}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-neutral-400 active:bg-neutral-800"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-3 px-1">
        {rows.map((profile, i) => (
          <div
            key={profile.id}
            className="flex items-center gap-1.5 text-xs text-neutral-400"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
            {displayName(profile)}
          </div>
        ))}
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_ORDER.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-neutral-500"
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
                  className={`flex min-h-16 min-w-0 flex-col gap-1 rounded-xl p-1 ${
                    isToday ? 'bg-blue-500/15 ring-1 ring-blue-500' : ''
                  }`}
                >
                  <span className="text-xs text-neutral-500">
                    {date.getDate()}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {rows.map((profile, i) => {
                      const hasWorkout = workouts.some(
                        (w) => w.user_id === profile.id && w.date === dateStr
                      )
                      const label = schedule.find(
                        (s) => s.user_id === profile.id && s.day_of_week === dayOfWeek
                      )?.label

                      if (!label && !hasWorkout) return null

                      return (
                        <div
                          key={profile.id}
                          className="flex min-w-0 items-center gap-1"
                          title={label || ''}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]} ${
                              hasWorkout ? '' : 'opacity-30'
                            }`}
                          />
                          <span className="truncate text-[10px] text-neutral-400">
                            {label || '—'}
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
