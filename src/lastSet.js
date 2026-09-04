import { supabase } from './supabaseClient'

// Sets are always logged against today's workout (see logSet.js — there's
// no backdating), so `id` order already matches chronological order for a
// given user+exercise. Ordering by `id` (the sets table's own column) also
// sidesteps the documented PostgREST quirk where `.order(col, { foreignTable })`
// is a silent no-op for a joined table's column.
export async function fetchLastSet(userId, exerciseId) {
  const { data, error } = await supabase
    .from('sets')
    .select('weight, reps')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }

  return { data: { weight: data.weight, reps: data.reps }, error: null }
}
