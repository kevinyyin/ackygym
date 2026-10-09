import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Card from './Card'
import MuscleBodyMap from './MuscleBodyMap'
import { sortMuscleGroups } from './muscleGroupOrder'
import { getDateDaysAgoString } from './dateUtils'
import Skeleton from './Skeleton'
import { usePersistedState } from './usePersistedState'

const RANGE_OPTIONS = [
  { days: 7, pillLabel: '7D', summaryLabel: 'last 7 days' },
  { days: 14, pillLabel: '2W', summaryLabel: 'last 2 weeks' },
  { days: 30, pillLabel: '1M', summaryLabel: 'last month' },
]

function aggregateVolume(sets) {
  const byMuscle = new Map()

  for (const set of sets) {
    for (const m of set.exercises?.exercise_muscles ?? []) {
      if (!byMuscle.has(m.muscle)) {
        byMuscle.set(m.muscle, {
          name: m.muscle,
          label: m.muscle_groups?.label ?? m.muscle,
          primarySets: 0,
          secondarySets: 0,
        })
      }
      const entry = byMuscle.get(m.muscle)
      if (m.role === 'primary') entry.primarySets += 1
      else entry.secondarySets += 1
    }
  }

  return sortMuscleGroups([...byMuscle.values()])
}

function MuscleVolume({ userId, onError }) {
  const [rangeDays, setRangeDays] = usePersistedState('gym-tracker:muscle-volume-range-days', 7, (days) =>
    RANGE_OPTIONS.some((o) => o.days === days)
  )
  const [workoutCount, setWorkoutCount] = useState(0)
  const [sets, setSets] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const cutoff = getDateDaysAgoString(rangeDays - 1)

      const [workoutsResult, setsResult] = await Promise.all([
        supabase.from('workouts').select('id').eq('user_id', userId).gte('date', cutoff),
        supabase
          .from('sets')
          .select(
            'id, workouts!inner(date), exercises(exercise_muscles(muscle, role, muscle_groups(label)))'
          )
          .eq('user_id', userId)
          .gte('workouts.date', cutoff),
      ])

      if (cancelled) return

      if (workoutsResult.error || setsResult.error) {
        onError((workoutsResult.error ?? setsResult.error).message)
        return
      }

      setWorkoutCount(workoutsResult.data.length)
      setSets(setsResult.data)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId, rangeDays, onError])

  const volume = sets === null ? [] : aggregateVolume(sets)
  const volumeByCount = [...volume].sort(
    (a, b) => b.primarySets + b.secondarySets - (a.primarySets + a.secondarySets)
  )
  const bodyMapMuscles = volume.map((v) => ({
    muscle: v.name,
    role: v.primarySets > 0 ? 'primary' : 'secondary',
  }))
  const summaryLabel = RANGE_OPTIONS.find((o) => o.days === rangeDays).summaryLabel

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-[550] tracking-[0.2em] text-chalk-dim uppercase">
          Muscle volume
        </p>
        <div className="inline-flex shrink-0 rounded-full border border-line bg-surface-2 p-0.5">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => setRangeDays(option.days)}
              className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${
                rangeDays === option.days ? 'bg-blue-500 text-onblue' : 'text-chalk-dim'
              }`}
            >
              {option.pillLabel}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 font-mono text-sm text-chalk-dim">
        <span className="font-bold text-blue-400">{workoutCount}</span>{' '}
        {workoutCount === 1 ? 'workout' : 'workouts'} · {summaryLabel}
      </p>

      {sets === null ? (
        <div aria-busy="true" className="mt-3 flex flex-col gap-2">
          <span className="sr-only">Loading</span>
          <Skeleton tone="surface-2" className="h-11 rounded-field" />
          <Skeleton tone="surface-2" className="h-11 rounded-field" />
        </div>
      ) : volume.length === 0 ? (
        <p className="mt-3 text-sm text-chalk-dim">No sets logged in this period.</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full rounded-md border border-line bg-surface-2 py-2 font-mono text-[11px] tracking-wide text-chalk-dim uppercase active:border-blue-500 active:text-blue-400"
          >
            {expanded ? 'Hide breakdown' : 'Show breakdown'}
          </button>

          {expanded && (
            <>
              <div className="mt-3">
                <MuscleBodyMap muscles={bodyMapMuscles} />
              </div>

              <ul className="mt-4 flex flex-col gap-1.5">
                {volumeByCount.map((v) => {
                  const total = v.primarySets + v.secondarySets
                  return (
                    <li key={v.name} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-chalk">{v.label}</span>
                      <span className="font-mono text-sm text-chalk-dim">
                        {total} {total === 1 ? 'set' : 'sets'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </Card>
  )
}

export default MuscleVolume
