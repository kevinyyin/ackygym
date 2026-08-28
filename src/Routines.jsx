import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from './weekdays'
import { primaryMuscleGroup, groupByMuscle } from './exerciseGrouping'
import { GripIcon, ChevronRightIcon } from './icons'
import ExercisePicker from './ExercisePicker'

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
      className="min-w-0 flex-1 truncate bg-transparent font-medium text-chalk focus:text-blue-400 focus:outline-none"
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
    <div className="mt-2 flex gap-2">
      <ExercisePicker
        exercises={availableExercises}
        value={selected}
        onChange={setExerciseId}
        placeholder="Search exercises"
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

    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-reorder-id]')
    if (!row) return
    const targetId = Number(row.dataset.reorderId)
    if (targetId === draggingId) return

    const groupKeyById = new Map(
      items.map((it) => [it.id, primaryMuscleGroup(it.exercises).name ?? '__other__'])
    )
    if (groupKeyById.get(targetId) !== groupKeyById.get(draggingId)) return

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

  async function handlePointerUp() {
    const draggingId = draggingIdRef.current
    draggingIdRef.current = null
    if (draggingId === null || !orderChangedRef.current) return

    onError('')
    const finalOrder = groupByMuscle(items, (re) => re.exercises).flatMap((g) => g.items)
    const results = await Promise.all(
      finalOrder.map((item, index) =>
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

  if (items.length === 0) {
    return <p className="mt-2 text-xs text-chalk-dim">No exercises yet.</p>
  }

  const groups = groupByMuscle(items, (re) => re.exercises)
  const orderIndex = new Map()
  groups.forEach((g) => g.items.forEach((re) => orderIndex.set(re.id, orderIndex.size)))

  return (
    <div className="mt-2 flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.key}>
          <GroupHeader>{group.label}</GroupHeader>
          <ul className="flex flex-col gap-1.5">
            {group.items.map((re) => (
              <li
                key={re.id}
                data-reorder-id={re.id}
                className="flex items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5"
              >
                <span className="w-4 shrink-0 text-center font-mono text-[10px] text-chalk-dim">
                  {orderIndex.get(re.id) + 1}
                </span>
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
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] tracking-wide text-chalk uppercase">
                  {re.exercises.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(re.id)}
                  aria-label={`Remove ${re.exercises.name} from ${routine.name}`}
                  className="shrink-0 text-chalk-dim hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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

  return (
    <div className="mt-2 flex gap-1">
      {WEEKDAY_ORDER.map((day) => {
        const linked = schedule.some(
          (s) => s.user_id === userId && s.day_of_week === day && s.routine_id === routine.id
        )
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(day)}
            className={
              linked
                ? 'flex-1 rounded border border-blue-500 bg-blue-500 py-1 font-mono text-[10px] tracking-wide text-onblue uppercase'
                : 'flex-1 rounded border border-line bg-surface py-1 font-mono text-[10px] tracking-wide text-chalk-dim uppercase'
            }
          >
            {WEEKDAY_SHORT[day].slice(0, 2)}
          </button>
        )
      })}
    </div>
  )
}

function Routines({
  routines,
  exercises,
  schedule,
  userId,
  onRoutinesChanged,
  onScheduleChanged,
  onStart,
  onError,
}) {
  const [newRoutineName, setNewRoutineName] = useState('')
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())
  const appliedInitialCollapse = useRef(false)

  // Routines start collapsed on each fresh load of the app. Once applied,
  // later routine list changes (add/delete/reorder) don't reset the user's
  // own expand/collapse choices.
  useEffect(() => {
    if (appliedInitialCollapse.current || routines.length === 0) return
    appliedInitialCollapse.current = true
    setCollapsedIds(new Set(routines.map((r) => r.id)))
  }, [routines])

  function toggleCollapsed(routineId) {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(routineId)) next.delete(routineId)
      else next.add(routineId)
      return next
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    onError('')
    const trimmed = newRoutineName.trim()
    if (!trimmed) return

    const { error } = await supabase.from('routines').insert({ name: trimmed })
    if (error) {
      onError(error.message)
      return
    }
    setNewRoutineName('')
    onRoutinesChanged()
  }

  async function handleDeleteRoutine(routineId) {
    onError('')
    const { error } = await supabase.from('routines').delete().eq('id', routineId)
    if (error) {
      onError(error.message)
      return
    }
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

  return (
    <div className="mt-3 flex flex-col gap-3">
      {routines.length === 0 ? (
        <p className="text-sm text-chalk-dim">No routines yet.</p>
      ) : (
        routines.map((routine) => {
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
                  aria-label={collapsed ? `Expand ${routine.name}` : `Collapse ${routine.name}`}
                  className="shrink-0 text-chalk-dim hover:text-blue-400"
                >
                  <ChevronRightIcon
                    className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                  />
                </button>
                {isOwn ? (
                  <RoutineNameField routine={routine} onSaved={onRoutinesChanged} onError={onError} />
                ) : (
                  <p className="min-w-0 flex-1 truncate font-medium text-chalk">{routine.name}</p>
                )}
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onStart(routine)}
                    className="font-mono text-[11px] tracking-wide text-blue-400 uppercase hover:text-blue-300"
                  >
                    Start
                  </button>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRoutine(routine.id)}
                      aria-label={`Delete ${routine.name}`}
                      className="text-chalk-dim hover:text-danger"
                    >
                      ✕
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
                  {isOwn ? (
                    <ReorderableExerciseList
                      routine={routine}
                      onRemove={handleRemoveExercise}
                      onReordered={onRoutinesChanged}
                      onError={onError}
                    />
                  ) : routine.routine_exercises.length === 0 ? (
                    <p className="mt-2 text-xs text-chalk-dim">No exercises yet.</p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-3">
                      {groupByMuscle(routine.routine_exercises, (re) => re.exercises).map((group) => (
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
                      ))}
                    </div>
                  )}

                  {isOwn && (
                    <>
                      <AddExerciseToRoutine
                        routine={routine}
                        availableExercises={availableExercises}
                        onAdded={onRoutinesChanged}
                        onError={onError}
                      />
                      <DayToggles
                        routine={routine}
                        schedule={schedule}
                        userId={userId}
                        onChanged={onScheduleChanged}
                        onError={onError}
                      />
                    </>
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
          className="shrink-0 rounded-md bg-blue-500 px-3 py-2 font-body text-sm font-bold text-onblue active:bg-blue-600"
        >
          Create
        </button>
      </form>
    </div>
  )
}

export default Routines
