import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import WorkoutForm from './WorkoutForm'
import AddExerciseForm from './AddExerciseForm'
import Card, { SectionLabel } from './Card'
import MuscleTags from './MuscleTags'
import ExerciseDetailModal from './ExerciseDetailModal'
import ActiveRoutine from './ActiveRoutine'
import Routines from './Routines'
import WaterTracker from './WaterTracker'
import { groupByUser } from './groupByUser'
import { WEEKDAY_NAME } from './weekdays'
import { getTodayDateString } from './dateUtils'
import { logSet } from './logSet'
import { NoteIcon, TrophyIcon } from './icons'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import ConfirmModal from './ConfirmModal'

const TODAYS_SETS_COLLAPSED_COUNT = 8

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
  onScheduleSaved,
  onError,
  showWaterTracker,
  waterSettings,
  activeRoutine,
  onActiveRoutineChange,
}) {
  const [exercises, setExercises] = useState([])
  const [exercisesLoaded, setExercisesLoaded] = useState(false)
  const [todaysSets, setTodaysSets] = useState([])
  const [todaysSetsLoaded, setTodaysSetsLoaded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [exercisesVersion, setExercisesVersion] = useState(0)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [exerciseToDelete, setExerciseToDelete] = useState(null)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [showLogSet, setShowLogSet] = useState(false)
  const [showExercises, setShowExercises] = useState(false)
  const [showRoutines, setShowRoutines] = useState(false)
  const [routines, setRoutines] = useState([])
  const [routinesLoaded, setRoutinesLoaded] = useState(false)
  const [routinesVersion, setRoutinesVersion] = useState(0)
  const [expandedTodaysUserIds, setExpandedTodaysUserIds] = useState(() => new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedSetIds, setSelectedSetIds] = useState(() => new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

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
  }, [exercisesVersion, onError])

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
      setRoutinesLoaded(true)
    }

    fetchRoutines()
  }, [routinesVersion, onError])

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
  }, [refreshKey, onError])

  const groupedSets = groupByUser(todaysSets, profiles, session.user.id, 'sets')

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
  }

  async function handleDeleteSet(setId) {
    onError('')
    const { error } = await supabase.from('sets').delete().eq('id', setId)
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((key) => key + 1)
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v)
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

  async function handleBulkDelete() {
    onError('')
    const { error } = await supabase.from('sets').delete().in('id', [...selectedSetIds])
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

  async function handleDeleteExercise(exerciseId) {
    onError('')
    const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
    setExerciseToDelete(null)
    if (error) {
      onError(
        error.code === '23503'
          ? 'Can’t delete an exercise that still has logged sets or is used in a routine.'
          : error.message
      )
      return
    }
    setExercisesVersion((v) => v + 1)
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
          <p className="mt-3 font-mono text-4xl font-bold text-blue-400">{todaysSets.length}</p>
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

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Log a set</SectionLabel>
          <button
            type="button"
            onClick={() => setShowLogSet((v) => !v)}
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
              onLogged={() => setRefreshKey((key) => key + 1)}
              onError={onError}
            />
          </div>
        )}
      </Card>

      {activeRoutine && (
        <ActiveRoutine
          routine={activeRoutine}
          userId={session.user.id}
          onExit={() => onActiveRoutineChange(null)}
          onLogged={() => setRefreshKey((key) => key + 1)}
          onError={onError}
        />
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Today&apos;s sets</SectionLabel>
          {todaysSets.some((s) => s.user_id === session.user.id) && (
            <button
              type="button"
              onClick={toggleSelectMode}
              className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>
        {!todaysSetsLoaded ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">Loading…</p>
          </Card>
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
                                      {set.weight}
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
                                          ↻
                                        </button>
                                        <ConfirmDeleteButton
                                          onConfirm={() => handleDeleteSet(set.id)}
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

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Routines</SectionLabel>
          <button
            type="button"
            onClick={() => setShowRoutines((v) => !v)}
            className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
          >
            {showRoutines ? 'Hide' : 'Show'}
          </button>
        </div>
        {showRoutines && (
          <Routines
            routines={routines}
            loaded={routinesLoaded}
            exercises={exercises}
            schedule={schedule}
            userId={session.user.id}
            onRoutinesChanged={() => setRoutinesVersion((v) => v + 1)}
            onScheduleChanged={onScheduleSaved}
            onStart={onActiveRoutineChange}
            onError={onError}
          />
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Exercises</SectionLabel>
          <button
            type="button"
            onClick={() => setShowExercises((v) => !v)}
            className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
          >
            {showExercises ? 'Hide' : 'Show'}
          </button>
        </div>
        <AddExerciseForm
          exercises={exercises}
          showMuscleGroups={showExercises}
          onAdded={() => setExercisesVersion((v) => v + 1)}
          onError={onError}
        />
        {showExercises && !exercisesLoaded && (
          <p className="mt-3 text-sm text-chalk-dim">Loading…</p>
        )}
        {showExercises && exercisesLoaded && (
          <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
            {exercises.map((exercise) => (
              <li
                key={exercise.id}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-2 py-1.5 pl-3 pr-2"
              >
                <button
                  type="button"
                  onClick={() => setSelectedExercise(exercise)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
                >
                  <span className="w-full truncate text-sm text-chalk">{exercise.name}</span>
                  <MuscleTags muscles={exercise.exercise_muscles} />
                </button>
                <button
                  type="button"
                  onClick={() => setExerciseToDelete(exercise)}
                  aria-label={`Delete ${exercise.name}`}
                  className="shrink-0 rounded px-1 py-0.5 text-chalk-dim hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showWaterTracker && (
        <WaterTracker
          session={session}
          profiles={profiles}
          onError={onError}
          waterMode={waterSettings.mode}
          bottleSizeMl={waterSettings.bottleSizeMl}
        />
      )}

      <ExerciseDetailModal
        exercise={selectedExercise}
        userId={session.user.id}
        onClose={() => setSelectedExercise(null)}
        onError={onError}
        onChanged={() => setRefreshKey((key) => key + 1)}
      />

      <ConfirmModal
        open={exerciseToDelete !== null}
        title="Delete exercise?"
        message={`"${exerciseToDelete?.name}" will be removed from your exercise library. This can't be undone.`}
        onConfirm={() => handleDeleteExercise(exerciseToDelete.id)}
        onCancel={() => setExerciseToDelete(null)}
      />

      <ConfirmModal
        open={confirmBulkDelete}
        title="Delete selected sets?"
        message={`${selectedSetIds.size} set${selectedSetIds.size === 1 ? '' : 's'} will be permanently deleted.`}
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </div>
  )
}

export default Home
