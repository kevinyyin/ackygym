import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { logSet } from './logSet'
import { formatDate } from './dateUtils'
import Card from './Card'
import ConfirmModal from './ConfirmModal'
import { useEscapeToClose } from './useEscapeToClose'
import { useModalFocusTrap } from './useModalFocusTrap'
import { toDisplayWeight } from './weightUnits'
import { CloseIcon } from './icons'

function groupSetsByExercise(sets) {
  const order = []
  const byExerciseId = new Map()

  for (const set of sets) {
    if (!byExerciseId.has(set.exercise_id)) {
      byExerciseId.set(set.exercise_id, { exerciseId: set.exercise_id, name: set.exercises.name, sets: [] })
      order.push(set.exercise_id)
    }
    byExerciseId.get(set.exercise_id).sets.push(set)
  }

  return order.map((exerciseId) => byExerciseId.get(exerciseId))
}

// Shows one past day's logged sets and offers to re-log all of them as
// today's sets — a whole-session repeat, distinct from the existing
// per-set repeat (RepeatIcon) on Home, which only replays one set at a time.
function WorkoutDayModal({ date, userId, weightUnit, onClose, onError, onRepeated }) {
  const [sets, setSets] = useState(null)
  const [repeating, setRepeating] = useState(false)
  const [confirmRepeat, setConfirmRepeat] = useState(false)
  // Mirrors `repeating` but updates synchronously, so a rapid double-tap on
  // the confirm button (both landing before React re-renders) can't both
  // slip past the guard — see the same note in WorkoutForm.jsx.
  const repeatingRef = useRef(false)

  useEscapeToClose(!!date, onClose)
  const containerRef = useModalFocusTrap(!!date)
  const titleId = useId()

  useEffect(() => {
    if (!date) return
    let cancelled = false

    async function fetchSets() {
      setSets(null)
      const { data, error } = await supabase
        .from('sets')
        .select('id, weight, reps, exercise_id, exercises(name), workouts!inner(date)')
        .eq('user_id', userId)
        .eq('workouts.date', date)
        .order('id')

      if (error) {
        onError(error.message)
        return
      }
      if (!cancelled) setSets(data)
    }

    fetchSets()
    return () => {
      cancelled = true
    }
  }, [date, userId, onError])

  if (!date) return null

  const exerciseGroups = sets ? groupSetsByExercise(sets) : null

  // Sequential, not Promise.all — logSet's PR check reads the current max
  // weight at call time, so replaying same-exercise sets in parallel could
  // race and mis-flag PRs the same way the historical sets never did.
  async function handleRepeat() {
    if (repeatingRef.current || !sets || sets.length === 0) return
    repeatingRef.current = true
    setRepeating(true)
    onError('')

    for (const set of sets) {
      const { error } = await logSet({
        userId,
        exerciseId: set.exercise_id,
        weight: set.weight,
        reps: set.reps,
      })
      if (error) {
        onError(error.message)
        repeatingRef.current = false
        setRepeating(false)
        setConfirmRepeat(false)
        return
      }
    }

    repeatingRef.current = false
    setRepeating(false)
    setConfirmRepeat(false)
    onRepeated()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <Card
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl leading-none tracking-tight text-chalk uppercase">
            {formatDate(date, { year: true })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-chalk-dim hover:text-danger"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {exerciseGroups === null ? (
          <p className="mt-4 text-sm text-chalk-dim">Loading…</p>
        ) : exerciseGroups.length === 0 ? (
          <p className="mt-4 text-sm text-chalk-dim">No sets logged this day.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {exerciseGroups.map((group) => (
              <li key={group.exerciseId}>
                <p className="font-medium text-chalk">{group.name}</p>
                <p className="mt-1 font-mono text-sm text-chalk-dim">
                  {group.sets
                    .map((s) => `${toDisplayWeight(s.weight, weightUnit)}${weightUnit}×${s.reps}`)
                    .join(', ')}
                </p>
              </li>
            ))}
          </ul>
        )}

        {exerciseGroups && exerciseGroups.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmRepeat(true)}
            disabled={repeating}
            className="mt-5 w-full rounded-md bg-blue-500 px-4 py-2.5 font-body text-sm font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
          >
            {repeating ? 'Repeating…' : 'Repeat this workout'}
          </button>
        )}
      </Card>

      <ConfirmModal
        open={confirmRepeat}
        title="Repeat this workout?"
        message={`${sets?.length ?? 0} set${sets?.length === 1 ? '' : 's'} will be logged as part of today's workout.`}
        confirmLabel="Repeat"
        onConfirm={handleRepeat}
        onCancel={() => setConfirmRepeat(false)}
      />
    </div>
  )
}

export default WorkoutDayModal
