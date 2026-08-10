import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import WorkoutForm from './WorkoutForm'
import WeekSchedule from './WeekSchedule'
import AddExerciseForm from './AddExerciseForm'
import Card from './Card'
import { displayName } from './displayName'
import { WEEKDAY_NAME } from './weekdays'
import { getTodayDateString } from './dateUtils'
import { logSet } from './logSet'

function Home({ session, profiles, schedule, onScheduleSaved, onError }) {
  const [exercises, setExercises] = useState([])
  const [todaysSets, setTodaysSets] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [exercisesVersion, setExercisesVersion] = useState(0)

  useEffect(() => {
    async function fetchExercises() {
      const { data, error } = await supabase.from('exercises').select('*')
      if (error) {
        onError(error.message)
        return
      }
      setExercises(data)
    }

    fetchExercises()
  }, [exercisesVersion, onError])

  useEffect(() => {
    async function fetchTodaysSets() {
      const { data, error } = await supabase
        .from('sets')
        .select('id, weight, reps, user_id, exercise_id, exercises (name), workouts!inner (date)')
        .eq('workouts.date', getTodayDateString())
        .order('id')

      if (error) {
        onError(error.message)
        return
      }
      setTodaysSets(data)
    }

    fetchTodaysSets()
  }, [refreshKey, onError])

  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p]))

  const setsByUserId = new Map()
  for (const set of todaysSets) {
    if (!setsByUserId.has(set.user_id)) setsByUserId.set(set.user_id, [])
    setsByUserId.get(set.user_id).push(set)
  }

  const groupedSets = [...setsByUserId.entries()]
    .map(([userId, sets]) => ({
      userId,
      name: profileByUserId[userId] ? displayName(profileByUserId[userId]) : userId,
      sets,
    }))
    .sort((a, b) => {
      if (a.userId === session.user.id) return -1
      if (b.userId === session.user.id) return 1
      return a.name.localeCompare(b.name)
    })

  const todayDayOfWeek = new Date().getDay()
  const todaysLabel = schedule.find(
    (s) => s.user_id === session.user.id && s.day_of_week === todayDayOfWeek
  )?.label

  async function handleRepeatSet(set) {
    onError('')
    const { error } = await logSet({
      userId: session.user.id,
      exerciseId: set.exercise_id,
      weight: set.weight,
      reps: set.reps,
    })
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((key) => key + 1)
  }

  async function handleDeleteSet(setId) {
    onError('')
    const { error } = await supabase.from('sets').delete().eq('id', setId)
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((key) => key + 1)
  }

  async function handleDeleteExercise(exerciseId) {
    onError('')
    const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
    if (error) {
      onError(
        error.code === '23503'
          ? 'Can’t delete an exercise that has logged sets.'
          : error.message
      )
      return
    }
    setExercisesVersion((v) => v + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col justify-between p-5">
          <p className="text-xs text-neutral-500">{WEEKDAY_NAME[todayDayOfWeek]}</p>
          <p className="mt-3 text-2xl leading-tight font-bold text-white">
            {todaysLabel || 'Rest day'}
          </p>
        </Card>
        <Card className="flex flex-col justify-between p-5">
          <p className="text-xs text-neutral-500">Sets today</p>
          <p className="mt-3 text-4xl font-bold text-white">{todaysSets.length}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-neutral-300">Log a set</h2>
        <WorkoutForm
          exercises={exercises}
          userId={session.user.id}
          onLogged={() => setRefreshKey((key) => key + 1)}
          onError={onError}
        />
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-semibold text-neutral-300">Today&apos;s sets</h2>
        {groupedSets.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-neutral-500">No sets logged yet today.</p>
          </Card>
        ) : (
          groupedSets.map((group) => (
            <Card key={group.userId} className="overflow-hidden">
              <h3 className="px-5 pt-4 text-xs text-neutral-500">{group.name}</h3>
              <ul className="mt-2 divide-y divide-neutral-800">
                {group.sets.map((set) => (
                  <li
                    key={set.id}
                    className="flex items-center justify-between gap-2 px-5 py-3"
                  >
                    <span className="font-medium text-white">
                      {set.exercises.name}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm text-neutral-400">
                        {set.weight} x {set.reps}
                      </span>
                      {set.user_id === session.user.id && (
                        <>
                          <button
                            onClick={() => handleRepeatSet(set)}
                            aria-label={`Repeat ${set.exercises.name} set`}
                            className="shrink-0 text-neutral-500 hover:text-blue-400"
                          >
                            ↻
                          </button>
                          <button
                            onClick={() => handleDeleteSet(set.id)}
                            aria-label={`Delete ${set.exercises.name} set`}
                            className="shrink-0 text-neutral-500 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-semibold text-neutral-300">Weekly schedule</h2>
        <WeekSchedule
          schedule={schedule}
          profiles={profiles}
          userId={session.user.id}
          onSaved={onScheduleSaved}
          onError={onError}
        />
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Exercises</h2>
        <ul className="flex flex-wrap gap-2">
          {exercises.map((exercise) => (
            <li
              key={exercise.id}
              className="flex items-center gap-1.5 rounded-full bg-neutral-800 py-1.5 pl-3 pr-2 text-sm text-neutral-200"
            >
              {exercise.name}
              <button
                onClick={() => handleDeleteExercise(exercise.id)}
                aria-label={`Delete ${exercise.name}`}
                className="text-neutral-500 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <AddExerciseForm
          exercises={exercises}
          onAdded={() => setExercisesVersion((v) => v + 1)}
          onError={onError}
        />
      </Card>
    </div>
  )
}

export default Home
