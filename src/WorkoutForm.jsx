import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { logSet } from './logSet'

function WorkoutForm({ exercises, userId, onLogged, onError }) {
  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  const selectedExerciseId = exerciseId || exercises[0]?.id || ''

  useEffect(() => {
    if (!selectedExerciseId) return

    async function fetchLastSet() {
      const { data, error } = await supabase
        .from('sets')
        .select('weight, reps, workouts!inner(date)')
        .eq('user_id', userId)
        .eq('exercise_id', Number(selectedExerciseId))
        .order('date', { foreignTable: 'workouts', ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        onError(error.message)
        return
      }

      setWeight(data ? String(data.weight) : '')
      setReps(data ? String(data.reps) : '')
    }

    fetchLastSet()
  }, [selectedExerciseId, userId, onError])

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')

    const { error } = await logSet({
      userId,
      exerciseId: Number(selectedExerciseId),
      weight: Number(weight),
      reps: Number(reps),
    })

    if (error) {
      onError(error.message)
      return
    }

    setWeight('')
    setReps('')
    onLogged()
  }

  const inputClasses =
    'w-full rounded-2xl border border-neutral-800 bg-neutral-800/60 px-4 py-3 text-base text-white placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <select
        value={selectedExerciseId}
        onChange={(e) => setExerciseId(e.target.value)}
        className={inputClasses}
      >
        {exercises.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </select>
      <div className="flex gap-3">
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Weight"
          required
          className={inputClasses}
        />
        <input
          type="number"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="Reps"
          required
          className={inputClasses}
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-2xl bg-blue-500 px-4 py-3 text-base font-semibold text-white active:bg-blue-600"
      >
        Log set
      </button>
    </form>
  )
}

export default WorkoutForm
