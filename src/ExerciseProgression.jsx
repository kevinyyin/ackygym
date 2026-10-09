import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { TrophyIcon, CheckIcon, CloseIcon } from './icons'
import { estimatedOneRepMax } from './oneRepMax'
import { formatDate } from './dateUtils'
import { recomputeIsPr, byDateThenId } from './logSet'
import { groupSetsByDate } from './groupByUser'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import TrendChart from './TrendChart'
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
    return <p className="mt-4 text-sm text-chalk-dim">Loading…</p>
  }

  const sessions = groupSetsByDate(sets)

  if (sessions.length === 0) {
    return <p className="mt-4 text-sm text-chalk-dim">No sets logged yet for this exercise.</p>
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

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-baseline justify-between rounded-md border border-line bg-surface-2 px-3 py-2">
        <div>
          <p className="text-[11px] tracking-wide text-chalk-dim uppercase">Est. 1RM</p>
          <p className="font-mono text-2xl font-bold text-blue-400">
            {bestE1rm} <span className="text-base font-normal text-chalk-dim">{weightUnit}</span>
          </p>
        </div>
        {bestE1rmDate && (
          <p className="font-mono text-[11px] text-chalk-dim/70">{formatDate(bestE1rmDate)}</p>
        )}
      </div>
      <p className="-mt-2 text-xs text-chalk-dim">
        Estimated one-rep max — the heaviest single lift your logged sets suggest you could do.
      </p>

      {sessions.length === 1 ? (
        <p className="text-xs text-chalk-dim">Log another session to see a trend.</p>
      ) : (
        <TrendChart
          className="h-48 w-full"
          data={chartData}
          formatTooltip={(value) => [`${value} ${weightUnit}`, 'Weight']}
        />
      )}

      <ul className="flex flex-col gap-3">
        {sessionsNewestFirst.map((session) => (
          <li key={session.date}>
            <p className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
              {formatDate(session.date)}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {session.sets.map((set, i) => {
                const showWeight = i === 0 || set.weight !== session.sets[i - 1].weight
                const isEditing = editingSetId === set.id

                if (isEditing) {
                  return (
                    <li key={set.id} className="flex items-center gap-1.5 font-mono text-sm text-chalk-dim">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={draftWeight}
                        onChange={(e) => setDraftWeight(e.target.value)}
                        className="w-14 rounded-md border border-line bg-surface-2 px-1.5 py-1 text-center text-chalk focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-chalk-dim/60">{weightUnit} ×</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={draftReps}
                        onChange={(e) => setDraftReps(e.target.value)}
                        className="w-14 rounded-md border border-line bg-surface-2 px-1.5 py-1 text-center text-chalk focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(set.id)}
                        disabled={!isDraftValid()}
                        className="ml-auto shrink-0 text-blue-400 disabled:opacity-40"
                        aria-label="Save set"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="shrink-0 text-chalk-dim hover:text-danger"
                        aria-label="Cancel editing set"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </li>
                  )
                }

                return (
                  <li key={set.id} className="flex items-center justify-between gap-2 font-mono text-sm text-chalk-dim">
                    <span className="inline-flex items-center gap-1.5">
                      {showWeight && (
                        <>
                          {toDisplayWeight(set.weight, weightUnit)}
                          {weightUnit}
                          <span className="text-chalk-dim/60">×</span>
                        </>
                      )}
                      {set.reps}
                      {set.is_pr && (
                        <TrophyIcon className="h-3 w-3 shrink-0 text-amber" aria-label="New PR" />
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(set)}
                        aria-label="Edit set"
                        className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
                      >
                        Edit
                      </button>
                      <ConfirmDeleteButton onConfirm={() => handleDelete(set.id)} label="set" />
                    </span>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ExerciseProgression
