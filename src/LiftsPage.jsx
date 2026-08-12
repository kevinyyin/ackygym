import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { displayName } from './displayName'
import Card from './Card'
import MuscleTags from './MuscleTags'
import ExerciseDetailModal from './ExerciseDetailModal'

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function LiftsPage({ profiles, userId, onError }) {
  const [exercises, setExercises] = useState([])
  const [latestSets, setLatestSets] = useState(new Map())
  const [selectedExercise, setSelectedExercise] = useState(null)

  useEffect(() => {
    async function fetchExercises() {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, exercise_muscles(muscle, role, muscle_groups(label))')
        .order('name')

      if (error) {
        onError(error.message)
        return
      }
      setExercises(data)
    }

    fetchExercises()
  }, [onError])

  useEffect(() => {
    async function fetchLatestSets() {
      const { data, error } = await supabase
        .from('sets')
        .select('id, user_id, exercise_id, weight, reps, workouts!inner(date)')

      if (error) {
        onError(error.message)
        return
      }

      // Sorted client-side — `.order(col, { foreignTable })` is a no-op on
      // this project's PostgREST version, see lastSet.js for details.
      const latest = new Map()
      for (const set of data) {
        const key = `${set.exercise_id}:${set.user_id}`
        const existing = latest.get(key)
        const isNewer =
          !existing ||
          set.workouts.date > existing.date ||
          (set.workouts.date === existing.date && set.id > existing.id)
        if (isNewer) {
          latest.set(key, {
            weight: set.weight,
            reps: set.reps,
            date: set.workouts.date,
            id: set.id,
          })
        }
      }
      setLatestSets(latest)
    }

    fetchLatestSets()
  }, [onError])

  const rows = [...profiles].sort((a, b) => {
    if (a.id === userId) return -1
    if (b.id === userId) return 1
    return displayName(a).localeCompare(displayName(b))
  })

  return (
    <>
      {exercises.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-chalk-dim">No exercises yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {exercises.map((exercise) => (
            <Card key={exercise.id} className="flex flex-col gap-3 p-4">
              <button
                type="button"
                onClick={() => setSelectedExercise(exercise)}
                className="flex w-full min-w-0 flex-col items-start gap-1.5 text-left"
              >
                <p className="w-full truncate font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
                  {exercise.name}
                </p>
                <MuscleTags muscles={exercise.exercise_muscles} />
              </button>
              <div className="flex flex-col gap-3">
                {rows.map((profile) => {
                  const entry = latestSets.get(`${exercise.id}:${profile.id}`)
                  return (
                    <div key={profile.id} className="border-l-2 border-line pl-2">
                      <p className="truncate text-[11px] text-chalk-dim">
                        {displayName(profile)}
                      </p>
                      {entry ? (
                        <>
                          <p className="font-mono text-xl font-bold text-blue-400">
                            {entry.weight}
                            <span className="ml-1 text-sm font-normal text-chalk-dim">
                              ×{entry.reps}
                            </span>
                          </p>
                          <p className="font-mono text-[11px] text-chalk-dim/70">
                            {formatDate(entry.date)}
                          </p>
                        </>
                      ) : (
                        <p className="font-mono text-xl font-bold text-chalk-dim/40">—</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ExerciseDetailModal
        exercise={selectedExercise}
        userId={userId}
        onClose={() => setSelectedExercise(null)}
        onError={onError}
      />
    </>
  )
}

export default LiftsPage

