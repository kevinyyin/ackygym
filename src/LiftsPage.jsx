import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { displayName } from './displayName'
import Card from './Card'

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function LiftsPage({ profiles, userId, onError }) {
  const [exercises, setExercises] = useState([])
  const [latestSets, setLatestSets] = useState(new Map())

  useEffect(() => {
    async function fetchExercises() {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name')
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
        .select('user_id, exercise_id, weight, reps, workouts!inner(date)')
        .order('date', { foreignTable: 'workouts', ascending: false })
        .order('id', { ascending: false })

      if (error) {
        onError(error.message)
        return
      }

      const latest = new Map()
      for (const set of data) {
        const key = `${set.exercise_id}:${set.user_id}`
        if (latest.has(key)) continue
        latest.set(key, {
          weight: set.weight,
          reps: set.reps,
          date: set.workouts.date,
        })
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

  return exercises.length === 0 ? (
    <Card className="p-4">
      <p className="text-sm text-chalk-dim">No exercises yet.</p>
    </Card>
  ) : (
    <div className="grid grid-cols-2 gap-3">
      {exercises.map((exercise) => (
        <Card key={exercise.id} className="flex flex-col gap-3 p-4">
          <p className="truncate font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
            {exercise.name}
          </p>
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
  )
}

export default LiftsPage
