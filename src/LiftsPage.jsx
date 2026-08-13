import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { displayName } from './displayName'
import Card from './Card'
import MuscleTags from './MuscleTags'
import ExerciseDetailModal from './ExerciseDetailModal'
import { MedalIcon } from './icons'

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

// Which muscle_groups.name values count as "lower body" for the purpose of
// this grouping — everything else (including core) is bucketed as upper body.
const LOWER_BODY_MUSCLES = new Set([
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
  'lower_back',
])

// An exercise's region is decided by its primary muscles (falling back to
// secondary ones if it has no primary muscles logged), since that's what
// "upper body exercise" vs "lower body exercise" means in normal gym usage —
// e.g. a deadlift is a lower-body exercise even though back/traps assist.
function bodyRegionFor(exercise) {
  const muscles = exercise.exercise_muscles || []

  for (const role of ['primary', 'secondary']) {
    let upper = 0
    let lower = 0
    for (const m of muscles) {
      if (m.role !== role) continue
      if (LOWER_BODY_MUSCLES.has(m.muscle)) lower += 1
      else upper += 1
    }
    if (upper > lower) return 'Upper Body'
    if (lower > upper) return 'Lower Body'
  }

  return 'Upper Body'
}

const COLLAPSED_COUNT = 8

function LiftsPage({ profiles, userId, onError }) {
  const [exercises, setExercises] = useState([])
  const [latestSets, setLatestSets] = useState(new Map())
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [expandedUpper, setExpandedUpper] = useState(false)
  const [expandedLower, setExpandedLower] = useState(false)

  useEffect(() => {
    async function fetchExercises() {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, exercise_muscles(muscle, role, muscle_groups(label))')
        .order('name')

      if (error) {
        onError(error.message)
        return
      }
      setExercises(data)
    }

    fetchExercises()
  }, [onError])

  useEffect(() => {
    async function fetchLatestSets() {
      const { data, error } = await supabase
        .from('sets')
        .select('id, user_id, exercise_id, weight, reps, workouts!inner(date)')

      if (error) {
        onError(error.message)
        return
      }

      // Sorted client-side — `.order(col, { foreignTable })` is a no-op on
      // this project's PostgREST version, see lastSet.js for details.
      const latest = new Map()
      for (const set of data) {
        const key = `${set.exercise_id}:${set.user_id}`
        const existing = latest.get(key)
        const isNewer =
          !existing ||
          set.workouts.date > existing.date ||
          (set.workouts.date === existing.date && set.id > existing.id)
        if (isNewer) {
          latest.set(key, {
            weight: set.weight,
            reps: set.reps,
            date: set.workouts.date,
            id: set.id,
          })
        }
      }
      setLatestSets(latest)
    }

    fetchLatestSets()
  }, [onError])

  const rows = [...profiles].sort((a, b) => {
    if (a.id === userId) return -1
    if (b.id === userId) return 1
    return displayName(a).localeCompare(displayName(b))
  })

  function leaderboardFor(exerciseId) {
    return rows
      .map((profile) => ({ profile, entry: latestSets.get(`${exerciseId}:${profile.id}`) }))
      .sort((a, b) => (b.entry?.weight ?? -Infinity) - (a.entry?.weight ?? -Infinity))
  }

  function renderExerciseCard(exercise) {
    return (
      <Card key={exercise.id} className="flex flex-col gap-3 p-4">
        <button
          type="button"
          onClick={() => setSelectedExercise(exercise)}
          className="flex w-full min-w-0 flex-col items-start gap-1.5 text-left"
        >
          <p className="w-full truncate font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
            {exercise.name}
          </p>
          <MuscleTags muscles={exercise.exercise_muscles} />
        </button>
        <div className="flex flex-col gap-3">
          {leaderboardFor(exercise.id).map(({ profile, entry }, i) => {
            const isLeader = i === 0 && entry
            return (
              <div key={profile.id} className="border-l-2 border-line pl-2">
                <p className="flex items-center gap-1 text-[11px] text-chalk-dim">
                  {isLeader && <MedalIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                  <span className="min-w-0 flex-1 truncate">{displayName(profile)}</span>
                </p>
                {entry ? (
                  <>
                    <p className="font-mono text-xl font-bold text-blue-400">
                      {entry.weight}
                      <span className="ml-1 text-sm font-normal text-chalk-dim">×{entry.reps}</span>
                    </p>
                    <p className="font-mono text-[11px] text-chalk-dim/70">{formatDate(entry.date)}</p>
                  </>
                ) : (
                  <p className="font-mono text-xl font-bold text-chalk-dim/40">—</p>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    )
  }

  function renderSection(label, sectionExercises, expanded, setExpanded) {
    if (sectionExercises.length === 0) return null

    const hasOverflow = sectionExercises.length > COLLAPSED_COUNT
    const visible = expanded ? sectionExercises : sectionExercises.slice(0, COLLAPSED_COUNT)

    return (
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 px-1 text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
          <span className="h-2.5 w-0.5 bg-blue-500" />
          {label}
        </h2>
        <div className="grid grid-cols-2 gap-3">{visible.map(renderExerciseCard)}</div>
        {hasOverflow && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full rounded-md border border-line bg-surface-2 py-2 font-mono text-[11px] tracking-wide text-chalk-dim uppercase active:border-blue-500 active:text-blue-400"
          >
            {expanded ? 'Show less' : `Show all (${sectionExercises.length})`}
          </button>
        )}
      </div>
    )
  }

  const upperExercises = exercises.filter((e) => bodyRegionFor(e) === 'Upper Body')
  const lowerExercises = exercises.filter((e) => bodyRegionFor(e) === 'Lower Body')

  return (
    <>
      {exercises.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-chalk-dim">No exercises yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {renderSection('Upper Body', upperExercises, expandedUpper, setExpandedUpper)}
          {renderSection('Lower Body', lowerExercises, expandedLower, setExpandedLower)}
        </div>
      )}

      <ExerciseDetailModal
        exercise={selectedExercise}
        userId={userId}
        onClose={() => setSelectedExercise(null)}
        onError={onError}
      />
    </>
  )
}

export default LiftsPage

