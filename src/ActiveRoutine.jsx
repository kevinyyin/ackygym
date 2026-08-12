import { useEffect, useState } from 'react'
import Card from './Card'
import { fetchLastSet } from './lastSet'
import { logSet } from './logSet'
import { BarbellIcon } from './icons'
import PlateCalculatorModal from './PlateCalculatorModal'

function ActiveRoutine({ routine, userId, onExit, onLogged, onError }) {
  const [rows, setRows] = useState(null)
  const [calculatorRowId, setCalculatorRowId] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadRows() {
      const results = await Promise.all(
        routine.routine_exercises.map(async (re) => {
          const { data, error } = await fetchLastSet(userId, re.exercise_id)
          return {
            exerciseId: re.exercise_id,
            name: re.exercises.name,
            weight: error || !data ? '' : String(data.weight),
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
  }, [routine, userId])

  function updateRow(exerciseId, field, value) {
    setRows((current) =>
      current.map((row) => (row.exerciseId === exerciseId ? { ...row, [field]: value } : row))
    )
  }

  async function handleLog(row) {
    onError('')
    const { error } = await logSet({
      userId,
      exerciseId: row.exerciseId,
      weight: Number(row.weight),
      reps: Number(row.reps),
    })
    if (error) {
      onError(error.message)
      return
    }
    onLogged()
  }

  const inputClasses =
    'w-16 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-center font-mono text-sm text-chalk focus:border-blue-500 focus:outline-none'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
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
        <p className="mt-3 text-sm text-chalk-dim">Loading…</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.exerciseId}
              className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-chalk">{row.name}</span>
              <input
                type="number"
                value={row.weight}
                onChange={(e) => updateRow(row.exerciseId, 'weight', e.target.value)}
                placeholder="Wt"
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
                value={row.reps}
                onChange={(e) => updateRow(row.exerciseId, 'reps', e.target.value)}
                placeholder="Reps"
                className={inputClasses}
              />
              <button
                type="button"
                onClick={() => handleLog(row)}
                disabled={!row.weight || !row.reps}
                className="shrink-0 rounded-md bg-blue-500 px-3 py-1.5 font-body text-sm font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
              >
                Log
              </button>
            </li>
          ))}
        </ul>
      )}

      {calculatorRowId !== null && (
        <PlateCalculatorModal
          initialWeight={Number(rows.find((r) => r.exerciseId === calculatorRowId)?.weight) || 0}
          onClose={() => setCalculatorRowId(null)}
        />
      )}
    </Card>
  )
}

export default ActiveRoutine
