import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { displayName } from './displayName'
import { sortProfilesSelfFirst } from './groupByUser'
import Card from './Card'
import MuscleTags from './MuscleTags'
import ExerciseDetailModal from './ExerciseDetailModal'
import { MedalIcon } from './icons'
import { formatDate } from './dateUtils'

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
  const [exercisesLoaded, setExercisesLoaded] = useState(false)
  const [bestSets, setBestSets] = useState(new Map())
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [expandedUpper, setExpandedUpper] = useState(false)
  const [expandedLower, setExpandedLower] = useState(false)
  const [search, setSearch] = useState('')
  const [setsVersion, setSetsVersion] = useState(0)

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
      setExercisesLoaded(true)
    }

    fetchExercises()
  }, [onError])

  useEffect(() => {
    async function fetchBestSets() {
      const { data, error } = await supabase
        .from('sets')
        .select('id, user_id, exercise_id, weight, reps, workouts!inner(date)')

      if (error) {
        onError(error.message)
        return
      }

      // Sorted client-side — `.order(col, { foreignTable })` is a no-op on
      // this project's PostgREST version, see lastSet.js for details.
      const best = new Map()
      for (const set of data) {
        const key = `${set.exercise_id}:${set.user_id}`
        const existing = best.get(key)
        const isHeavier =
          !existing ||
          set.weight > existing.weight ||
          (set.weight === existing.weight && set.reps > existing.reps) ||
          (set.weight === existing.weight &&
            set.reps === existing.reps &&
            set.workouts.date > existing.date)
        if (isHeavier) {
          best.set(key, {
            weight: set.weight,
            reps: set.reps,
            date: set.workouts.date,
            id: set.id,
          })
        }
      }
      setBestSets(best)
    }

    fetchBestSets()
  }, [setsVersion, onError])

  const rows = sortProfilesSelfFirst(profiles, userId)

  function leaderboardFor(exerciseId) {
    return rows
      .map((profile) => ({ profile, entry: bestSets.get(`${exerciseId}:${profile.id}`) }))
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
                  {isLeader && <MedalIcon className="h-3.5 w-3.5 shrink-0 text-amber" />}
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

  // While searching, every match is shown up front — expanding one more time
  // to see the rest would defeat the point of searching in the first place.
  function renderSection(label, sectionExercises, expanded, setExpanded, isSearching) {
    if (sectionExercises.length === 0) return null

    const hasOverflow = !isSearching && sectionExercises.length > COLLAPSED_COUNT
    const visible = expanded || isSearching ? sectionExercises : sectionExercises.slice(0, COLLAPSED_COUNT)

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

  // Stable sort: exercises with a logged set for the current user come
  // first, alphabetical order (from the query) is preserved within each group.
  function byLoggedFirst(a, b) {
    const aLogged = bestSets.has(`${a.id}:${userId}`)
    const bLogged = bestSets.has(`${b.id}:${userId}`)
    return aLogged === bLogged ? 0 : aLogged ? -1 : 1
  }

  const normalizedSearch = search.trim().toLowerCase()
  const isSearching = normalizedSearch !== ''
  const visibleExercises = isSearching
    ? exercises.filter((e) => e.name.toLowerCase().includes(normalizedSearch))
    : exercises

  const upperExercises = visibleExercises.filter((e) => bodyRegionFor(e) === 'Upper Body').sort(byLoggedFirst)
  const lowerExercises = visibleExercises.filter((e) => bodyRegionFor(e) === 'Lower Body').sort(byLoggedFirst)

  return (
    <>
      {!exercisesLoaded ? (
        <Card className="p-4">
          <p className="text-sm text-chalk-dim">Loading…</p>
        </Card>
      ) : exercises.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-chalk-dim">No exercises yet.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-xs text-chalk-dim">
            Your all-time best set per exercise, and how it compares to everyone else's.
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises"
            autoComplete="off"
            className="w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
          />
          {isSearching && visibleExercises.length === 0 ? (
            <Card className="p-4">
              <p className="text-sm text-chalk-dim">No exercises match “{search.trim()}”.</p>
            </Card>
          ) : (
            <>
              {renderSection('Upper Body', upperExercises, expandedUpper, setExpandedUpper, isSearching)}
              {renderSection('Lower Body', lowerExercises, expandedLower, setExpandedLower, isSearching)}
            </>
          )}
        </div>
      )}

      <ExerciseDetailModal
        exercise={selectedExercise}
        userId={userId}
        onClose={() => setSelectedExercise(null)}
        onError={onError}
        onChanged={() => setSetsVersion((v) => v + 1)}
      />
    </>
  )
}

export default LiftsPage

