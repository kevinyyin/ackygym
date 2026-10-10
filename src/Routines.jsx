import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { supabase } from './supabaseClient'
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from './weekdays'
import { groupByMuscle } from './exerciseGrouping'
import { GripIcon, ChevronRightIcon, CloseIcon } from './icons'
import ExercisePicker from './ExercisePicker'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import ConfirmModal from './ConfirmModal'
import UndoToast from './UndoToast'
import { useDeferredDelete } from './useDeferredDelete'
import Skeleton from './Skeleton'
import { snappy } from './motionPresets'
import { toggled } from './useSelection'
import { groupBy } from './groupByUser'
import { displayName } from './displayName'

function GroupHeader({ children }) {
  return (
    <p className="mb-1 px-1 font-mono text-[10px] tracking-[0.15em] text-chalk-dim uppercase">
      {children}
    </p>
  )
}

function RoutineNameField({ routine, onSaved, onError }) {
  const [value, setValue] = useState(routine.name)

  async function handleBlur() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === routine.name) {
      setValue(routine.name)
      return
    }

    onError('')
    const { error } = await supabase.from('routines').update({ name: trimmed }).eq('id', routine.id)
    if (error) {
      onError(error.message)
      setValue(routine.name)
      return
    }
    onSaved()
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      aria-label="Routine name"
      className="w-full min-w-0 rounded-md border border-line bg-surface px-3 py-2 font-body text-sm text-chalk focus:border-blue-500 focus:outline-none"
    />
  )
}

function AddExerciseToRoutine({ routine, availableExercises, onAdded, onError }) {
  const [exerciseId, setExerciseId] = useState('')
  const selected = exerciseId || availableExercises[0]?.id || ''

  if (availableExercises.length === 0) return null

  async function handleAdd() {
    if (!selected) return
    onError('')
    const { error } = await supabase.from('routine_exercises').insert({
      routine_id: routine.id,
      exercise_id: Number(selected),
      position: routine.routine_exercises.length,
    })
    if (error) {
      onError(error.message)
      return
    }
    setExerciseId('')
    onAdded()
  }

  return (
    <div className="flex gap-2">
      <ExercisePicker
        exercises={availableExercises}
        value={selected}
        onChange={setExerciseId}
        inputClassName="w-full min-w-0 rounded-md border border-line bg-surface px-2 py-1.5 font-body text-xs text-chalk focus:border-blue-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleAdd}
        className="shrink-0 rounded-md border border-line px-3 py-1.5 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:border-blue-500 hover:text-blue-400"
      >
        Add
      </button>
    </div>
  )
}

