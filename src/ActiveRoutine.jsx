import { useEffect, useRef, useState } from 'react'
import Card from './Card'
import { fetchLastSet } from './lastSet'
import { logSet } from './logSet'
import { BarbellIcon, TrophyIcon } from './icons'
import PlateCalculatorModal from './PlateCalculatorModal'
import { isValidSet } from './validation'
import { toDisplayWeight, toStorageWeightKg, convertWeightInput } from './weightUnits'
import Skeleton from './Skeleton'

function ActiveRoutine({ routine, userId, weightUnit, onExit, onLogged, onError }) {
  const [rows, setRows] = useState(null)
  const [calculatorRowId, setCalculatorRowId] = useState(null)
  const [prExerciseIds, setPrExerciseIds] = useState(() => new Set())
  const [loggingExerciseIds, setLoggingExerciseIds] = useState(() => new Set())
  // Mirrors loggingExerciseIds but updates synchronously, so a rapid double
  // tap on the same row's Log button (both landing before React re-renders)
  // can't both slip past the guard — see the same note in WorkoutForm.jsx.
  const loggingExerciseIdsRef = useRef(new Set())

  // Re-converts every row's in-progress weight if the global unit is
  // flipped in Settings while this stays mounted underneath it — "adjust
  // state during render" (React's recommended pattern), matching
  // CalorieCalculator.jsx / the same block in WorkoutForm.jsx.
  const [prevWeightUnit, setPrevWeightUnit] = useState(weightUnit)
  if (prevWeightUnit !== weightUnit) {
    setPrevWeightUnit(weightUnit)
    setRows((current) =>
      current && current.map((row) => ({ ...row, weight: convertWeightInput(row.weight, prevWeightUnit, weightUnit) }))
    )
  }

  useEffect(() => {
    let cancelled = false

    async function loadRows() {
      const results = await Promise.all(
        routine.routine_exercises.map(async (re) => {
          const { data, error } = await fetchLastSet(userId, re.exercise_id)
          return {
            exerciseId: re.exercise_id,
            name: re.exercises.name,
            weight: error || !data ? '' : String(toDisplayWeight(data.weight, weightUnit)),
            reps: error || !data ? '' : String(data.reps),
          }
        })
      )
      if (!cancelled) setRows(results)
    }

    loadRows()
    return () => {
      cancelled = true
    }
    // weightUnit deliberately excluded — see the same rationale in
    // WorkoutForm.jsx: a unit flip re-converts existing rows above rather
    // than re-fetching and discarding in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine, userId])

  function updateRow(exerciseId, field, value) {
    setRows((current) =>
      current.map((row) => (row.exerciseId === exerciseId ? { ...row, [field]: value } : row))
    )
    setPrExerciseIds((current) => {
      if (!current.has(exerciseId)) return current
      const next = new Set(current)
      next.delete(exerciseId)
      return next
    })
  }

  async function handleLog(row) {
    if (loggingExerciseIdsRef.current.has(row.exerciseId) || !isValidSet(row)) return
    loggingExerciseIdsRef.current.add(row.exerciseId)
    onError('')
    setLoggingExerciseIds((current) => new Set(current).add(row.exerciseId))

    const { error, isPr } = await logSet({
      userId,
      exerciseId: row.exerciseId,
      weight: toStorageWeightKg(row.weight, weightUnit),
      reps: Number(row.reps),
    })

    loggingExerciseIdsRef.current.delete(row.exerciseId)
    setLoggingExerciseIds((current) => {
      const next = new Set(current)
      next.delete(row.exerciseId)
      return next
    })

    if (error) {
      onError(error.message)
      return
    }
    setPrExerciseIds((current) => {
      const next = new Set(current)
      if (isPr) next.add(row.exerciseId)
      else next.delete(row.exerciseId)
      return next
    })
    onLogged()
  }

  const inputClasses =
    'w-16 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-center font-mono text-sm text-chalk focus:border-blue-500 focus:outline-none'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-[550] tracking-[0.2em] text-chalk-dim uppercase">
          Active routine — {routine.name}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
        >
          Exit
        </button>
      </div>

      {rows === null ? (
        <div aria-busy="true" className="mt-3 flex flex-col gap-2">
          <span className="sr-only">Loading</span>
          <Skeleton tone="surface-2" className="h-11 rounded-field" />
          <Skeleton tone="surface-2" className="h-11 rounded-field" />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.exerciseId}
              className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-chalk">
                <span className="truncate">{row.name}</span>
                {prExerciseIds.has(row.exerciseId) && (
                  <TrophyIcon className="h-3.5 w-3.5 shrink-0 text-amber" aria-label="New PR" />
                )}
              </span>
              <div className="flex items-center justify-between gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={row.weight}
                  onChange={(e) => updateRow(row.exerciseId, 'weight', e.target.value)}
                  placeholder={`Wt (${weightUnit})`}
                  className={inputClasses}
                />
                <button
                  type="button"
                  onClick={() => setCalculatorRowId(row.exerciseId)}
                  aria-label={`Plate calculator for ${row.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-chalk-dim active:border-blue-500 active:text-blue-400"
                >
                  <BarbellIcon className="h-4 w-4" />
                </button>
                <span className="text-chalk-dim/60">×</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={row.reps}
                  onChange={(e) => updateRow(row.exerciseId, 'reps', e.target.value)}
                  placeholder="Reps"
                  className={inputClasses}
                />
                <button
                  type="button"
                  onClick={() => handleLog(row)}
                  disabled={!isValidSet(row) || loggingExerciseIds.has(row.exerciseId)}
                  className="shrink-0 rounded-md bg-blue-500 px-3 py-1.5 font-body text-sm font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
                >
                  Log
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {calculatorRowId !== null && (
        <PlateCalculatorModal
          initialWeight={Number(rows.find((r) => r.exerciseId === calculatorRowId)?.weight) || 0}
          unit={weightUnit}
          onClose={() => setCalculatorRowId(null)}
        />
      )}
    </Card>
  )
}

export default ActiveRoutine
