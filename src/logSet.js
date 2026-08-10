import { supabase } from './supabaseClient'
import { getTodayDateString } from './dateUtils'

export async function logSet({ userId, exerciseId, weight, reps }) {
  const today = getTodayDateString()

  const { data: existingWorkout, error: workoutSelectError } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle()

  if (workoutSelectError) return { error: workoutSelectError }

  let workoutId = existingWorkout?.id

  if (!workoutId) {
    const { data: newWorkout, error: workoutInsertError } = await supabase
      .from('workouts')
      .insert({ user_id: userId, date: today })
      .select('id')
      .single()

    if (workoutInsertError) return { error: workoutInsertError }
    workoutId = newWorkout.id
  }

  const { error: setInsertError } = await supabase.from('sets').insert({
    workout_id: workoutId,
    exercise_id: exerciseId,
    user_id: userId,
    weight,
    reps,
  })

  return { error: setInsertError }
}
