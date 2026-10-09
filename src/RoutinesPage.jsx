import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Card from './Card'
import MuscleTags from './MuscleTags'
import AddExerciseForm from './AddExerciseForm'
import ExerciseDetailModal from './ExerciseDetailModal'
import Routines from './Routines'
import ConfirmModal from './ConfirmModal'
import UndoToast from './UndoToast'
import { useDeferredDelete } from './useDeferredDelete'
import { CloseIcon } from './icons'
import Skeleton from './Skeleton'
import SegmentedControl from './SegmentedControl'
import { useCachedState } from './pageCache'
import { useSelection } from './useSelection'
import SelectControls from './SelectControls'
import { fetchExercises, fetchRoutines } from './library'

// Routine and exercise-library management, split out of Home so that page
// can stay focused on today's status/logging — this is occasional
// housekeeping, not a "today" action.
const SECTIONS = [
  { key: 'routines', label: 'Routines' },
  { key: 'exercises', label: 'Library' },
]

function RoutinesPage({ session, schedule, onScheduleSaved, onError, onActiveRoutineChange, weightUnit }) {
  const navigate = useNavigate()
  const [section, setSection] = useState('routines')
  const [exercises, setExercises] = useCachedState('routinesPage:exercises', [])
  const [exercisesLoaded, setExercisesLoaded] = useCachedState('routinesPage:exercisesLoaded', false)
  const [exercisesVersion, setExercisesVersion] = useState(0)
  const [routines, setRoutines] = useCachedState('routinesPage:routines', [])
  const [routinesLoaded, setRoutinesLoaded] = useCachedState('routinesPage:routinesLoaded', false)
  const [routinesVersion, setRoutinesVersion] = useState(0)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [exerciseToDelete, setExerciseToDelete] = useState(null)
  const selection = useSelection()
  const { selectMode, selectedIds: selectedExerciseIds } = selection
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const { isPending, message, stageDelete, undo } = useDeferredDelete('exercises')

  useEffect(() => {
    async function loadExercises() {
      const { data, error } = await fetchExercises()
      if (error) {
        onError(error.message)
        return
      }
      setExercises(data)
      setExercisesLoaded(true)
    }

    loadExercises()
  }, [exercisesVersion, onError, setExercises, setExercisesLoaded])

  useEffect(() => {
    async function loadRoutines() {
      const { data, error } = await fetchRoutines()
      if (error) {
        onError(error.message)
        return
      }
      setRoutines(data)
      setRoutinesLoaded(true)
    }

    loadRoutines()
  }, [routinesVersion, onError, setRoutines, setRoutinesLoaded])

  // Single and bulk deletes share one path; a single delete is one id.
  function stageExerciseDelete(ids, message) {
    stageDelete({
      ids,
      message,
      commit: async (isForeground) => {
        if (isForeground) onError('')
        const { error } = await supabase.from('exercises').delete().in('id', ids)
        if (error) {
          if (isForeground) {
            onError(
              error.code === '23503'
                ? 'Can’t delete an exercise that still has logged sets or is used in a routine.'
                : error.message
            )
          }
          return
        }
        setExercisesVersion((v) => v + 1)
      },
    })
  }

  function handleDeleteExercise(exercise) {
    setExerciseToDelete(null)
    stageExerciseDelete([exercise.id], `"${exercise.name}" deleted`)
  }

  function handleBulkDelete() {
    const ids = [...selectedExerciseIds]
    setConfirmBulkDelete(false)
    selection.exit()
    stageExerciseDelete(ids, `${ids.length} exercise${ids.length === 1 ? '' : 's'} deleted`)
  }

  function handleStart(routine) {
    onActiveRoutineChange(routine)
    navigate('/')
  }

  const visibleExercises = exercises.filter((e) => !isPending(e.id))

  return (
    <div className="flex flex-col gap-5">
      {/* Routine editing and exercise-library editing are unrelated tasks
          that happened to share a route — a segmented view keeps each one
          the only thing on screen instead of stacking both regardless of
          which one a visitor actually came here to do. */}
      <SegmentedControl segments={SECTIONS} value={section} onChange={setSection} layoutId="seg-routines-inner" />

      {section === 'routines' && (
        <Card className="p-4">
          <h2 className="text-headline text-chalk">Routines</h2>
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
      )}

      {section === 'exercises' && (
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-headline text-chalk">Exercises</h2>
          {visibleExercises.length > 0 && (
            <div className="flex shrink-0 items-center gap-3">
              <SelectControls selection={selection} ids={visibleExercises.map((e) => e.id)} />
            </div>
          )}
        </div>
        <AddExerciseForm
          exercises={exercises}
          showMuscleGroups
          onAdded={() => setExercisesVersion((v) => v + 1)}
          onError={onError}
        />
        {!exercisesLoaded ? (
          <div aria-busy="true" className="mt-3 flex flex-col gap-2">
            <span className="sr-only">Loading</span>
            <Skeleton tone="surface-2" className="h-11 rounded-field" />
            <Skeleton tone="surface-2" className="h-11 rounded-field" />
          </div>
        ) : (
          <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
            {visibleExercises.map((exercise) => (
              <li
                key={exercise.id}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-2 py-1.5 pl-3 pr-2"
              >
                <button
                  type="button"
                  onClick={() =>
                    selectMode ? selection.toggle(exercise.id) : setSelectedExercise(exercise)
                  }
                  className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
                >
                  <span className="w-full truncate text-sm text-chalk">{exercise.name}</span>
                  <MuscleTags muscles={exercise.exercise_muscles} />
                </button>
                {selectMode ? (
                  <input
                    type="checkbox"
                    checked={selectedExerciseIds.has(exercise.id)}
                    onChange={() => selection.toggle(exercise.id)}
                    aria-label={`Select ${exercise.name}`}
                    className="h-4 w-4 shrink-0 accent-blue-500"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setExerciseToDelete(exercise)}
                    aria-label={`Delete ${exercise.name}`}
                    className="shrink-0 rounded px-1 py-0.5 text-chalk-dim hover:text-danger"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {selectMode && selectedExerciseIds.size > 0 && (
          <button
            type="button"
            onClick={() => setConfirmBulkDelete(true)}
            className="mt-3 w-full rounded-md border border-danger px-4 py-2 font-body text-sm font-bold text-danger active:bg-danger/10"
          >
            Delete {selectedExerciseIds.size} selected
          </button>
        )}
      </Card>
      )}

      <ExerciseDetailModal
        exercise={selectedExercise}
        userId={session.user.id}
        weightUnit={weightUnit}
        onClose={() => setSelectedExercise(null)}
        onError={onError}
        onChanged={() => setExercisesVersion((v) => v + 1)}
      />

      <ConfirmModal
        open={exerciseToDelete !== null}
        title="Delete exercise?"
        message={`"${exerciseToDelete?.name}" will be removed from your exercise library.`}
        onConfirm={() => handleDeleteExercise(exerciseToDelete)}
        onCancel={() => setExerciseToDelete(null)}
      />

      <ConfirmModal
        open={confirmBulkDelete}
        title="Delete selected exercises?"
        message={`${selectedExerciseIds.size} exercise${selectedExerciseIds.size === 1 ? '' : 's'} will be removed from your exercise library.`}
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      <UndoToast message={message} onUndo={undo} />
    </div>
  )
}

export default RoutinesPage
