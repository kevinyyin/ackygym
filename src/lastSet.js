import { supabase } from './supabaseClient'

export async function fetchLastSet(userId, exerciseId) {
  const { data, error } = await supabase
    .from('sets')
    .select('weight, reps, workouts!inner(date)')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .order('date', { foreignTable: 'workouts', ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error }
  return { data: data ? { weight: data.weight, reps: data.reps } : null, error: null }
}
