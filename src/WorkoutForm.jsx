import { useState } from 'react'
import { supabase } from './supabaseClient'

function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function WorkoutForm({ exercises, userId, onLogged, onError }) {
  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  const selectedExerciseId = exerciseId || exercises[0]?.id || ''

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')

    const today = getTodayDateString()

    const { data: existingWorkout, error: workoutSelectError } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()

    if (workoutSelectError) {
      onError(workoutSelectError.message)
      return
    }

    let workoutId = existingWorkout?.id

    if (!workoutId) {
      const { data: newWorkout, error: workoutInsertError } = await supabase
        .from('workouts')
        .insert({ user_id: userId, date: today })
        .select('id')
        .single()

      if (workoutInsertError) {
        onError(workoutInsertError.message)
        return
      }
      workoutId = newWorkout.id
    }

    const { error: setInsertError } = await supabase.from('sets').insert({
      workout_id: workoutId,
      exercise_id: Number(selectedExerciseId),
      user_id: userId,
      weight: Number(weight),
      reps: Number(reps),
    })

    if (setInsertError) {
      onError(setInsertError.message)
      return
    }

    setWeight('')
    setReps('')
    onLogged()
  }

  const inputClasses =
    'w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500'

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
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
      >
        Log set
      </button>
    </form>
  )
}

export default WorkoutForm
