import { supabase } from './supabaseClient'
import { getTodayDateString } from './dateUtils'
import { prTracker } from './pr'

export async function logSet({ userId, exerciseId, weight, reps }) {
  const today = getTodayDateString()

  // Independent lookups, run together: each sequential round trip was a
  // visible chunk of the "Logging…" wait on a phone connection.
  const [
    { data: existingWorkout, error: workoutSelectError },
    { data: priorSets, error: priorSetsError },
  ] = await Promise.all([
    supabase.from('workouts').select('id').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabase.from('sets').select('weight, reps').eq('user_id', userId).eq('exercise_id', exerciseId),
  ])

  if (workoutSelectError) return { error: workoutSelectError }
  if (priorSetsError) return { error: priorSetsError }

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

  // Order doesn't matter here: only whether the new set beats every prior one.
  const track = prTracker()
  for (const set of priorSets) track(set.weight, set.reps)
  const isPr = track(weight, reps)

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

// Chronological: workout date, then insert order within a day.
export function byDateThenId(a, b) {
  if (a.workouts.date !== b.workouts.date) return a.workouts.date < b.workouts.date ? -1 : 1
  return a.id - b.id
}

// Re-derives is_pr for every set of this user+exercise, in chronological
// order — needed after an edit or delete, since is_pr is only ever computed
// once at insert time above and would otherwise go stale (e.g. deleting the
// PR set should promote the next-highest one).
export async function recomputeIsPr(userId, exerciseId) {
  const { data, error } = await supabase
    .from('sets')
    .select('id, weight, reps, is_pr, workouts!inner(date)')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)

  if (error) return { error }

  // Sorted client-side — `.order(col, { foreignTable })` is a no-op on
  // this project's PostgREST version, see lastSet.js for details.
  const sorted = [...data].sort(byDateThenId)

  const track = prTracker()
  for (const set of sorted) {
    const isPr = track(set.weight, set.reps)

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