function ReorderableExerciseList({ routine, onRemove, onReordered, onError }) {
  const [items, setItems] = useState(routine.routine_exercises)
  const draggingIdRef = useRef(null)
  const orderChangedRef = useRef(false)

  useEffect(() => {
    if (draggingIdRef.current === null) setItems(routine.routine_exercises)
  }, [routine.routine_exercises])

  function handlePointerDown(e, id) {
    draggingIdRef.current = id
    orderChangedRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    const draggingId = draggingIdRef.current
    if (draggingId === null) return

    // Hit-tested against layout offsets, not elementFromPoint: rows are
    // mid-slide (transformed) right after a swap, and hitting a row as it
    // passes under the finger would swap it straight back.
    const list = e.currentTarget.closest('ul')
    const y = e.clientY - list.getBoundingClientRect().top
    const row = [...list.children].find((li) => y >= li.offsetTop && y < li.offsetTop + li.offsetHeight)
    if (!row) return
    const targetId = Number(row.dataset.reorderId)
    if (targetId === draggingId) return

    setItems((current) => {
      const fromIndex = current.findIndex((it) => it.id === draggingId)
      const toIndex = current.findIndex((it) => it.id === targetId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    orderChangedRef.current = true
  }

  function handlePointerCancel() {
    draggingIdRef.current = null
    setItems(routine.routine_exercises)
  }

  async function persistOrder(nextItems) {
    onError('')
    const results = await Promise.all(
      nextItems.map((item, index) =>
        supabase.from('routine_exercises').update({ position: index }).eq('id', item.id)
      )
    )
    const failed = results.find((r) => r.error)
    if (failed) {
      onError(failed.error.message)
      return
    }
    onReordered()
  }

  async function handlePointerUp() {
    const draggingId = draggingIdRef.current
    draggingIdRef.current = null
    if (draggingId === null || !orderChangedRef.current) return
    await persistOrder(items)
  }

  // Keyboard/pointer-free alternative to drag-to-reorder — moves an item one
  // slot in the full list.
  async function moveItem(id, direction) {
    const fromIndex = items.findIndex((it) => it.id === id)
    const toIndex = fromIndex + direction
    if (toIndex < 0 || toIndex >= items.length) return

    const next = [...items]
    ;[next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]]
    setItems(next)
    await persistOrder(next)
  }

  if (items.length === 0) {
    return <p className="text-xs text-chalk-dim">No exercises yet.</p>
  }

  return (
    <ul className="relative flex flex-col gap-1.5">
      {items.map((re, index) => (
        <motion.li
          key={re.id}
          layout="position"
          transition={snappy}
          data-reorder-id={re.id}
          className="flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5"
        >
          <button
            type="button"
            onPointerDown={(e) => handlePointerDown(e, re.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            aria-label={`Reorder ${re.exercises.name}`}
            className="shrink-0 touch-none cursor-grab text-chalk-dim active:cursor-grabbing"
          >
            <GripIcon className="h-4 w-4" />
          </button>
          <div className="flex shrink-0 flex-col">
            <button
              type="button"
              onClick={() => moveItem(re.id, -1)}
              disabled={index === 0}
              aria-label={`Move ${re.exercises.name} up`}
              className="text-chalk-dim hover:text-blue-400 disabled:opacity-30"
            >
              <ChevronRightIcon className="h-3 w-3 -rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => moveItem(re.id, 1)}
              disabled={index === items.length - 1}
              aria-label={`Move ${re.exercises.name} down`}
              className="text-chalk-dim hover:text-blue-400 disabled:opacity-30"
            >
              <ChevronRightIcon className="h-3 w-3 rotate-90" />
            </button>
          </div>
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] tracking-wide text-chalk uppercase">
            {re.exercises.name}
          </span>
          <ConfirmDeleteButton
            onConfirm={() => onRemove(re.id)}
            idleLabel={`Remove ${re.exercises.name} from ${routine.name}`}
            armedLabel={`Tap again to confirm removing ${re.exercises.name} from ${routine.name}`}
            className="shrink-0"
          />
        </motion.li>
      ))}
    </ul>
  )
}

function DayToggles({ routine, schedule, userId, onChanged, onError }) {
  async function toggleDay(day) {
    onError('')
    const existing = schedule.find((s) => s.user_id === userId && s.day_of_week === day)
    const currentlyLinked = existing?.routine_id === routine.id

    const { error } = await supabase.from('schedule').upsert(
      {
        user_id: userId,
        day_of_week: day,
        label: '',
        routine_id: currentlyLinked ? null : routine.id,
      },
      { onConflict: 'user_id,day_of_week' }
    )

    if (error) {
      onError(error.message)
      return
    }
    onChanged()
  }

  // A weekday holds one routine, so tapping a day another routine owns moves
  // it here — said out loud below instead of happening silently.
  const takenElsewhere = WEEKDAY_ORDER.map((day) =>
    schedule.find(
      (s) => s.user_id === userId && s.day_of_week === day && s.routine_id && s.routine_id !== routine.id
    )
  ).filter(Boolean)
  const takenDays = new Set(takenElsewhere.map((s) => s.day_of_week))

  function renderDayButton(day) {
    const linked = schedule.some(
      (s) => s.user_id === userId && s.day_of_week === day && s.routine_id === routine.id
    )
    return (
      <button
        key={day}
        type="button"
        onClick={() => toggleDay(day)}
        aria-pressed={linked}
        className={
          linked
            ? 'flex-1 rounded border border-blue-500 bg-blue-500 py-1 font-mono text-[10px] tracking-wide text-onblue uppercase'
            : `flex-1 rounded border bg-surface py-1 font-mono text-[10px] tracking-wide text-chalk-dim uppercase ${
                takenDays.has(day) ? 'border-dashed border-chalk-dim/60' : 'border-line'
              }`
        }
      >
        {WEEKDAY_SHORT[day].slice(0, 2)}
      </button>
    )
  }

  // Split into weekday/weekend clusters (5 + 2) instead of one undifferentiated
  // 7-button row, so this stays within the ~4-items-per-group chunking guideline.
  return (
    <>
      <div className="flex gap-2">
        <div className="flex flex-1 gap-1">{WEEKDAY_ORDER.slice(0, 5).map(renderDayButton)}</div>
        <div className="flex gap-1" style={{ flexBasis: '28.5%' }}>
          {WEEKDAY_ORDER.slice(5).map(renderDayButton)}
        </div>
      </div>
      {takenElsewhere.length > 0 && (
        <p className="text-xs text-chalk-dim">
          {[...groupBy(takenElsewhere, (s) => s.routines?.name ?? 'another routine')]
            .map(([name, entries]) => `${entries.map((s) => WEEKDAY_SHORT[s.day_of_week].slice(0, 2)).join(', ')}: ${name}`)
            .join(' · ')}{' '}
          — tapping one moves it here.
        </p>
      )}
    </>
  )
}

function Routines({
  routines,
  loaded = true,
  exercises,
  profiles,
  schedule,
  userId,
  onRoutinesChanged,
  onScheduleChanged,
  onStart,
  onError,
}) {
  const [newRoutineName, setNewRoutineName] = useState('')
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  const appliedInitialCollapse = useRef(false)
  const [routineToDelete, setRoutineToDelete] = useState(null)
  const [duplicatingId, setDuplicatingId] = useState(null)
  const [addExerciseOpenIds, setAddExerciseOpenIds] = useState(() => new Set())
  const { isPending, message, stageDelete, undo } = useDeferredDelete('routines')

  function toggleAddExerciseOpen(routineId) {
    setAddExerciseOpenIds((current) => toggled(current, routineId))
  }

  // Routines start collapsed on each fresh load of the app. Once applied,
  // later routine list changes (add/delete/reorder) don't reset the user's
  // own expand/collapse choices.
  useEffect(() => {
    if (appliedInitialCollapse.current || routines.length === 0) return
    appliedInitialCollapse.current = true
    setCollapsedIds(new Set(routines.map((r) => r.id)))
  }, [routines])

  function toggleCollapsed(routineId) {
    setCollapsedIds((current) => toggled(current, routineId))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (creatingRef.current) return
    const trimmed = newRoutineName.trim()
    if (!trimmed) return

    creatingRef.current = true
    onError('')
    setCreating(true)
    const { error } = await supabase.from('routines').insert({ name: trimmed })
    creatingRef.current = false
    setCreating(false)

    if (error) {
      onError(error.message)
      return
    }
    setNewRoutineName('')
    onRoutinesChanged()
  }

  function handleDeleteRoutine(routine) {
    setRoutineToDelete(null)
    stageDelete({
      ids: [routine.id],
      message: `"${routine.name}" deleted`,
      commit: async (isForeground) => {
        if (isForeground) onError('')
        const { error } = await supabase.from('routines').delete().eq('id', routine.id)
        if (error) {
          if (isForeground) onError(error.message)
          return
        }
        onRoutinesChanged()
      },
    })
  }

  // Copies the exercise list, not the schedule assignment — the copy is a
  // starting point the user will deliberately assign a day to, not an
  // instant second instance of an already-scheduled routine.
  async function handleDuplicateRoutine(routine) {
    if (duplicatingId !== null) return
    setDuplicatingId(routine.id)
    onError('')

    const { data: newRoutine, error: insertError } = await supabase
      .from('routines')
      .insert({ name: `${routine.name} (copy)` })
      .select('id')
      .single()

    if (insertError) {
      onError(insertError.message)
      setDuplicatingId(null)
      return
    }

    if (routine.routine_exercises.length > 0) {
      const { error: exercisesError } = await supabase.from('routine_exercises').insert(
        routine.routine_exercises.map((re) => ({
          routine_id: newRoutine.id,
          exercise_id: re.exercise_id,
          position: re.position,
        }))
      )
      if (exercisesError) {
        onError(exercisesError.message)
        setDuplicatingId(null)
        return
      }
    }

    setDuplicatingId(null)
    onRoutinesChanged()
  }

  async function handleRemoveExercise(routineExerciseId) {
    onError('')
    const { error } = await supabase.from('routine_exercises').delete().eq('id', routineExerciseId)
    if (error) {
      onError(error.message)
      return
    }
    onRoutinesChanged()
  }

  // Your own routines first; name order (from the query) kept within each group.
  const visibleRoutines = routines
    .filter((r) => !isPending(r.id))
    .sort((a, b) => Number(b.user_id === userId) - Number(a.user_id === userId))
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  return (
    <>
    <div className="mt-3 flex flex-col gap-3">
      {!loaded ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Loading</span>
          <Skeleton tone="surface-2" className="h-11 rounded-field" />
          <Skeleton tone="surface-2" className="h-11 rounded-field" />
        </div>
      ) : visibleRoutines.length === 0 ? (
        <p className="text-sm text-chalk-dim">No routines yet.</p>
      ) : (
        visibleRoutines.map((routine) => {
          const isOwn = routine.user_id === userId
          const availableExercises = exercises.filter(
            (ex) => !routine.routine_exercises.some((re) => re.exercise_id === ex.id)
          )
          const exerciseCount = routine.routine_exercises.length
          const collapsed = collapsedIds.has(routine.id)

          return (
            <div key={routine.id} className="rounded-md border border-line bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(routine.id)}
                  aria-expanded={!collapsed}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronRightIcon
                    className={`h-4 w-4 shrink-0 text-chalk-dim transition-transform ${collapsed ? '' : 'rotate-90'}`}
                  />
                  <span className="min-w-0 truncate font-medium text-chalk">{routine.name}</span>
                  {!isOwn && profileById[routine.user_id] && (
                    <span className="shrink-0 text-xs text-chalk-dim">
                      {displayName(profileById[routine.user_id])}
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onStart(routine)}
                    className="font-mono text-[11px] tracking-wide text-blue-400 uppercase hover:text-blue-300"
                  >
                    Start
                  </button>
                  {/* Anyone's routine can be copied into your own editable one. */}
                  <button
                    type="button"
                    onClick={() => handleDuplicateRoutine(routine)}
                    disabled={duplicatingId === routine.id}
                    aria-label={`Duplicate ${routine.name}`}
                    className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400 disabled:opacity-40"
                  >
                    {duplicatingId === routine.id ? 'Duplicating…' : 'Duplicate'}
                  </button>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => setRoutineToDelete(routine)}
                      aria-label={`Delete ${routine.name}`}
                      className="rounded px-1 py-0.5 text-chalk-dim hover:text-danger"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {collapsed ? (
                <p className="mt-1 pl-6 font-mono text-[11px] text-chalk-dim">
                  {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}
                </p>
              ) : (
                <>
                  {isOwn && (
                    <div className="mt-4">
                      <RoutineNameField routine={routine} onSaved={onRoutinesChanged} onError={onError} />
                    </div>
                  )}
                  <div className="mt-4 flex flex-col gap-2">
                    <h2 className="text-headline text-chalk">Exercises</h2>
                    {isOwn ? (
                      <>
                        <ReorderableExerciseList
                          routine={routine}
                          onRemove={handleRemoveExercise}
                          onReordered={onRoutinesChanged}
                          onError={onError}
                        />
                        {addExerciseOpenIds.has(routine.id) ? (
                          <AddExerciseToRoutine
                            routine={routine}
                            availableExercises={availableExercises}
                            onAdded={onRoutinesChanged}
                            onError={onError}
                          />
                        ) : (
                          availableExercises.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleAddExerciseOpen(routine.id)}
                              className="self-start font-mono text-[11px] tracking-wide text-blue-400 uppercase hover:text-blue-300"
                            >
                              + Add exercise
                            </button>
                          )
                        )}
                      </>
                    ) : routine.routine_exercises.length === 0 ? (
                      <p className="text-xs text-chalk-dim">No exercises yet.</p>
                    ) : (
                      groupByMuscle(routine.routine_exercises, (re) => re.exercises).map((group) => (
                        <div key={group.key}>
                          <GroupHeader>{group.label}</GroupHeader>
                          <div className="flex flex-wrap gap-1.5">
                            {group.items.map((re) => (
                              <span
                                key={re.id}
                                className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] tracking-wide text-chalk uppercase"
                              >
                                {re.exercises.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {isOwn && (
                    <div className="mt-4 flex flex-col gap-2">
                      <h2 className="text-headline text-chalk">Schedule</h2>
                      <DayToggles
                        routine={routine}
                        schedule={schedule}
                        userId={userId}
                        onChanged={onScheduleChanged}
                        onError={onError}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })
      )}

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={newRoutineName}
          onChange={(e) => setNewRoutineName(e.target.value)}
          placeholder="New routine"
          className="w-full min-w-0 rounded-md border border-line bg-surface-2 px-3 py-2 font-body text-sm text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating}
          className="shrink-0 rounded-md bg-blue-500 px-3 py-2 font-body text-sm font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>
    </div>

    <ConfirmModal
      open={routineToDelete !== null}
      title="Delete routine?"
      message={`"${routineToDelete?.name}" and its exercise list will be removed.`}
      onConfirm={() => handleDeleteRoutine(routineToDelete)}
      onCancel={() => setRoutineToDelete(null)}
    />

    <UndoToast message={message} onUndo={undo} />
    </>
  )
}

export default Routines
