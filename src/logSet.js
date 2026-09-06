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

  const isPr = priorMaxWeight === null || weight > priorMaxWeight

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

// Re-derives is_pr for every set of this user+exercise, in chronological
// order — needed after an edit or delete, since is_pr is only ever computed
// once at insert time above and would otherwise go stale (e.g. deleting the
// PR set should promote the next-highest one).
export async function recomputeIsPr(userId, exerciseId) {
  const { data, error } = await supabase
    .from('sets')
    .select('id, weight, is_pr, workouts!inner(date)')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)

  if (error) return { error }

  // Sorted client-side — `.order(col, { foreignTable })` is a no-op on
  // this project's PostgREST version, see lastSet.js for details.
  const sorted = [...data].sort((a, b) => {
    if (a.workouts.date !== b.workouts.date) {
      return a.workouts.date < b.workouts.date ? -1 : 1
    }
    return a.id - b.id
  })

  let maxWeight = null
  for (const set of sorted) {
    const isPr = maxWeight === null || set.weight > maxWeight
    if (isPr) maxWeight = set.weight

    if (set.is_pr !== isPr) {
      const { error: updateError } = await supabase
        .from('sets')
        .update({ is_pr: isPr })
        .eq('id', set.id)
      if (updateError) return { error: updateError }
    }
  }

  return { error: null }
}
