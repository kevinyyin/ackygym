import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import WorkoutForm from './WorkoutForm'
import Card from './Card'
import ActiveRoutine from './ActiveRoutine'
import WaterTracker from './WaterTracker'
import { groupByUser } from './groupByUser'
import { WEEKDAY_NAME } from './weekdays'
import { getTodayDateString } from './dateUtils'
import { logSet } from './logSet'
import { toDisplayWeight } from './weightUnits'
import { NoteIcon, TrophyIcon, RepeatIcon } from './icons'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import ConfirmModal from './ConfirmModal'
import UndoToast from './UndoToast'
import { useDeferredDelete } from './useDeferredDelete'
import Skeleton from './Skeleton'
import { useCachedState } from './pageCache'

const TODAYS_SETS_COLLAPSED_COUNT = 8
const SHOW_LOG_SET_KEY = 'gym-tracker:home-show-log-set'
const SHOW_TODAYS_SETS_KEY = 'gym-tracker:home-show-todays-sets'

// Show/Hide on Home's sections used to reset to their default on every
// mount, which meant the first section a returning user actually wanted
// open (usually Today's sets, right after logging) had to be re-opened
// every visit. Persisting the choice per section makes that a one-time cost.
function loadShown(key, fallback) {
  const stored = localStorage.getItem(key)
  return stored === null ? fallback : stored === 'true'
}

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

