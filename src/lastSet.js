import { supabase } from './supabaseClient'

// NOTE: this deliberately sorts client-side rather than using
// `.order(col, { foreignTable })` — that option silently produces a
// no-op on this project's PostgREST version (confirmed: it emits the
// legacy `workouts.order=date.asc` query param, which this PostgREST
// ignores rather than erroring on), so any query relying on it for
// worked-out-of-band-of-id date order returns rows in `id` order.
export async function fetchLastSet(userId, exerciseId) {
  const { data, error } = await supabase
    .from('sets')
    .select('id, weight, reps, workouts!inner(date)')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)

  if (error) return { data: null, error }
  if (!data || data.length === 0) return { data: null, error: null }

  const last = data.reduce((latest, row) => {
    if (!latest) return row
    if (row.workouts.date !== latest.workouts.date) {
      return row.workouts.date > latest.workouts.date ? row : latest
    }
    return row.id > latest.id ? row : latest
  }, null)

  return { data: { weight: last.weight, reps: last.reps }, error: null }
}
