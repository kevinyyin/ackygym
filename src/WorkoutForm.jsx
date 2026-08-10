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

  return (
    <form onSubmit={handleSubmit}>
      <select value={selectedExerciseId} onChange={(e) => setExerciseId(e.target.value)}>
        {exercises.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="Weight"
        required
      />
      <input
        type="number"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        placeholder="Reps"
        required
      />
      <button type="submit">Log set</button>
    </form>
  )
}

export default WorkoutForm
