import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import WorkoutForm from './WorkoutForm'
import WeekSchedule from './WeekSchedule'
import AddExerciseForm from './AddExerciseForm'
import { WEEKDAY_NAME } from './weekdays'

function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function App() {
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [todaysSets, setTodaysSets] = useState([])
  const [profiles, setProfiles] = useState([])
  const [schedule, setSchedule] = useState([])
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const [exercisesVersion, setExercisesVersion] = useState(0)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    async function fetchExercises() {
      const { data, error } = await supabase.from('exercises').select('*')
      if (error) {
        setError(error.message)
        return
      }
      setExercises(data)
    }

    fetchExercises()
  }, [session, exercisesVersion])

  useEffect(() => {
    if (!session) return

    async function fetchProfiles() {
      const { data, error } = await supabase.from('profiles').select('id, email')
      if (error) {
        setError(error.message)
        return
      }
      setProfiles(data)
    }

    fetchProfiles()
  }, [session])

  useEffect(() => {
    if (!session) return

    async function fetchTodaysSets() {
      const { data, error } = await supabase
        .from('sets')
        .select('id, weight, reps, user_id, exercises (name), workouts!inner (date)')
        .eq('workouts.date', getTodayDateString())
        .order('id')

      if (error) {
        setError(error.message)
        return
      }
      setTodaysSets(data)
    }

    fetchTodaysSets()
  }, [session, refreshKey])

  useEffect(() => {
    if (!session) return

    async function fetchSchedule() {
      const { data, error } = await supabase
        .from('schedule')
        .select('id, user_id, day_of_week, label')

      if (error) {
        setError(error.message)
        return
      }
      setSchedule(data)
    }

    fetchSchedule()
  }, [session, scheduleVersion])

  if (!session) {
    return <Auth />
  }

  const emailByUserId = Object.fromEntries(profiles.map((p) => [p.id, p.email]))

  const setsByUserId = new Map()
  for (const set of todaysSets) {
    if (!setsByUserId.has(set.user_id)) setsByUserId.set(set.user_id, [])
    setsByUserId.get(set.user_id).push(set)
  }

  const groupedSets = [...setsByUserId.entries()]
    .map(([userId, sets]) => ({
      userId,
      email: emailByUserId[userId] ?? userId,
      sets,
    }))
    .sort((a, b) => {
      if (a.userId === session.user.id) return -1
      if (b.userId === session.user.id) return 1
      return a.email.localeCompare(b.email)
    })

  const todayDayOfWeek = new Date().getDay()
  const todaysLabel = schedule.find(
    (s) => s.user_id === session.user.id && s.day_of_week === todayDayOfWeek
  )?.label

  async function handleDeleteSet(setId) {
    setError('')
    const { error } = await supabase.from('sets').delete().eq('id', setId)
    if (error) {
      setError(error.message)
      return
    }
    setRefreshKey((key) => key + 1)
  }

  async function handleDeleteExercise(exerciseId) {
    setError('')
    const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
    if (error) {
      setError(
        error.code === '23503'
          ? 'Can’t delete an exercise that has logged sets.'
          : error.message
      )
      return
    }
    setExercisesVersion((v) => v + 1)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col gap-6 p-4 pb-12">
      <header className="flex items-center justify-between gap-3 pt-2">
        <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
          {session.user.email}
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Sign out
        </button>
      </header>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <section className="rounded-2xl bg-blue-600 p-4 text-center text-white dark:bg-blue-500">
        <p className="text-sm font-medium text-blue-100 dark:text-blue-950">
          {WEEKDAY_NAME[todayDayOfWeek]}
        </p>
        <p className="text-2xl font-bold">{todaysLabel || 'No label set'}</p>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Log a set
        </h2>
        <WorkoutForm
          exercises={exercises}
          userId={session.user.id}
          onLogged={() => setRefreshKey((key) => key + 1)}
          onError={setError}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Today&apos;s sets
        </h2>
        {groupedSets.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No sets logged yet today.
          </p>
        ) : (
          groupedSets.map((group) => (
            <div key={group.userId}>
              <h3 className="mb-1 truncate text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {group.email}
              </h3>
              <ul className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
                {group.sets.map((set) => (
                  <li
                    key={set.id}
                    className="flex items-center justify-between gap-2 px-4 py-3"
                  >
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {set.exercises.name}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        {set.weight} x {set.reps}
                      </span>
                      {set.user_id === session.user.id && (
                        <button
                          onClick={() => handleDeleteSet(set.id)}
                          aria-label={`Delete ${set.exercises.name} set`}
                          className="shrink-0 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Weekly schedule
        </h2>
        <WeekSchedule
          schedule={schedule}
          profiles={profiles}
          userId={session.user.id}
          onSaved={() => setScheduleVersion((v) => v + 1)}
          onError={setError}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          Exercises
        </h2>
        <ul className="flex flex-wrap gap-2">
          {exercises.map((exercise) => (
            <li
              key={exercise.id}
              className="flex items-center gap-1.5 rounded-full bg-neutral-100 py-1 pl-3 pr-2 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {exercise.name}
              <button
                onClick={() => handleDeleteExercise(exercise.id)}
                aria-label={`Delete ${exercise.name}`}
                className="text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <AddExerciseForm
          exercises={exercises}
          onAdded={() => setExercisesVersion((v) => v + 1)}
          onError={setError}
        />
      </section>
    </div>
  )
}

export default App