function Home({
  session,
  profiles,
  schedule,
  onError,
  showWaterTracker,
  waterSettings,
  weightUnit,
  activeRoutine,
  onActiveRoutineChange,
  onSetLogged,
}) {
  const [exercises, setExercises] = useCachedState('home:exercises', [])
  // Date-scoped so a remount after midnight doesn't paint yesterday's sets
  // as today's. Fixed per mount: a changing key would carry this mount's
  // state over into the new key's cache slot.
  const [today] = useState(getTodayDateString)
  const [todaysSets, setTodaysSets] = useCachedState(`home:todaysSets:${today}`, [])
  const [todaysSetsLoaded, setTodaysSetsLoaded] = useCachedState(`home:todaysSetsLoaded:${today}`, false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  // Default to expanded (not collapsed like other optional cards) — these are
  // the two things people actually open the app to do, and a first-time user
  // with no stored preference yet shouldn't have to find a "Show" tap before
  // they can log anything.
  const [showLogSet, setShowLogSetState] = useState(() => loadShown(SHOW_LOG_SET_KEY, true))
  const [showTodaysSets, setShowTodaysSetsState] = useState(() => loadShown(SHOW_TODAYS_SETS_KEY, true))

  function setShowLogSet(next) {
    setShowLogSetState(next)
    localStorage.setItem(SHOW_LOG_SET_KEY, String(next))
  }

  function setShowTodaysSets(next) {
    setShowTodaysSetsState(next)
    localStorage.setItem(SHOW_TODAYS_SETS_KEY, String(next))
  }
  const [routines, setRoutines] = useCachedState('home:routines', [])
  const [expandedTodaysUserIds, setExpandedTodaysUserIds] = useState(() => new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedSetIds, setSelectedSetIds] = useState(() => new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const { isPending, message, stageDelete, undo } = useDeferredDelete('home-sets')

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
  }, [onError, setExercises])

  useEffect(() => {
    async function fetchRoutines() {
      const { data, error } = await supabase
        .from('routines')
        .select(
          'id, user_id, name, routine_exercises(id, position, exercise_id, exercises(name, exercise_muscles(muscle, role, muscle_groups(label))))'
        )
        .order('name')
      if (error) {
        onError(error.message)
        return
      }
      // Sorted client-side — `.order(col, { foreignTable })` is a no-op on
      // this project's PostgREST version, see lastSet.js for details.
      setRoutines(
        data.map((routine) => ({
          ...routine,
          routine_exercises: [...routine.routine_exercises].sort((a, b) => a.position - b.position),
        }))
      )
    }

    fetchRoutines()
  }, [onError, setRoutines])

  useEffect(() => {
    async function fetchTodaysSets() {
      const { data, error } = await supabase
        .from('sets')
        .select(
          'id, weight, reps, note, is_pr, user_id, exercise_id, exercises (name), workouts!inner (date)'
        )
        .eq('workouts.date', getTodayDateString())
        .order('id')

      if (error) {
        onError(error.message)
        return
      }
      setTodaysSets(data)
      setTodaysSetsLoaded(true)
    }

    fetchTodaysSets()
  }, [refreshKey, onError, setTodaysSets, setTodaysSetsLoaded])

  const visibleTodaysSets = todaysSets.filter((s) => !isPending(s.id))
  const groupedSets = groupByUser(visibleTodaysSets, profiles, session.user.id, 'sets')
  const ownSetIds = visibleTodaysSets.filter((s) => s.user_id === session.user.id).map((s) => s.id)

  const todayDayOfWeek = new Date().getDay()
  const todaysScheduleEntry = schedule.find(
    (s) => s.user_id === session.user.id && s.day_of_week === todayDayOfWeek
  )
  const suggestedRoutine = todaysScheduleEntry?.routine_id
    ? routines.find((r) => r.id === todaysScheduleEntry.routine_id)
    : null

  async function handleRepeatSet(set) {
    onError('')
    const { error } = await logSet({
      userId: session.user.id,
      exerciseId: set.exercise_id,
      weight: set.weight,
      reps: set.reps,
    })
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((key) => key + 1)
    setShowTodaysSets(true)
    onSetLogged()
  }

  function handleDeleteSet(set, exerciseName) {
    stageDelete({
      ids: [set.id],
      message: `${exerciseName} set deleted`,
      commit: async (isForeground) => {
        if (isForeground) onError('')
        const { error } = await supabase.from('sets').delete().eq('id', set.id)
        if (error) {
          if (isForeground) onError(error.message)
          return
        }
        setRefreshKey((key) => key + 1)
      },
    })
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v)
    setSelectedSetIds(new Set())
  }

  function toggleShowTodaysSets() {
    setShowTodaysSets(!showTodaysSets)
    setSelectMode(false)
    setSelectedSetIds(new Set())
  }

  function toggleSetSelected(setId) {
    setSelectedSetIds((current) => {
      const next = new Set(current)
      if (next.has(setId)) next.delete(setId)
      else next.add(setId)
      return next
    })
  }

  function toggleSelectAll(ownSetIds) {
    setSelectedSetIds((current) =>
      current.size === ownSetIds.length ? new Set() : new Set(ownSetIds)
    )
  }

  async function handleBulkDelete() {
    onError('')
    const { error } = await supabase
      .from('sets')
      .delete()
      .in('id', [...selectedSetIds])
      .eq('user_id', session.user.id)
    setConfirmBulkDelete(false)
    if (error) {
      onError(error.message)
      return
    }
    setSelectMode(false)
    setSelectedSetIds(new Set())
    setRefreshKey((key) => key + 1)
  }

  function toggleTodaysExpanded(userId) {
    setExpandedTodaysUserIds((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function openNoteEditor(set) {
    setEditingNoteId(set.id)
    setNoteDraft(set.note ?? '')
  }

  async function handleSaveNote(setId, note) {
    onError('')
    const trimmed = note.trim()
    const { error } = await supabase.from('sets').update({ note: trimmed || null }).eq('id', setId)
    if (error) {
      onError(error.message)
      return
    }
    setEditingNoteId(null)
    setRefreshKey((key) => key + 1)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col justify-between p-4">
          <p className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
            {WEEKDAY_NAME[todayDayOfWeek]}
          </p>
          <p className="mt-3 font-display text-2xl leading-[0.95] tracking-tight text-chalk uppercase">
            {suggestedRoutine?.name || 'Rest day'}
          </p>
        </Card>
        <Card className="flex flex-col justify-between p-4">
          <p className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
            Sets today
          </p>
          <p className="mt-3 font-mono text-4xl font-bold text-blue-400">{visibleTodaysSets.length}</p>
        </Card>
      </div>

      {suggestedRoutine && !activeRoutine && (
        <Card className="flex items-center justify-between gap-2 p-4">
          <p className="min-w-0 flex-1 truncate text-sm text-chalk">
            <span className="text-chalk-dim">Scheduled: </span>
            {suggestedRoutine.name}
          </p>
          <button
            type="button"
            onClick={() => onActiveRoutineChange(suggestedRoutine)}
            className="shrink-0 rounded-md bg-blue-500 px-3 py-1.5 font-body text-sm font-bold text-onblue active:bg-blue-600"
          >
            Start
          </button>
        </Card>
      )}

      {/* Surfaced here, above the fold and outside any collapsed section,
          because Routines/Schedule is what drives the card above — a
          brand-new user has no other way to discover it exists otherwise. */}
      <Link
        to="/train"
        className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface p-4 shadow-[inset_0_1px_0_var(--card-highlight)] active:border-blue-500"
      >
        <span className="text-sm font-medium text-chalk">
          {routines.length === 0 ? 'No routines yet — set one up' : 'Manage routines & exercises'}
        </span>
        <span className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
          Open →
        </span>
      </Link>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-headline text-chalk">Log a set</h2>
          <button
            type="button"
            onClick={() => setShowLogSet(!showLogSet)}
            className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
          >
            {showLogSet ? 'Hide' : 'Show'}
          </button>
        </div>
        {showLogSet && (
          <div className="mt-3">
            <WorkoutForm
              exercises={exercises}
              routines={routines}
              userId={session.user.id}
              weightUnit={weightUnit}
              onLogged={() => {
                setRefreshKey((key) => key + 1)
                setShowTodaysSets(true)
                onSetLogged()
              }}
              onError={onError}
            />
          </div>
        )}
      </Card>

      {activeRoutine && (
        <ActiveRoutine
          routine={activeRoutine}
          userId={session.user.id}
          weightUnit={weightUnit}
          onExit={() => onActiveRoutineChange(null)}
          onLogged={() => {
            setRefreshKey((key) => key + 1)
            setShowTodaysSets(true)
            onSetLogged()
          }}
          onError={onError}
        />
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-headline text-chalk">Today&apos;s sets</h2>
          <button
            type="button"
            onClick={toggleShowTodaysSets}
            className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
          >
            {showTodaysSets ? 'Hide' : 'Show'}
          </button>
        </div>
        {showTodaysSets && ownSetIds.length > 0 && (
          <div className="flex justify-end gap-3">
            {selectMode && (
              <button
                type="button"
                onClick={() => toggleSelectAll(ownSetIds)}
                className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
              >
                {selectedSetIds.size === ownSetIds.length ? 'Select none' : 'Select all'}
              </button>
            )}
            <button
              type="button"
              onClick={toggleSelectMode}
              className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          </div>
        )}
        {!showTodaysSets ? null : !todaysSetsLoaded ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <span className="sr-only">Loading</span>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : groupedSets.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">No sets logged yet today.</p>
          </Card>
        ) : (
          groupedSets.map((group) => {
            const exerciseGroups = groupSetsByExercise(group.sets)
            const todaysExpanded = expandedTodaysUserIds.has(group.userId)
            const visibleExerciseGroups = todaysExpanded
              ? exerciseGroups
              : exerciseGroups.slice(0, TODAYS_SETS_COLLAPSED_COUNT)

            return (
              <Card key={group.userId} className="overflow-hidden">
                <h3 className="border-b border-line px-4 py-2 font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
                  {group.name}
                </h3>
                <div className="divide-y divide-line">
                  {visibleExerciseGroups.map((exerciseGroup) => (
                    <div key={exerciseGroup.exerciseId} className="px-4 py-3">
                      <p className="font-medium text-chalk">{exerciseGroup.name}</p>
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {exerciseGroup.sets.map((set, i) => {
                          const showWeight =
                            i === 0 || set.weight !== exerciseGroup.sets[i - 1].weight

                          return (
                            <li key={set.id} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 font-mono text-sm text-chalk-dim">
                                  {showWeight && (
                                    <>
                                      {toDisplayWeight(set.weight, weightUnit)}
                                      {weightUnit}
                                      <span className="text-chalk-dim/60">×</span>
                                    </>
                                  )}
                                  {set.reps}
                                  {set.is_pr && (
                                    <TrophyIcon
                                      className="h-3.5 w-3.5 shrink-0 text-amber"
                                      aria-label="New PR"
                                    />
                                  )}
                                </span>
                                <span className="flex items-center gap-3">
                                  {set.user_id === session.user.id &&
                                    (selectMode ? (
                                      <input
                                        type="checkbox"
                                        checked={selectedSetIds.has(set.id)}
                                        onChange={() => toggleSetSelected(set.id)}
                                        aria-label={`Select ${exerciseGroup.name} set`}
                                        className="h-4 w-4 accent-blue-500"
                                      />
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => openNoteEditor(set)}
                                          aria-label={`Note for ${exerciseGroup.name} set`}
                                          className="shrink-0 text-chalk-dim hover:text-blue-400"
                                        >
                                          <NoteIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleRepeatSet(set)}
                                          aria-label={`Repeat ${exerciseGroup.name} set`}
                                          className="shrink-0 text-chalk-dim hover:text-blue-400"
                                        >
                                          <RepeatIcon className="h-4 w-4" />
                                        </button>
                                        <ConfirmDeleteButton
                                          onConfirm={() => handleDeleteSet(set, exerciseGroup.name)}
                                          label={`${exerciseGroup.name} set`}
                                          className="shrink-0"
                                        />
                                      </>
                                    ))}
                                </span>
                              </div>

                              {editingNoteId === set.id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={noteDraft}
                                  onChange={(e) => setNoteDraft(e.target.value)}
                                  onBlur={() => handleSaveNote(set.id, noteDraft)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur()
                                    if (e.key === 'Escape') setEditingNoteId(null)
                                  }}
                                  placeholder="Add a note…"
                                  className="w-full rounded-md border border-line bg-surface-2 px-2 py-1 font-body text-xs text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
                                />
                              ) : (
                                set.note && (
                                  <p className="truncate text-xs text-chalk-dim italic">{set.note}</p>
                                )
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
                {exerciseGroups.length > TODAYS_SETS_COLLAPSED_COUNT && (
                  <button
                    type="button"
                    onClick={() => toggleTodaysExpanded(group.userId)}
                    className="w-full border-t border-line bg-surface-2 py-2 font-mono text-[11px] tracking-wide text-chalk-dim uppercase active:border-blue-500 active:text-blue-400"
                  >
                    {todaysExpanded ? 'Show less' : `Show all (${exerciseGroups.length})`}
                  </button>
                )}
              </Card>
            )
          })
        )}
        {selectMode && selectedSetIds.size > 0 && (
          <button
            type="button"
            onClick={() => setConfirmBulkDelete(true)}
            className="w-full rounded-md border border-danger px-4 py-2 font-body text-sm font-bold text-danger active:bg-danger/10"
          >
            Delete {selectedSetIds.size} selected
          </button>
        )}
      </div>


      {showWaterTracker && (
        <WaterTracker
          session={session}
          profiles={profiles}
          onError={onError}
          waterMode={waterSettings.mode}
          bottleSizeMl={waterSettings.bottleSizeMl}
          goalMl={waterSettings.goalMl}
        />
      )}

      <ConfirmModal
        open={confirmBulkDelete}
        title="Delete selected sets?"
        message={`${selectedSetIds.size} set${selectedSetIds.size === 1 ? '' : 's'} will be permanently deleted.`}
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      <UndoToast message={message} onUndo={undo} />
    </div>
  )
}

export default Home
