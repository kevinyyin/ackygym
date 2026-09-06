import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { supabase } from './supabaseClient'
import { TrophyIcon, CheckIcon, CloseIcon } from './icons'
import { estimatedOneRepMax } from './oneRepMax'
import { formatDate } from './dateUtils'
import { recomputeIsPr } from './logSet'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import { isValidSet } from './validation'

function groupSetsBySession(sets) {
  const order = []
  const byDate = new Map()

  for (const set of sets) {
    const date = set.workouts.date
    if (!byDate.has(date)) {
      byDate.set(date, { date, sets: [] })
      order.push(date)
    }
    byDate.get(date).sets.push(set)
  }

  return order.map((date) => byDate.get(date))
}

function ExerciseProgression({ exerciseId, userId, onError, onChanged }) {
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
      const sorted = [...data].sort((a, b) => {
        if (a.workouts.date !== b.workouts.date) {
          return a.workouts.date < b.workouts.date ? -1 : 1
        }
        return a.id - b.id
      })

      if (!cancelled) setSets(sorted)
    }

    fetchSets()
    return () => {
      cancelled = true
    }
  }, [exerciseId, userId, refreshKey, onError])

  function startEdit(set) {
    setEditingSetId(set.id)
    setDraftWeight(String(set.weight))
    setDraftReps(String(set.reps))
  }

  function cancelEdit() {
    setEditingSetId(null)
  }

  function isDraftValid() {
    return isValidSet({ weight: draftWeight, reps: draftReps })
  }

  async function saveEdit(setId) {
    if (!isDraftValid()) return

    onError('')
    const { error } = await supabase
      .from('sets')
      .update({ weight: Number(draftWeight), reps: Number(draftReps) })
      .eq('id', setId)

    if (error) {
      onError(error.message)
      return
    }

    const { error: recomputeError } = await recomputeIsPr(userId, exerciseId)
    if (recomputeError) {
      onError(recomputeError.message)
      return
    }

    setEditingSetId(null)
    setRefreshKey((k) => k + 1)
    onChanged?.()
  }

  async function handleDelete(setId) {
    onError('')
    const { error } = await supabase.from('sets').delete().eq('id', setId)
    if (error) {
      onError(error.message)
      return
    }

    const { error: recomputeError } = await recomputeIsPr(userId, exerciseId)
    if (recomputeError) {
      onError(recomputeError.message)
      return
    }

    setRefreshKey((k) => k + 1)
    onChanged?.()
  }

  if (sets === null) {
    return <p className="mt-4 text-sm text-chalk-dim">Loading…</p>
  }

  const sessions = groupSetsBySession(sets)

  if (sessions.length === 0) {
    return <p className="mt-4 text-sm text-chalk-dim">No sets logged yet for this exercise.</p>
  }

  const chartData = sessions.map((session) => ({
    date: formatDate(session.date),
    weight: Math.max(...session.sets.map((s) => s.weight)),
  }))

  let bestE1rm = 0
  let bestE1rmDate = null
  for (const session of sessions) {
    for (const set of session.sets) {
      const e1rm = estimatedOneRepMax(set.weight, set.reps)
      if (e1rm > bestE1rm) {
        bestE1rm = e1rm
        bestE1rmDate = session.date
      }
    }
  }

  const sessionsNewestFirst = [...sessions].reverse()

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-baseline justify-between rounded-md border border-line bg-surface-2 px-3 py-2">
        <div>
          <p className="text-[11px] tracking-wide text-chalk-dim uppercase">Est. 1RM</p>
          <p className="font-mono text-2xl font-bold text-blue-400">{bestE1rm}</p>
        </div>
        {bestE1rmDate && (
          <p className="font-mono text-[11px] text-chalk-dim/70">{formatDate(bestE1rmDate)}</p>
        )}
      </div>

      {sessions.length === 1 ? (
        <p className="text-xs text-chalk-dim">Log another session to see a trend.</p>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--color-chalk-dim)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-line)' }}
              />
              <YAxis
                tick={{ fill: 'var(--color-chalk-dim)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-line)',
                  borderRadius: 6,
                  color: 'var(--color-chalk)',
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--color-chalk-dim)' }}
                formatter={(value) => [value, 'Weight']}
              />
              <Line
                type="monotone"
                dataKey="weight"
                name="Weight"
                stroke="var(--color-blue-500)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-blue-500)' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
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
                      <span className="text-chalk-dim/60">×</span>
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
                          {set.weight}
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
