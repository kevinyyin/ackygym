import { useEffect, useRef, useState } from 'react'
import { useCachedState } from './pageCache'
import { fetchLastSet } from './lastSet'
import { groupByMuscle } from './exerciseGrouping'
import { BarbellIcon } from './icons'
import PlateCalculatorModal from './PlateCalculatorModal'
import ExercisePicker from './ExercisePicker'
import Button from './Button'
import { isValidSet } from './validation'
import { toDisplayWeight, toStorageWeightKg, convertWeightInput } from './weightUnits'

function WorkoutForm({ exercises, routines, userId, weightUnit, lastExerciseId, onLogSet, onError }) {
  // Cached so a tab switch mid-workout doesn't reset the picked routine and exercise.
  const [routineId, setRoutineId] = useCachedState('workoutForm:routineId', '')
  const [exerciseId, setExerciseId] = useCachedState('workoutForm:exerciseId', '')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [showCalculator, setShowCalculator] = useState(false)
  // Re-converts an in-progress weight value if the global unit is flipped in
  // Settings while this form stays mounted underneath it — "adjust state
  // during render" (React's recommended pattern), matching CalorieCalculator.jsx.
  const [prevWeightUnit, setPrevWeightUnit] = useState(weightUnit)
  if (prevWeightUnit !== weightUnit) {
    setPrevWeightUnit(weightUnit)
    setWeight((current) => convertWeightInput(current, prevWeightUnit, weightUnit))
  }
  // Logging no longer waits on the save, so nothing is disabled while it runs;
  // this only swallows an accidental double tap. A ref, because both taps can
  // land before React re-renders.
  const lastSubmitRef = useRef(0)

  const selectedRoutine = routineId ? routines.find((r) => r.id === Number(routineId)) : null
  const availableExercises = selectedRoutine
    ? groupByMuscle(selectedRoutine.routine_exercises, (re) => re.exercises)
        .flatMap((g) => g.items)
        .map((re) => exercises.find((ex) => ex.id === re.exercise_id))
        .filter(Boolean)
    : exercises

  // Unpicked, the form follows the exercise logged most recently today rather
  // than the list's first entry, so a returning user doesn't log to the wrong
  // lift. A cached pick no longer in the list (deleted, filtered) is ignored.
  const isAvailable = (id) => availableExercises.some((ex) => ex.id === Number(id))
  const selectedExerciseId =
    (isAvailable(exerciseId) && exerciseId) ||
    (isAvailable(lastExerciseId) && lastExerciseId) ||
    availableExercises[0]?.id ||
    ''

  function handleRoutineChange(value) {
    setRoutineId(value)
    setExerciseId('')
  }

  useEffect(() => {
    if (!selectedExerciseId) return

    let cancelled = false

    async function loadLastSet() {
      const { data, error } = await fetchLastSet(userId, Number(selectedExerciseId))
      if (cancelled) return

      if (error) {
        onError(error.message)
        return
      }

      setWeight(data ? String(toDisplayWeight(data.weight, weightUnit)) : '')
      setReps(data ? String(data.reps) : '')
    }

    loadLastSet()
    return () => {
      cancelled = true
    }
    // weightUnit is read but deliberately excluded: this effect should only
    // re-fetch when the selected exercise changes, not re-run (and discard
    // any in-progress typed value) when the unit is flipped — that case is
    // handled separately above by re-converting the current `weight` state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExerciseId, userId, onError])

  function handleSubmit(e) {
    e.preventDefault()
    if (!selectedExerciseId || !isValidSet({ weight, reps })) return
    if (e.timeStamp - lastSubmitRef.current < 600) return
    lastSubmitRef.current = e.timeStamp

    const exercise = exercises.find((ex) => ex.id === Number(selectedExerciseId))
    // Values stay put: the next set is usually the same weight and reps.
    onLogSet({
      exerciseId: Number(selectedExerciseId),
      exerciseName: exercise?.name ?? '',
      weight: toStorageWeightKg(weight, weightUnit),
      reps: Number(reps),
    })
  }

  const pickerClasses =
    'h-11 w-full min-w-0 rounded-field bg-surface-2 px-4 text-base text-chalk placeholder:text-chalk-dim focus:ring-2 focus:ring-blue-500 focus:outline-none'
  // The two numbers are what you check between sets, so they read large.
  const numberClasses =
    'h-14 w-full min-w-0 rounded-field bg-surface-2 px-4 text-[22px] font-semibold tabular-nums text-chalk placeholder:text-[17px] placeholder:font-normal placeholder:text-chalk-dim focus:ring-2 focus:ring-blue-500 focus:outline-none'
  const labelClasses = 'flex min-w-0 flex-col gap-1.5 text-caption text-chalk-dim'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {routines.length > 0 && (
        <select
          value={routineId}
          onChange={(e) => handleRoutineChange(e.target.value)}
          aria-label="Show exercises from"
          className={pickerClasses}
        >
          <option value="">All exercises</option>
          {routines.map((routine) => (
            <option key={routine.id} value={routine.id}>
              {routine.name}
            </option>
          ))}
        </select>
      )}
      <ExercisePicker
        exercises={availableExercises}
        value={selectedExerciseId}
        onChange={setExerciseId}
        placeholder="Search exercises"
        emptyMessage={selectedRoutine ? 'No exercises in this routine' : 'No exercises yet'}
        inputClassName={pickerClasses}
      />
      {/* Visible labels: the fields prefill from your last set, so a
          placeholder would never show and "50" alone doesn't say kg or reps. */}
      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className={labelClasses}>
          Weight ({weightUnit})
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0"
            required
            className={numberClasses}
          />
        </label>
        <button
          type="button"
          onClick={() => setShowCalculator(true)}
          aria-label="Plate calculator"
          aria-haspopup="dialog"
          className="flex h-14 w-12 items-center justify-center rounded-field bg-surface-2 text-chalk-dim active:text-chalk"
        >
          <BarbellIcon className="h-5 w-5" />
        </button>
        <label className={labelClasses}>
          Reps
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="0"
            required
            className={numberClasses}
          />
        </label>
      </div>
      <Button
        type="submit"
        variant="accent"
        className="mt-1"
        disabled={!selectedExerciseId || !isValidSet({ weight, reps })}
      >
        Log set
      </Button>

      <PlateCalculatorModal
        open={showCalculator}
        initialWeight={Number(weight) || 0}
        unit={weightUnit}
        onClose={() => setShowCalculator(false)}
      />
    </form>
  )
}

export default WorkoutForm
