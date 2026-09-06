import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Card, { SectionLabel } from './Card'
import MuscleTags from './MuscleTags'
import AddExerciseForm from './AddExerciseForm'
import ExerciseDetailModal from './ExerciseDetailModal'
import Routines from './Routines'
import ConfirmModal from './ConfirmModal'

// Routine and exercise-library management, split out of Home so that page
// can stay focused on today's status/logging — this is occasional
// housekeeping, not a "today" action.
function RoutinesPage({ session, schedule, onScheduleSaved, onError, onActiveRoutineChange }) {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [exercisesLoaded, setExercisesLoaded] = useState(false)
  const [exercisesVersion, setExercisesVersion] = useState(0)
  const [routines, setRoutines] = useState([])
  const [routinesLoaded, setRoutinesLoaded] = useState(false)
  const [routinesVersion, setRoutinesVersion] = useState(0)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [exerciseToDelete, setExerciseToDelete] = useState(null)

  useEffect(() => {
    async function fetchExercises() {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, exercise_muscles(muscle, role, muscle_groups(label))')
        .order('name')
      if (error) {
        onError(error.message)
        return
      }
      setExercises(data)
      setExercisesLoaded(true)
    }

    fetchExercises()
  }, [exercisesVersion, onError])

  useEffect(() => {
    async function fetchRoutines() {
      const { data, error } = await supabase
        .from('routines')
        .select(
          'id, user_id, name, routine_exercises(id, position, exercise_id, exercises(name, exercise_muscles(muscle, role, muscle_groups(label))))'
        )
        .order('name')
      if (error) {
        onError(error.message)
        return
      }
      // Sorted client-side — `.order(col, { foreignTable })` is a no-op on
      // this project's PostgREST version, see lastSet.js for details.
      setRoutines(
        data.map((routine) => ({
          ...routine,
          routine_exercises: [...routine.routine_exercises].sort((a, b) => a.position - b.position),
        }))
      )
      setRoutinesLoaded(true)
    }

    fetchRoutines()
  }, [routinesVersion, onError])

  async function handleDeleteExercise(exerciseId) {
    onError('')
    const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
    setExerciseToDelete(null)
    if (error) {
      onError(
        error.code === '23503'
          ? 'Can’t delete an exercise that still has logged sets or is used in a routine.'
          : error.message
      )
      return
    }
    setExercisesVersion((v) => v + 1)
  }

  function handleStart(routine) {
    onActiveRoutineChange(routine)
    navigate('/')
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4">
        <SectionLabel>Routines</SectionLabel>
        <Routines
          routines={routines}
          loaded={routinesLoaded}
          exercises={exercises}
          schedule={schedule}
          userId={session.user.id}
          onRoutinesChanged={() => setRoutinesVersion((v) => v + 1)}
          onScheduleChanged={onScheduleSaved}
          onStart={handleStart}
          onError={onError}
        />
      </Card>

      <Card className="p-4">
        <SectionLabel>Exercises</SectionLabel>
        <AddExerciseForm
          exercises={exercises}
          showMuscleGroups
          onAdded={() => setExercisesVersion((v) => v + 1)}
          onError={onError}
        />
        {!exercisesLoaded ? (
          <p className="mt-3 text-sm text-chalk-dim">Loading…</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {exercises.map((exercise) => (
              <li
                key={exercise.id}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-2 py-1.5 pl-3 pr-2"
              >
                <button
                  type="button"
                  onClick={() => setSelectedExercise(exercise)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
                >
                  <span className="w-full truncate text-sm text-chalk">{exercise.name}</span>
                  <MuscleTags muscles={exercise.exercise_muscles} />
                </button>
                <button
                  type="button"
                  onClick={() => setExerciseToDelete(exercise)}
                  aria-label={`Delete ${exercise.name}`}
                  className="shrink-0 rounded px-1 py-0.5 text-chalk-dim hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ExerciseDetailModal
        exercise={selectedExercise}
        userId={session.user.id}
        onClose={() => setSelectedExercise(null)}
        onError={onError}
        onChanged={() => setExercisesVersion((v) => v + 1)}
      />

      <ConfirmModal
        open={exerciseToDelete !== null}
        title="Delete exercise?"
        message={`"${exerciseToDelete?.name}" will be removed from your exercise library. This can't be undone.`}
        onConfirm={() => handleDeleteExercise(exerciseToDelete.id)}
        onCancel={() => setExerciseToDelete(null)}
      />
    </div>
  )
}

export default RoutinesPage
