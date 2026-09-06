import { useEffect, useRef, useState } from 'react'
import { logSet } from './logSet'
import { fetchLastSet } from './lastSet'
import { groupByMuscle } from './exerciseGrouping'
import { BarbellIcon } from './icons'
import PlateCalculatorModal from './PlateCalculatorModal'
import ExercisePicker from './ExercisePicker'
import { isValidSet } from './validation'
import { toDisplayWeight, toStorageWeightKg, convertWeight, roundWeight } from './weightUnits'

function WorkoutForm({ exercises, routines, userId, weightUnit, onLogged, onError }) {
  const [routineId, setRoutineId] = useState('')
  const [exerciseId, setExerciseId] = useState('')
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [showCalculator, setShowCalculator] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Re-converts an in-progress weight value if the global unit is flipped in
  // Settings while this form stays mounted underneath it — "adjust state
  // during render" (React's recommended pattern), matching CalorieCalculator.jsx.
  const [prevWeightUnit, setPrevWeightUnit] = useState(weightUnit)
  if (prevWeightUnit !== weightUnit) {
    setPrevWeightUnit(weightUnit)
    setWeight((current) => {
      if (current === '') return current
      const numeric = Number(current)
      return Number.isNaN(numeric) ? current : String(roundWeight(convertWeight(numeric, prevWeightUnit, weightUnit)))
    })
  }
  // Guards re-entrancy for rapid double-taps that land inside the same
  // event-loop tick, before React has re-rendered with `submitting: true` —
  // the `submitting` state alone isn't enough because both clicks read the
  // stale value captured by the render they were dispatched from. A ref
  // updates synchronously, so the second call sees it immediately.
  const submittingRef = useRef(false)

  const selectedRoutine = routineId ? routines.find((r) => r.id === Number(routineId)) : null
  const availableExercises = selectedRoutine
    ? groupByMuscle(selectedRoutine.routine_exercises, (re) => re.exercises)
        .flatMap((g) => g.items)
        .map((re) => exercises.find((ex) => ex.id === re.exercise_id))
        .filter(Boolean)
    : exercises

  const selectedExerciseId = exerciseId || availableExercises[0]?.id || ''

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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedExerciseId || submittingRef.current || !isValidSet({ weight, reps })) return
    submittingRef.current = true
    onError('')
    setSubmitting(true)

    const { error } = await logSet({
      userId,
      exerciseId: Number(selectedExerciseId),
      weight: toStorageWeightKg(weight, weightUnit),
      reps: Number(reps),
    })

    submittingRef.current = false
    setSubmitting(false)

    if (error) {
      onError(error.message)
      return
    }

    setWeight('')
    setReps('')
    onLogged()
  }

  const inputClasses =
    'w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {routines.length > 0 && (
        <select
          value={routineId}
          onChange={(e) => handleRoutineChange(e.target.value)}
          className={inputClasses}
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
        inputClassName={inputClasses}
      />
      <div className="flex gap-3">
        <input
          type="number"
          min="0"
          step="any"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={`Weight (${weightUnit})`}
          required
          className={inputClasses}
        />
        <button
          type="button"
          onClick={() => setShowCalculator(true)}
          aria-label="Plate calculator"
          className="flex shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 px-3 text-chalk-dim active:border-blue-500 active:text-blue-400"
        >
          <BarbellIcon className="h-5 w-5" />
        </button>
        <input
          type="number"
          min="1"
          step="1"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="Reps"
          required
          className={inputClasses}
        />
      </div>
      <button
        type="submit"
        disabled={!selectedExerciseId || submitting || !isValidSet({ weight, reps })}
        className="w-full rounded-md bg-blue-500 px-4 py-3 font-body text-base font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
      >
        {submitting ? 'Logging…' : 'Log set'}
      </button>

      {showCalculator && (
        <PlateCalculatorModal
          initialWeight={Number(weight) || 0}
          unit={weightUnit}
          onClose={() => setShowCalculator(false)}
        />
      )}
    </form>
  )
}

export default WorkoutForm
