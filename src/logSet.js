import { supabase } from './supabaseClient'
import { getTodayDateString } from './dateUtils'
import { prTracker } from './pr'

// Calls run one at a time: the UI no longer waits on a save before allowing
// the next tap, and overlapping calls would each create today's workout or
// judge a PR against history missing the other's set.
let queue = Promise.resolve()

// sets: [{ exerciseId, weight, reps }], logged to today's workout in order.
// Resolves { error, logged: [{ id, isPr }] } in the same order.
export function logSets(userId, sets) {
  const result = queue.then(() => insertSets(userId, sets))
  queue = result.catch(() => {})
  return result
}

// Resolves once every set queued so far has saved (or failed).
export function setsSettled() {
  return queue
}

export async function logSet({ userId, exerciseId, weight, reps }) {
  const { error, logged } = await logSets(userId, [{ exerciseId, weight, reps }])
  return { error, isPr: logged?.[0].isPr, id: logged?.[0].id }
}

async function insertSets(userId, sets) {
  const today = getTodayDateString()
  const exerciseIds = [...new Set(sets.map((set) => set.exerciseId))]

  // Independent lookups, run together: each sequential round trip was a
  // visible chunk of the wait on a phone connection.
  const [
    { data: existingWorkout, error: workoutSelectError },
    { data: priorSets, error: priorSetsError },
  ] = await Promise.all([
    supabase.from('workouts').select('id').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabase.from('sets').select('exercise_id, weight, reps').eq('user_id', userId).in('exercise_id', exerciseIds),
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

  // Prior order doesn't matter: only whether each new set beats everything
  // before it. New sets are fed in order, so a batch judges later sets
  // against earlier ones too.
  const trackers = new Map()
  const trackerFor = (exerciseId) => {
    if (!trackers.has(exerciseId)) trackers.set(exerciseId, prTracker())
    return trackers.get(exerciseId)
  }
  for (const set of priorSets) trackerFor(set.exercise_id)(set.weight, set.reps)
  const rows = sets.map((set) => ({
    workout_id: workoutId,
    exercise_id: set.exerciseId,
    user_id: userId,
    weight: set.weight,
    reps: set.reps,
    is_pr: trackerFor(set.exerciseId)(set.weight, set.reps),
  }))

  // RETURNING comes back in insert order.
  const { data: inserted, error: setInsertError } = await supabase.from('sets').insert(rows).select('id')
  if (setInsertError) return { error: setInsertError }

  return { error: null, logged: inserted.map((row, i) => ({ id: row.id, isPr: rows[i].is_pr })) }
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
  const changed = sorted
    .map((set) => ({ id: set.id, was: set.is_pr, isPr: track(set.weight, set.reps) }))
    .filter((set) => set.was !== set.isPr)

  // Independent single-row updates, sent together rather than one round trip each.
  const results = await Promise.all(
    changed.map((set) => supabase.from('sets').update({ is_pr: set.isPr }).eq('id', set.id))
  )
  return { error: results.find((r) => r.error)?.error ?? null }
}
