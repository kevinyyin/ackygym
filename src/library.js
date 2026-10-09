import { supabase } from './supabaseClient'

// The exercise library and routines in the joined shape every page expects —
// one definition, since a routine started from Train is rendered by Today's
// ActiveRoutine.
export function fetchExercises() {
  return supabase
    .from('exercises')
    .select('id, name, exercise_muscles(muscle, role, muscle_groups(label))')
    .order('name')
}

export async function fetchRoutines() {
  const { data, error } = await supabase
    .from('routines')
    .select(
      'id, user_id, name, routine_exercises(id, position, exercise_id, exercises(name, exercise_muscles(muscle, role, muscle_groups(label))))'
    )
    .order('name')
  if (error) return { data: null, error }

  // Sorted client-side — `.order(col, { foreignTable })` is a no-op on
  // this project's PostgREST version, see lastSet.js for details.
  return {
    data: data.map((routine) => ({
      ...routine,
      routine_exercises: [...routine.routine_exercises].sort((a, b) => a.position - b.position),
    })),
    error: null,
  }
}
