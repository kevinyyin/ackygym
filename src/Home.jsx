import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import WorkoutForm from './WorkoutForm'
import Card from './Card'
import ActiveRoutine from './ActiveRoutine'
import WaterTracker from './WaterTracker'
import CreatineTracker from './CreatineTracker'
import { groupByUser, groupSetsByExercise } from './groupByUser'
import { WEEKDAY_NAME } from './weekdays'
import { getTodayDateString } from './dateUtils'
import { logSet, setsSettled } from './logSet'
import { toDisplayWeight } from './weightUnits'
import { NoteIcon, TrophyIcon, RepeatIcon, CloseIcon, PlusIcon } from './icons'
import ConfirmModal from './ConfirmModal'
import UndoToast from './UndoToast'
import { useDeferredDelete } from './useDeferredDelete'
import Skeleton from './Skeleton'
import { useCachedState } from './pageCache'
import { useSelection, toggled } from './useSelection'
import SelectControls from './SelectControls'
import { usePersistedState } from './usePersistedState'
import { fetchExercises, fetchRoutines } from './library'

const TODAYS_SETS_COLLAPSED_COUNT = 8
// String ids are optimistic rows still saving (see handleLogSet).
const isSaving = (set) => typeof set.id === 'string'
// 16px icons get a 28px touch target; the 12px row gap keeps neighbours from overlapping.
const ICON_HIT = "relative shrink-0 after:absolute after:-inset-1.5 after:content-['']"

