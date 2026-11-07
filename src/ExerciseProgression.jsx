import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { TrophyIcon, CheckIcon, CloseIcon } from './icons'
import { estimatedOneRepMax } from './oneRepMax'
import { formatDate } from './dateUtils'
import { recomputeIsPr, byDateThenId } from './logSet'
import { groupSetsByDate } from './groupByUser'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import TrendChart from './TrendChart'
import Skeleton from './Skeleton'
import { isValidSet } from './validation'
import { toDisplayWeight, toStorageWeightKg } from './weightUnits'

function ExerciseProgression({ exerciseId, userId, weightUnit, onError, onChanged }) {
  const [sets, setSets] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingSetId, setEditingSetId] = useState(null)
  const [draftWeight, setDraftWeight] = useState('')
  const [draftReps, setDraftReps] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchSets() {
      const { data, error } = await supabase
        .from('sets')
        .select('id, weight, reps, is_pr, workouts!inner(date)')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)

      if (error) {
        onError(error.message)
        return
      }

      // Sorted client-side — `.order(col, { foreignTable })` is a no-op on
      // this project's PostgREST version, see lastSet.js for details.
      if (!cancelled) setSets([...data].sort(byDateThenId))
    }

    fetchSets()
    return () => {
      cancelled = true
    }
  }, [exerciseId, userId, refreshKey, onError])

  function startEdit(set) {
    setEditingSetId(set.id)
    setDraftWeight(String(toDisplayWeight(set.weight, weightUnit)))
    setDraftReps(String(set.reps))
  }

  function cancelEdit() {
    setEditingSetId(null)
  }

  function isDraftValid() {
    return isValidSet({ weight: draftWeight, reps: draftReps })
  }

  // An edit or delete can move the PR, so both re-derive is_pr before
  // refreshing. Resolves to whether every step succeeded.
  async function finishWrite(writeError) {
    const error = writeError ?? (await recomputeIsPr(userId, exerciseId)).error
    if (error) {
      onError(error.message)
      return false
    }
    setRefreshKey((k) => k + 1)
    onChanged?.()
    return true
  }

  async function saveEdit(setId) {
    if (!isDraftValid()) return

    onError('')
    const { error } = await supabase
      .from('sets')
      .update({ weight: toStorageWeightKg(draftWeight, weightUnit), reps: Number(draftReps) })
      .eq('id', setId)
    if (await finishWrite(error)) setEditingSetId(null)
  }

  async function handleDelete(setId) {
    onError('')
    const { error } = await supabase.from('sets').delete().eq('id', setId)
    await finishWrite(error)
  }

  if (sets === null) {
    return (
      <div aria-busy="true" className="mt-3 flex flex-col gap-3">
        <span className="sr-only">Loading</span>
        <Skeleton tone="surface-2" className="h-24 rounded-field" />
        <Skeleton tone="surface-2" className="h-40 rounded-field" />
      </div>
    )
  }

  const sessions = groupSetsByDate(sets)

  if (sessions.length === 0) {
    return <p className="mt-3 text-[15px] text-chalk-dim">No sets logged yet for this exercise.</p>
  }

  const chartData = sessions.map((session) => ({
    date: formatDate(session.date),
    value: toDisplayWeight(Math.max(...session.sets.map((s) => s.weight)), weightUnit),
  }))

  // Computed from raw stored (kg) weights — estimatedOneRepMax is a physical
  // formula and must stay unit-consistent regardless of display unit; only
  // the final number is converted for display below.
  let bestE1rmKg = 0
  let bestE1rmDate = null
  for (const session of sessions) {
    for (const set of session.sets) {
      const e1rm = estimatedOneRepMax(set.weight, set.reps)
      if (e1rm > bestE1rmKg) {
        bestE1rmKg = e1rm
        bestE1rmDate = session.date
      }
    }
  }
  const bestE1rm = toDisplayWeight(bestE1rmKg, weightUnit)

  const sessionsNewestFirst = [...sessions].reverse()

  const fieldClasses =
    'h-11 w-20 min-w-0 rounded-field bg-surface px-3 text-center text-base tabular-nums text-chalk focus:ring-2 focus:ring-blue-500 focus:outline-none'

  return (
    <div className="mt-3 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3 rounded-field bg-surface-2 p-4">
          <div>
            <p className="text-caption text-chalk-dim">Est. 1RM</p>
            <p className="mt-0.5 text-title tabular-nums text-chalk">
              {bestE1rm}
              <span className="ml-1.5 text-[17px] font-normal tracking-normal text-chalk-dim">{weightUnit}</span>
            </p>
          </div>
          {bestE1rmDate && <p className="text-caption text-chalk-dim">{formatDate(bestE1rmDate)}</p>}
        </div>
        <p className="px-1 text-caption text-chalk-dim">
          Estimated one-rep max: the heaviest single lift your logged sets suggest you could do.
        </p>
      </div>

      {sessions.length === 1 ? (
        <p className="px-1 text-[15px] text-chalk-dim">Log another session to see a trend.</p>
      ) : (
        <TrendChart
          className="h-48 w-full"
          data={chartData}
          formatTooltip={(value) => [`${value} ${weightUnit}`, 'Weight']}
        />
      )}

      <div className="flex flex-col gap-4">
        {sessionsNewestFirst.map((session) => (
          <section key={session.date} className="flex flex-col gap-1.5">
            <h4 className="px-1 text-caption font-medium text-chalk-dim">{formatDate(session.date, { year: true })}</h4>
            <ul className="divide-y divide-line rounded-field bg-surface-2">
              {session.sets.map((set) => {
                const setLabel = `${toDisplayWeight(set.weight, weightUnit)} ${weightUnit} × ${set.reps} on ${formatDate(session.date)}`

                if (editingSetId === set.id) {
                  return (
                    <li key={set.id} className="flex min-h-14 items-center gap-1.5 py-1.5 pr-1 pl-3">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        autoFocus
                        value={draftWeight}
                        onChange={(e) => setDraftWeight(e.target.value)}
                        aria-label={`Weight (${weightUnit})`}
                        className={fieldClasses}
                      />
                      <span className="text-caption text-chalk-dim">{weightUnit} ×</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={draftReps}
                        onChange={(e) => setDraftReps(e.target.value)}
                        aria-label="Reps"
                        className={`${fieldClasses} w-16`}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(set.id)}
                        disabled={!isDraftValid()}
                        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-blue-400 disabled:opacity-40"
                        aria-label={`Save ${setLabel}`}
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-chalk-dim"
                        aria-label="Cancel editing"
                      >
                        <CloseIcon className="h-5 w-5" />
                      </button>
                    </li>
                  )
                }

                return (
                  <li key={set.id} className="flex min-h-12 items-center justify-between gap-2 py-0.5 pr-1 pl-4">
                    <span className="flex items-center gap-1.5 text-[15px] tabular-nums text-chalk">
                      {toDisplayWeight(set.weight, weightUnit)} {weightUnit} × {set.reps}
                      {set.is_pr && (
                        <TrophyIcon className="h-4 w-4 shrink-0 text-amber" role="img" aria-label="New PR" />
                      )}
                    </span>
                    <span className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => startEdit(set)}
                        aria-label={`Edit ${setLabel}`}
                        className="h-11 rounded-full px-2 text-[15px] text-blue-400 active:text-blue-300"
                      >
                        Edit
                      </button>
                      <ConfirmDeleteButton
                        onConfirm={() => handleDelete(set.id)}
                        label={setLabel}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                      />
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

export default ExerciseProgression
