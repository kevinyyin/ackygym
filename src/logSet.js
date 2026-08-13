import { supabase } from './supabaseClient'
import { getTodayDateString } from './dateUtils'

async function fetchPriorMaxWeight(userId, exerciseId) {
  const { data, error } = await supabase
    .from('sets')
    .select('weight')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .order('weight', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error }
  return { data: data ? data.weight : null, error: null }
}

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

  const { data: priorMaxWeight, error: maxWeightError } = await fetchPriorMaxWeight(
    userId,
    exerciseId
  )
  if (maxWeightError) return { error: maxWeightError }

  const isPr = priorMaxWeight !== null && weight > priorMaxWeight

  const { error: setInsertError } = await supabase.from('sets').insert({
    workout_id: workoutId,
    exercise_id: exerciseId,
    user_id: userId,
    weight,
    reps,
    is_pr: isPr,
  })

  return { error: setInsertError, isPr }
}
