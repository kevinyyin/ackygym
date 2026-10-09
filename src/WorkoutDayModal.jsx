import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { logSet } from './logSet'
import { formatDate } from './dateUtils'
import Sheet from './Sheet'
import Button from './Button'
import ConfirmModal from './ConfirmModal'
import { toDisplayWeight } from './weightUnits'
import { groupSetsByExercise } from './groupByUser'

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
    <>
      <Sheet
        open={!!date}
        onClose={onClose}
        title={date ? formatDate(date, { year: true }) : ''}
      >
        {exerciseGroups === null ? (
          <p className="text-[15px] text-chalk-dim">Loading…</p>
        ) : exerciseGroups.length === 0 ? (
          <p className="text-[15px] text-chalk-dim">No sets logged this day.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {exerciseGroups.map((group) => (
              <li key={group.exerciseId}>
                <p className="text-[17px] font-semibold text-chalk">{group.name}</p>
                <p className="mt-1 text-[15px] text-chalk-dim tabular-nums">
                  {group.sets
                    .map((s) => `${toDisplayWeight(s.weight, weightUnit)}${weightUnit}×${s.reps}`)
                    .join(', ')}
                </p>
              </li>
            ))}
          </ul>
        )}

        {exerciseGroups && exerciseGroups.length > 0 && (
          <Button
            className="mt-6"
            onClick={() => setConfirmRepeat(true)}
            loading={repeating}
          >
            Repeat this workout
          </Button>
        )}
      </Sheet>

      <ConfirmModal
        open={confirmRepeat}
        title="Repeat this workout?"
        message={`${sets?.length ?? 0} set${sets?.length === 1 ? '' : 's'} will be logged as part of today's workout.`}
        confirmLabel="Repeat"
        onConfirm={handleRepeat}
        onCancel={() => setConfirmRepeat(false)}
      />
    </>
  )
}

export default WorkoutDayModal
