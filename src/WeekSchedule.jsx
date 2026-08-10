import { Fragment, useState } from 'react'
import { supabase } from './supabaseClient'
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from './weekdays'

function ScheduleCell({ initialValue, onSave }) {
  const [value, setValue] = useState(initialValue)

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initialValue) onSave(value)
      }}
      placeholder="—"
      className="w-full min-w-0 rounded-md border border-neutral-300 bg-white px-1 py-1.5 text-center text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
    />
  )
}

function WeekSchedule({ schedule, profiles, userId, onSaved, onError }) {
  function labelFor(profileId, day) {
    return schedule.find((s) => s.user_id === profileId && s.day_of_week === day)?.label ?? ''
  }

  async function handleSave(day, label) {
    onError('')
    const { error } = await supabase
      .from('schedule')
      .upsert(
        { user_id: userId, day_of_week: day, label },
        { onConflict: 'user_id,day_of_week' }
      )

    if (error) {
      onError(error.message)
      return
    }
    onSaved()
  }

  const rows = [...profiles].sort((a, b) => {
    if (a.id === userId) return -1
    if (b.id === userId) return 1
    return a.email.localeCompare(b.email)
  })

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] items-center gap-1">
        <div />
        {WEEKDAY_ORDER.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400"
          >
            {WEEKDAY_SHORT[day].slice(0, 2)}
          </div>
        ))}

        {rows.map((profile) => (
          <Fragment key={profile.id}>
            <div
              className="truncate text-xs text-neutral-700 dark:text-neutral-300"
              title={profile.email}
            >
              {profile.email.split('@')[0]}
            </div>
            {WEEKDAY_ORDER.map((day) => {
              const label = labelFor(profile.id, day)
              return profile.id === userId ? (
                <ScheduleCell
                  key={day}
                  initialValue={label}
                  onSave={(value) => handleSave(day, value)}
                />
              ) : (
                <div
                  key={day}
                  className="truncate text-center text-xs text-neutral-500 dark:text-neutral-400"
                  title={label}
                >
                  {label || '—'}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export default WeekSchedule
