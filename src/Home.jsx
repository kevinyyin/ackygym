import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import WorkoutForm from './WorkoutForm'
import WeekSchedule from './WeekSchedule'
import AddExerciseForm from './AddExerciseForm'
import Card from './Card'
import MuscleTags from './MuscleTags'
import ExerciseDetailModal from './ExerciseDetailModal'
import ActiveRoutine from './ActiveRoutine'
import Routines from './Routines'
import WaterTracker from './WaterTracker'
import { displayName } from './displayName'
import { WEEKDAY_NAME } from './weekdays'
import { getTodayDateString } from './dateUtils'
import { logSet } from './logSet'
import { NoteIcon, TrophyIcon } from './icons'

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

function SectionLabel({ children }) {
  return (
    <h2 className="flex items-center gap-2 px-1 text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
      <span className="h-2.5 w-0.5 bg-blue-500" />
      {children}
    </h2>
  )
}

function Home({ session, profiles, schedule, onScheduleSaved, onError }) {
  const [exercises, setExercises] = useState([])
  const [todaysSets, setTodaysSets] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [exercisesVersion, setExercisesVersion] = useState(0)
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [showLogSet, setShowLogSet] = useState(false)
  const [showExercises, setShowExercises] = useState(false)
  const [routines, setRoutines] = useState([])
  const [routinesVersion, setRoutinesVersion] = useState(0)
  const [activeRoutine, setActiveRoutine] = useState(null)

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
  }, [exercisesVersion, onError])

  useEffect(() => {
    async function fetchRoutines() {
      const { data, error } = await supabase
        .from('routines')
        .select('id, user_id, name, routine_exercises(id, position, exercise_id, exercises(name))')
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
    }

    fetchTodaysSets()
  }, [refreshKey, onError])

  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p]))

  const setsByUserId = new Map()
  for (const set of todaysSets) {
    if (!setsByUserId.has(set.user_id)) setsByUserId.set(set.user_id, [])
    setsByUserId.get(set.user_id).push(set)
  }

  const groupedSets = [...setsByUserId.entries()]
    .map(([userId, sets]) => ({
      userId,
      name: profileByUserId[userId] ? displayName(profileByUserId[userId]) : userId,
      sets,
    }))
    .sort((a, b) => {
      if (a.userId === session.user.id) return -1
      if (b.userId === session.user.id) return 1
      return a.name.localeCompare(b.name)
    })

  const todayDayOfWeek = new Date().getDay()
  const todaysScheduleEntry = schedule.find(
    (s) => s.user_id === session.user.id && s.day_of_week === todayDayOfWeek
  )
  const todaysLabel = todaysScheduleEntry?.label
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
    if (error) {
      onError(
        error.code === '23503'
          ? 'Can’t delete an exercise that has logged sets.'
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
            {todaysLabel || 'Rest day'}
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
            onClick={() => setActiveRoutine(suggestedRoutine)}
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
          onExit={() => setActiveRoutine(null)}
          onLogged={() => setRefreshKey((key) => key + 1)}
          onError={onError}
        />
      )}

      <div className="flex flex-col gap-3">
        <SectionLabel>Today&apos;s sets</SectionLabel>
        {groupedSets.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">No sets logged yet today.</p>
          </Card>
        ) : (
          groupedSets.map((group) => (
            <Card key={group.userId} className="overflow-hidden">
              <h3 className="border-b border-line px-4 py-2 font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
                {group.name}
              </h3>
              <div className="divide-y divide-line">
                {groupSetsByExercise(group.sets).map((exerciseGroup) => (
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
                                    className="h-3.5 w-3.5 shrink-0 text-amber-400"
                                    aria-label="New PR"
                                  />
                                )}
                              </span>
                              <span className="flex items-center gap-3">
                                {set.user_id === session.user.id && (
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
                                    <button
                                      onClick={() => handleDeleteSet(set.id)}
                                      aria-label={`Delete ${exerciseGroup.name} set`}
                                      className="shrink-0 text-chalk-dim hover:text-danger"
                                    >
                                      ✕
                                    </button>
                                  </>
                                )}
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
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Weekly schedule</SectionLabel>
        <WeekSchedule
          schedule={schedule}
          profiles={profiles}
          userId={session.user.id}
          onSaved={onScheduleSaved}
          onError={onError}
        />
      </div>

      <Card className="p-4">
        <SectionLabel>Routines</SectionLabel>
        <Routines
          routines={routines}
          exercises={exercises}
          schedule={schedule}
          userId={session.user.id}
          onRoutinesChanged={() => setRoutinesVersion((v) => v + 1)}
          onScheduleChanged={onScheduleSaved}
          onStart={setActiveRoutine}
          onError={onError}
        />
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
          onAdded={() => setExercisesVersion((v) => v + 1)}
          onError={onError}
        />
        {showExercises && (
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
                  onClick={() => handleDeleteExercise(exercise.id)}
                  aria-label={`Delete ${exercise.name}`}
                  className="shrink-0 text-chalk-dim hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <WaterTracker session={session} profiles={profiles} onError={onError} />

      <ExerciseDetailModal
        exercise={selectedExercise}
        userId={session.user.id}
        onClose={() => setSelectedExercise(null)}
        onError={onError}
      />
    </div>
  )
}

export default Home
