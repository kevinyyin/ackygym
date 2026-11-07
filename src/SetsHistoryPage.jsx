import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Card from './Card'
import ExercisePicker from './ExercisePicker'
import WorkoutDayModal from './WorkoutDayModal'
import { getDateDaysAgoString, getTodayDateString, formatDate } from './dateUtils'
import { toDisplayWeight } from './weightUnits'
import { TrophyIcon, ChevronRightIcon } from './icons'
import Skeleton from './Skeleton'
import { groupSetsByDate } from './groupByUser'
import { byDateThenId } from './logSet'

// Cross-day, cross-exercise browsing of the current user's own logged sets —
// unlike Calendar (one day at a time) or Lifts (one exercise at a time),
// this lets a search span both dimensions at once, always bounded by a date
// range so it never scans the whole `sets` table.
function SetsHistoryPage({ userId, weightUnit, onError }) {
  const [exercises, setExercises] = useState([])
  const [exerciseFilter, setExerciseFilter] = useState('')
  const [startDate, setStartDate] = useState(() => getDateDaysAgoString(30))
  const [endDate, setEndDate] = useState(() => getTodayDateString())
  const [results, setResults] = useState(null)
  const [viewingDate, setViewingDate] = useState(null)
  const [resultsVersion, setResultsVersion] = useState(0)

  useEffect(() => {
    async function fetchExercises() {
      const { data, error } = await supabase.from('exercises').select('id, name').order('name')
      if (error) {
        onError(error.message)
        return
      }
      setExercises(data)
    }

    fetchExercises()
  }, [onError])

  useEffect(() => {
    let cancelled = false

    async function fetchResults() {
      setResults(null)

      let query = supabase
        .from('sets')
        .select('id, weight, reps, exercise_id, is_pr, exercises(name), workouts!inner(date)')
        .eq('user_id', userId)
        .gte('workouts.date', startDate)
        .lte('workouts.date', endDate)

      if (exerciseFilter) query = query.eq('exercise_id', Number(exerciseFilter))

      const { data, error } = await query
      if (cancelled) return

      if (error) {
        onError(error.message)
        return
      }

      // Sorted client-side, newest first — `.order(col, { foreignTable })`
      // is a no-op on this project's PostgREST version, see lastSet.js.
      setResults([...data].sort((a, b) => byDateThenId(b, a)))
    }

    fetchResults()
    return () => {
      cancelled = true
    }
  }, [userId, exerciseFilter, startDate, endDate, resultsVersion, onError])

  const dateGroups = results ? groupSetsByDate(results) : null

  const inputClasses =
    'h-11 w-full min-w-0 rounded-field bg-surface-2 px-4 text-base text-chalk placeholder:text-chalk-dim focus:ring-2 focus:ring-blue-500 focus:outline-none'

  return (
    <>
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <ExercisePicker
                exercises={exercises}
                value={exerciseFilter}
                onChange={setExerciseFilter}
                placeholder="All exercises"
                inputClassName={inputClasses}
              />
            </div>
            {exerciseFilter && (
              <button
                type="button"
                onClick={() => setExerciseFilter('')}
                className="h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-blue-400 active:text-blue-300"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="From date"
              className={inputClasses}
            />
            <span className="shrink-0 text-caption text-chalk-dim">to</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={getTodayDateString()}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="To date"
              className={inputClasses}
            />
          </div>
        </Card>

        {dateGroups === null ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <span className="sr-only">Loading</span>
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : dateGroups.length === 0 ? (
          <Card className="p-4">
            <p className="text-[15px] text-chalk-dim">No sets logged in this range.</p>
          </Card>
        ) : (
          dateGroups.map((group) => (
            <Card key={group.date} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setViewingDate(group.date)}
                aria-haspopup="dialog"
                className="flex min-h-12 w-full items-center justify-between gap-2 border-b border-line px-4 text-left active:bg-surface-2"
              >
                <span className="text-[17px] font-semibold text-chalk">{formatDate(group.date, { year: true })}</span>
                <span className="flex shrink-0 items-center gap-0.5 text-[15px] text-blue-400">
                  View day
                  <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
              <ul className="divide-y divide-line">
                {group.sets.map((set) => (
                  <li key={set.id} className="flex min-h-12 items-center justify-between gap-2 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-[15px] text-chalk">{set.exercises.name}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[15px] tabular-nums text-chalk-dim">
                      {toDisplayWeight(set.weight, weightUnit)} {weightUnit} × {set.reps}
                      {set.is_pr && (
                        <TrophyIcon className="h-3.5 w-3.5 shrink-0 text-amber" aria-label="New PR" />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>

      <WorkoutDayModal
        date={viewingDate}
        userId={userId}
        weightUnit={weightUnit}
        onClose={() => setViewingDate(null)}
        onError={onError}
        onRepeated={() => setResultsVersion((v) => v + 1)}
      />
    </>
  )
}

export default SetsHistoryPage
