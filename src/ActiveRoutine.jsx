import { useEffect, useRef, useState } from 'react'
import Card from './Card'
import Button from './Button'
import { fetchLastSet } from './lastSet'
import { BarbellIcon, CheckIcon, TrophyIcon } from './icons'
import PlateCalculatorModal from './PlateCalculatorModal'
import { isValidSet } from './validation'
import { toDisplayWeight, toStorageWeightKg, convertWeightInput } from './weightUnits'
import Skeleton from './Skeleton'

function formatRepRange(min, max) {
  if (min != null && max != null) return min === max ? `aim for ${min}` : `aim for ${min}–${max}`
  if (min != null) return `aim for ${min}+`
  if (max != null) return `up to ${max}`
  return null
}

// One exercise in focus with the rest of the routine listed under it: mid-
// workout this card is the page, so it carries what's next and where you are.
function ActiveRoutine({ routine, userId, weightUnit, todaysOwnSets, onExit, onLogSet }) {
  const [rows, setRows] = useState(null)
  const [focusedId, setFocusedId] = useState(null)
  const [showCalculator, setShowCalculator] = useState(false)
  const [prExerciseIds, setPrExerciseIds] = useState(() => new Set())
  // Logging doesn't wait on the save (see Home's handleLogSet); this only
  // swallows an accidental double tap. A ref, because both taps can land
  // before React re-renders.
  const lastLogAtRef = useRef(-Infinity)

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
          const last = error ? null : data
          return {
            exerciseId: re.exercise_id,
            name: re.exercises.name,
            repMin: re.rep_min,
            repMax: re.rep_max,
            // Kept in kg; the inputs below hold the display unit.
            last,
            weight: last ? String(toDisplayWeight(last.weight, weightUnit)) : '',
            reps: last ? String(last.reps) : '',
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

  const doneCount = (exerciseId) => todaysOwnSets.filter((s) => s.exercise_id === exerciseId).length

  // Focus follows the tapped exercise, else the one just logged (more sets of
  // it are likely), else the first one not started today.
  const lastLoggedId = todaysOwnSets.at(-1)?.exercise_id
  const focused =
    rows &&
    (rows.find((r) => r.exerciseId === focusedId) ??
      rows.find((r) => r.exerciseId === lastLoggedId) ??
      rows.find((r) => doneCount(r.exerciseId) === 0) ??
      rows[0])

  function updateFocused(field, value) {
    setRows((current) =>
      current.map((row) => (row.exerciseId === focused.exerciseId ? { ...row, [field]: value } : row))
    )
    setPrExerciseIds((current) => {
      if (!current.has(focused.exerciseId)) return current
      const next = new Set(current)
      next.delete(focused.exerciseId)
      return next
    })
  }

  async function handleLog(e) {
    if (!isValidSet(focused)) return
    if (e.timeStamp - lastLogAtRef.current < 600) return
    lastLogAtRef.current = e.timeStamp

    const row = focused
    setFocusedId(row.exerciseId)
    const { error, isPr } = await onLogSet({
      exerciseId: row.exerciseId,
      exerciseName: row.name,
      weight: toStorageWeightKg(row.weight, weightUnit),
      reps: Number(row.reps),
    })
    if (error) return
    setPrExerciseIds((current) => {
      const next = new Set(current)
      if (isPr) next.add(row.exerciseId)
      else next.delete(row.exerciseId)
      return next
    })
  }

  const header = (
    <div className="flex items-center justify-between gap-3 pl-1">
      <p className="min-w-0 truncate text-caption text-chalk-dim">
        {routine.name}
        {focused && rows.length > 1 && ` · exercise ${rows.indexOf(focused) + 1} of ${rows.length}`}
      </p>
      <button
        type="button"
        onClick={onExit}
        className="h-11 shrink-0 rounded-full bg-surface-2 px-4 text-[15px] font-semibold text-chalk-dim active:text-chalk"
      >
        End
      </button>
    </div>
  )

  if (rows === null) {
    return (
      <Card className="flex flex-col gap-4 p-4">
        {header}
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading</span>
          <Skeleton tone="surface-2" className="h-8 w-2/3 rounded-field" />
          <Skeleton tone="surface-2" className="h-24 rounded-field" />
          <Skeleton tone="surface-2" className="h-[52px] rounded-full" />
        </div>
      </Card>
    )
  }

  if (!focused) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        {header}
        <p className="pl-1 text-[15px] text-chalk-dim">This routine has no exercises yet — add some in Train.</p>
      </Card>
    )
  }

  const setNumber = doneCount(focused.exerciseId) + 1
  const target = formatRepRange(focused.repMin, focused.repMax)
  const others = rows.filter((r) => r !== focused)
  // Not-started exercises first, in routine order; finished ones after.
  const upNext = [...others.filter((r) => doneCount(r.exerciseId) === 0), ...others.filter((r) => doneCount(r.exerciseId) > 0)]
  const lastLabel = (row) => row.last && `last ${toDisplayWeight(row.last.weight, weightUnit)} × ${row.last.reps}`
  const fieldTile =
    'flex flex-col items-center gap-0.5 rounded-[20px] bg-surface-2 px-3 pt-3 pb-2.5 text-caption text-chalk-dim focus-within:ring-2 focus-within:ring-blue-500'
  const fieldInput =
    'w-full bg-transparent text-center text-[36px] leading-none font-bold tracking-[-0.03em] text-chalk tabular-nums focus:outline-none'

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-4 p-4 pt-[18px]">
        {header}
        {rows.length > 1 && (
          <div
            aria-hidden="true"
            className="-mt-1.5 mx-1 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
          >
            {rows.map((row) => (
              <div
                key={row.exerciseId}
                className={`h-1 rounded-full ${
                  doneCount(row.exerciseId) > 0 ? 'bg-blue-400' : row === focused ? 'bg-blue-400/45' : 'bg-surface-2'
                }`}
              />
            ))}
          </div>
        )}

        <div className="flex items-start justify-between gap-3 pl-1">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="flex items-center gap-2 text-title text-chalk">
              <span className="truncate">{focused.name}</span>
              {prExerciseIds.has(focused.exerciseId) && (
                <TrophyIcon className="h-5 w-5 shrink-0 text-amber" role="img" aria-label="New PR" />
              )}
            </h2>
            <p className="text-[15px] text-chalk-dim">
              {[`Set ${setNumber}`, target, lastLabel(focused)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCalculator(true)}
            aria-label={`Plate calculator for ${focused.name}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-chalk-dim active:text-blue-400"
          >
            <BarbellIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <label className={fieldTile}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={focused.weight}
              onChange={(e) => updateFocused('weight', e.target.value)}
              placeholder="–"
              aria-label={`Weight in ${weightUnit}`}
              className={fieldInput}
            />
            {weightUnit}
          </label>
          <label className={fieldTile}>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={focused.reps}
              onChange={(e) => updateFocused('reps', e.target.value)}
              placeholder="–"
              aria-label="Reps"
              className={fieldInput}
            />
            reps
          </label>
        </div>

        <Button variant="accent" onClick={handleLog} disabled={!isValidSet(focused)}>
          Log set {setNumber}
        </Button>
      </Card>

      {upNext.length > 0 && (
        <section aria-label="Up next" className="flex flex-col px-2">
          <p className="pb-0.5 text-caption text-chalk-dim">Up next</p>
          <ul className="flex flex-col divide-y divide-line">
            {upNext.map((row) => {
              const done = doneCount(row.exerciseId)
              return (
                <li key={row.exerciseId}>
                  <button
                    type="button"
                    onClick={() => setFocusedId(row.exerciseId)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
                  >
                    <span className={`truncate text-[15px] font-medium ${done ? 'text-chalk-dim' : 'text-chalk'}`}>
                      {row.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-caption text-chalk-dim">
                      {done > 0 ? (
                        <>
                          <CheckIcon className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                          {done} {done === 1 ? 'set' : 'sets'}
                        </>
                      ) : (
                        [formatRepRange(row.repMin, row.repMax)?.replace('aim for ', ''), lastLabel(row)]
                          .filter(Boolean)
                          .join(' · ')
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <PlateCalculatorModal
        open={showCalculator}
        initialWeight={Number(focused?.weight) || 0}
        unit={weightUnit}
        onClose={() => setShowCalculator(false)}
      />
    </div>
  )
}

export default ActiveRoutine
