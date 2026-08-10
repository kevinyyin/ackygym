import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
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
    return a.email.localeCompare(b.email)
  })

  return exercises.length === 0 ? (
    <Card className="p-5">
      <p className="text-sm text-neutral-500">No exercises yet.</p>
    </Card>
  ) : (
    <div className="grid grid-cols-2 gap-3">
      {exercises.map((exercise) => (
        <Card key={exercise.id} className="flex flex-col gap-3 p-4">
          <p className="truncate text-xs text-neutral-500">{exercise.name}</p>
          <div className="flex flex-col gap-2.5">
            {rows.map((profile) => {
              const entry = latestSets.get(`${exercise.id}:${profile.id}`)
              return (
                <div key={profile.id}>
                  <p className="truncate text-[11px] text-neutral-600">
                    {profile.email.split('@')[0]}
                  </p>
                  {entry ? (
                    <>
                      <p className="text-xl font-bold text-white">
                        {entry.weight}
                        <span className="ml-1 text-sm font-normal text-neutral-500">
                          x{entry.reps}
                        </span>
                      </p>
                      <p className="text-[11px] text-neutral-600">{formatDate(entry.date)}</p>
                    </>
                  ) : (
                    <p className="text-xl font-bold text-neutral-700">—</p>
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