function Home({
  session,
  profiles,
  schedule,
  onError,
  showWaterTracker,
  showCreatineTracker,
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
  // Persisted so a returning user's open sections stay open, and expanded by
  // default (unlike other optional cards) — these are the two things people
  // open the app to do, so a first-timer shouldn't need a "Show" tap first.
  const [showLogSet, setShowLogSet] = usePersistedState('gym-tracker:home-show-log-set', true)
  const [showTodaysSets, setShowTodaysSets] = usePersistedState('gym-tracker:home-show-todays-sets', true)
  // Mid-routine, the general form stays folded until asked for.
  const [showOtherLog, setShowOtherLog] = useState(false)
  const [routines, setRoutines] = useCachedState('home:routines', [])
  const [routinesLoaded, setRoutinesLoaded] = useCachedState('home:routinesLoaded', false)
  const [expandedTodaysUserIds, setExpandedTodaysUserIds] = useState(() => new Set())
  const selection = useSelection()
  const { selectMode, selectedIds: selectedSetIds } = selection
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const { isPending, message, stageDelete, undo } = useDeferredDelete('home-sets')
  // Temp ids this mount is still saving. A temp row restored from the page
  // cache belongs to an earlier mount that can no longer swap in its real id,
  // so a refetch drops it (the saved set comes back in the data instead).
  const savingIdsRef = useRef(new Set())

  useEffect(() => {
    async function loadExercises() {
      const { data, error } = await fetchExercises()
      if (error) {
        onError(error.message)
        return
      }
      setExercises(data)
    }

    loadExercises()
  }, [onError, setExercises])

  useEffect(() => {
    async function loadRoutines() {
      const { data, error } = await fetchRoutines()
      if (error) {
        onError(error.message)
        return
      }
      setRoutines(data)
      setRoutinesLoaded(true)
    }

    loadRoutines()
  }, [onError, setRoutines, setRoutinesLoaded])

  useEffect(() => {
    async function fetchTodaysSets() {
      // So sets saved by an earlier mount are in the response, not lost between it and the cache.
      await setsSettled()
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
      // Keep rows still saving: a refetch that lands mid-save mustn't drop them.
      setTodaysSets((current) => [...data, ...current.filter((s) => savingIdsRef.current.has(s.id))])
      setTodaysSetsLoaded(true)
    }

    fetchTodaysSets()
  }, [refreshKey, onError, setTodaysSets, setTodaysSetsLoaded])

  const visibleTodaysSets = todaysSets.filter((s) => !isPending(s.id))
  const groupedSets = groupByUser(visibleTodaysSets, profiles, session.user.id, 'sets')
  const ownTodaysSets = visibleTodaysSets.filter((s) => s.user_id === session.user.id)
  const ownSetIds = visibleTodaysSets
    .filter((s) => s.user_id === session.user.id && !isSaving(s))
    .map((s) => s.id)

  const todayDayOfWeek = new Date().getDay()
  const todaysScheduleEntry = schedule.find(
    (s) => s.user_id === session.user.id && s.day_of_week === todayDayOfWeek
  )
  const suggestedRoutine = todaysScheduleEntry?.routine_id
    ? routines.find((r) => r.id === todaysScheduleEntry.routine_id)
    : null
  // "Rest day" only means something once a week has been planned.
  const hasSchedule = schedule.some((s) => s.user_id === session.user.id && s.routine_id)

  // Every log path (form, active routine, repeat) shows the set at once as a
  // dimmed row and starts the rest timer: logSet is two or three round trips,
  // and waiting on them left the tap with no visible response. The saved row
  // gets its real id and PR flag, so no refetch is needed afterwards.
  async function handleLogSet({ exerciseId, exerciseName, weight, reps }) {
    onError('')
    const tempId = `saving-${crypto.randomUUID()}`
    savingIdsRef.current.add(tempId)
    setTodaysSets((current) => [
      ...current,
      {
        id: tempId,
        weight,
        reps,
        note: null,
        is_pr: false,
        user_id: session.user.id,
        exercise_id: exerciseId,
        exercises: { name: exerciseName },
        workouts: { date: today },
      },
    ])
    setShowTodaysSets(true)
    onSetLogged()

    const result = await logSet({ userId: session.user.id, exerciseId, weight, reps })
    savingIdsRef.current.delete(tempId)
    setTodaysSets((current) =>
      result.error
        ? current.filter((s) => s.id !== tempId)
        : current.map((s) => (s.id === tempId ? { ...s, id: result.id, is_pr: result.isPr } : s))
    )
    if (result.error) onError(result.error.message)
    return result
  }

  function handleRepeatSet(set) {
    handleLogSet({
      exerciseId: set.exercise_id,
      exerciseName: set.exercises.name,
      weight: set.weight,
      reps: set.reps,
    })
  }

  // Single and bulk deletes share one path (and one Undo); a single delete is one id.
  function stageSetDelete(ids, message) {
    stageDelete({
      ids,
      message,
      commit: async (isForeground) => {
        if (isForeground) onError('')
        const { error } = await supabase.from('sets').delete().in('id', ids).eq('user_id', session.user.id)
        if (error) {
          if (isForeground) onError(error.message)
          return
        }
        // Dropped locally before the refetch so the rows can't reappear in
        // the gap between the delete landing and fresh data arriving.
        setTodaysSets((current) => current.filter((s) => !ids.includes(s.id)))
        setRefreshKey((key) => key + 1)
      },
    })
  }

  function handleDeleteSet(set, exerciseName) {
    stageSetDelete([set.id], `${exerciseName} set deleted`)
  }

  function toggleShowTodaysSets() {
    setShowTodaysSets(!showTodaysSets)
    selection.exit()
  }

  function handleBulkDelete() {
    const ids = [...selectedSetIds]
    setConfirmBulkDelete(false)
    selection.exit()
    stageSetDelete(ids, `${ids.length} set${ids.length === 1 ? '' : 's'} deleted`)
  }

  function toggleTodaysExpanded(userId) {
    setExpandedTodaysUserIds((current) => toggled(current, userId))
  }

  function openNoteEditor(set) {
    setEditingNoteId(set.id)
    setNoteDraft(set.note ?? '')
  }

  // Closes and shows the note at once; a failed save puts the old note back.
  async function handleSaveNote(setId, note) {
    onError('')
    const nextNote = note.trim() || null
    const previousNote = todaysSets.find((s) => s.id === setId)?.note ?? null
    const setNote = (value) =>
      setTodaysSets((current) => current.map((s) => (s.id === setId ? { ...s, note: value } : s)))
    setEditingNoteId(null)
    if (nextNote === previousNote) return
    setNote(nextNote)
    const { error } = await supabase.from('sets').update({ note: nextNote }).eq('id', setId)
    if (error) {
      setNote(previousNote)
      onError(error.message)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Mid-routine the routine card is the page; the day summary steps aside. */}
      {!activeRoutine && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col justify-between p-4">
            <p className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
              {WEEKDAY_NAME[todayDayOfWeek]}
            </p>
            <div className="mt-3 flex flex-col items-start gap-3">
              <p className="font-display text-2xl leading-[0.95] tracking-tight text-chalk uppercase">
                {suggestedRoutine?.name || (hasSchedule ? 'Rest day' : 'Nothing scheduled')}
              </p>
              {suggestedRoutine && !activeRoutine && (
                <button
                  type="button"
                  onClick={() => onActiveRoutineChange(suggestedRoutine)}
                  className="rounded-md bg-blue-500 px-3 py-1.5 font-body text-sm font-bold text-onblue active:bg-blue-600"
                >
                  Start
                </button>
              )}
            </div>
          </Card>
          <Card className="flex flex-col justify-between p-4">
            <p className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
              Your sets today
            </p>
            <p className="mt-3 font-mono text-4xl font-bold text-blue-400">
              {ownTodaysSets.length}
            </p>
          </Card>
        </div>
      )}

      {activeRoutine && (
        <ActiveRoutine
          routine={activeRoutine}
          userId={session.user.id}
          weightUnit={weightUnit}
          todaysOwnSets={ownTodaysSets}
          onExit={() => onActiveRoutineChange(null)}
          onLogSet={handleLogSet}
        />
      )}

      {/* Only until the first routine exists: the tab bar covers navigation,
          but nothing else tells a new user the card above comes from Train. */}
      {routinesLoaded && routines.length === 0 && (
        <Link
          to="/train"
          className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface p-4 shadow-[inset_0_1px_0_var(--card-highlight)] active:border-blue-500"
        >
          <span className="text-sm font-medium text-chalk">No routines yet — set one up</span>
          <span className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
            Open →
          </span>
        </Link>
      )}

      {activeRoutine && !showOtherLog ? (
        // The routine is the task; a set outside it is one tap away, not a second form competing with it.
        <button
          type="button"
          onClick={() => setShowOtherLog(true)}
          className="flex h-[52px] items-center gap-2.5 rounded-field bg-surface px-4 text-[15px] font-medium text-chalk active:bg-surface-2"
        >
          <PlusIcon className="h-[18px] w-[18px] text-blue-400" aria-hidden="true" />
          Log something else
        </button>
      ) : (
        <Card className="p-4">
          <div className="-my-1.5 flex items-center justify-between gap-2">
            <h2 className="text-headline text-chalk">{activeRoutine ? 'Log something else' : 'Log a set'}</h2>
            <button
              type="button"
              onClick={() => (activeRoutine ? setShowOtherLog(false) : setShowLogSet(!showLogSet))}
              aria-expanded={Boolean(activeRoutine || showLogSet)}
              className="-mr-2 h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-blue-400 active:text-blue-300"
            >
              {activeRoutine || showLogSet ? 'Hide' : 'Show'}
            </button>
          </div>
          {(activeRoutine || showLogSet) && (
            <div className="mt-3">
              <WorkoutForm
              exercises={exercises}
              routines={routines}
              userId={session.user.id}
              weightUnit={weightUnit}
              lastExerciseId={ownTodaysSets.at(-1)?.exercise_id}
              onLogSet={handleLogSet}
              onError={onError}
            />
            </div>
          )}
        </Card>
      )}

      {/* Side by side, above the sets list: the daily checks are quick taps, and
          creatine is what the hourly reminder sends you here to do. */}
      {(showWaterTracker || showCreatineTracker) && (
        <div className={`grid gap-3 ${showWaterTracker && showCreatineTracker ? 'grid-cols-2' : ''}`}>
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
          {showCreatineTracker && (
            <CreatineTracker session={session} profiles={profiles} onError={onError} />
          )}
        </div>
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
            <SelectControls selection={selection} ids={ownSetIds} />
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
                            <li
                              key={set.id}
                              aria-busy={isSaving(set)}
                              className={`flex flex-col gap-1 transition-opacity ${isSaving(set) ? 'opacity-50' : ''}`}
                            >
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
                                    !isSaving(set) &&
                                    (selectMode ? (
                                      <input
                                        type="checkbox"
                                        checked={selectedSetIds.has(set.id)}
                                        onChange={() => selection.toggle(set.id)}
                                        aria-label={`Select ${exerciseGroup.name} set`}
                                        className="h-4 w-4 accent-blue-500"
                                      />
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => openNoteEditor(set)}
                                          aria-label={`Note for ${exerciseGroup.name} set`}
                                          className={`${ICON_HIT} text-chalk-dim hover:text-blue-400`}
                                        >
                                          <NoteIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleRepeatSet(set)}
                                          aria-label={`Repeat ${exerciseGroup.name} set`}
                                          className={`${ICON_HIT} text-chalk-dim hover:text-blue-400`}
                                        >
                                          <RepeatIcon className="h-4 w-4" />
                                        </button>
                                        {/* One tap: the Undo toast is the confirmation and the safety net. */}
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSet(set, exerciseGroup.name)}
                                          aria-label={`Delete ${exerciseGroup.name} set`}
                                          className={`${ICON_HIT} text-chalk-dim hover:text-danger`}
                                        >
                                          <CloseIcon className="h-4 w-4" />
                                        </button>
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
                                  className="w-full rounded-md border border-line bg-surface-2 px-2 py-1 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
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


      <ConfirmModal
        open={confirmBulkDelete}
        title="Delete selected sets?"
        message={`${selectedSetIds.size} set${selectedSetIds.size === 1 ? '' : 's'} will be deleted.`}
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      <UndoToast message={message} onUndo={undo} />
    </div>
  )
}

export default Home
