import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { supabase } from './supabaseClient'
import { WEEKDAY_ORDER, WEEKDAY_SHORT, WEEKDAY_NAME } from './weekdays'
import { groupByMuscle } from './exerciseGrouping'
import { GripIcon, ChevronRightIcon, MoreIcon, PlusIcon } from './icons'
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
import Button from './Button'
import Sheet from './Sheet'

function GroupHeader({ children }) {
  return (
    <p className="mb-1.5 px-1 text-caption text-chalk-dim">
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
      className="h-11 w-full min-w-0 bg-surface-2 px-4 rounded-field text-base text-chalk placeholder:text-chalk-dim focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}

// Target rep range shown in Today's routine card ("aim for 8–12"). Either end
// may be blank; a reversed pair is saved swapped. The range belongs to the
// exercise, so saving writes it to every one of the owner's routines that has
// it — the sheet says so rather than doing it silently.
function RepRangeField({ routineExercise, ownRoutineIds, onSaved, onError }) {
  const [open, setOpen] = useState(false)
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const name = routineExercise.exercises.name
  const { rep_min: repMin, rep_max: repMax } = routineExercise

  function openSheet() {
    setMin(repMin ?? '')
    setMax(repMax ?? '')
    setOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    const parse = (v) => (v !== '' && Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null)
    let [nextMin, nextMax] = [parse(min), parse(max)]
    if (nextMin !== null && nextMax !== null && nextMin > nextMax) [nextMin, nextMax] = [nextMax, nextMin]
    setOpen(false)
    if (nextMin === repMin && nextMax === repMax) return

    onError('')
    const { error } = await supabase
      .from('routine_exercises')
      .update({ rep_min: nextMin, rep_max: nextMax })
      .eq('exercise_id', routineExercise.exercise_id)
      .in('routine_id', ownRoutineIds)
    if (error) {
      onError(error.message)
      return
    }
    onSaved()
  }

  const range =
    repMin != null && repMax != null
      ? repMin === repMax
        ? `${repMin}`
        : `${repMin}–${repMax}`
      : repMin != null
        ? `${repMin}+`
        : repMax != null
          ? `≤${repMax}`
          : null
  const fieldClasses = "h-12 w-full min-w-0 bg-surface-2 px-4 text-[17px] tabular-nums rounded-field text-base text-chalk placeholder:text-chalk-dim focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-label={`Rep range for ${name}: ${range ? `${range} reps` : 'not set'}`}
        className={`flex h-11 shrink-0 items-center rounded-full px-3 text-caption tabular-nums active:bg-surface-2 ${
          range ? 'text-chalk' : 'text-chalk-dim'
        }`}
      >
        {range ? `${range} reps` : 'Set reps'}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`${name} · reps`}>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-caption text-chalk-dim">
              At least
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="—"
                className={fieldClasses}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-caption text-chalk-dim">
              At most
              <input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="—"
                className={fieldClasses}
              />
            </label>
          </div>
          <p className="text-caption text-chalk-dim">
            Applies to {name} in all your routines. Leave both blank for no target.
          </p>
          <Button type="submit" variant="accent">
            Save
          </Button>
        </form>
      </Sheet>
    </>
  )
}

function AddExerciseToRoutine({ routine, availableExercises, repRangeFor, onAdded, onCancel, onError }) {
  // Nothing preselected: one stray tap on Add used to insert whichever
  // exercise happened to be first in the list.
  const [exerciseId, setExerciseId] = useState('')
  const addingRef = useRef(false)

  if (availableExercises.length === 0) return null

  async function handleAdd() {
    if (!exerciseId || addingRef.current) return
    addingRef.current = true
    onError('')
    const { error } = await supabase.from('routine_exercises').insert({
      routine_id: routine.id,
      exercise_id: Number(exerciseId),
      // After the highest position, not at the count: removals leave gaps, so
      // the count can collide with a position still in use.
      position: Math.max(-1, ...routine.routine_exercises.map((re) => re.position)) + 1,
      ...repRangeFor(Number(exerciseId)),
    })
    addingRef.current = false
    if (error) {
      onError(error.message)
      return
    }
    // Stays open for the next one: routines are usually built several at a time.
    setExerciseId('')
    onAdded()
  }

  return (
    <div className="flex flex-col gap-2">
      <ExercisePicker
        exercises={availableExercises}
        value={exerciseId}
        onChange={setExerciseId}
        placeholder="Search exercises to add"
        inputClassName="h-11 w-full min-w-0 bg-surface px-4 rounded-field text-base text-chalk placeholder:text-chalk-dim focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-full bg-surface text-[15px] font-semibold text-chalk-dim active:text-chalk"
        >
          Done
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!exerciseId}
          className="h-11 flex-1 rounded-full bg-blue-500 text-[15px] font-semibold text-onblue active:bg-blue-600 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

function ReorderableExerciseList({ routine, ownRoutineIds, onRemove, onReordered, onError }) {
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
    return <p className="px-1 text-[15px] text-chalk-dim">No exercises yet.</p>
  }

  return (
    <ul className="relative flex flex-col gap-1.5">
      {items.map((re, index) => (
        <motion.li
          key={re.id}
          layout="position"
          transition={snappy}
          data-reorder-id={re.id}
          className="flex min-h-14 items-center gap-1 rounded-field bg-surface pr-1"
        >
          {/* Touch drag only; the arrows below are the keyboard/VoiceOver path. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onPointerDown={(e) => handlePointerDown(e, re.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className="flex h-11 w-9 shrink-0 touch-none cursor-grab items-center justify-center text-chalk-dim active:cursor-grabbing"
          >
            <GripIcon className="h-5 w-5" />
          </button>
          {/* 44px arrows don't fit beside the name on a phone, so they appear
              only when focused — reachable by keyboard and VoiceOver swipes. */}
          <button
            type="button"
            onClick={() => moveItem(re.id, -1)}
            disabled={index === 0}
            aria-label={`Move ${re.exercises.name} up`}
            className="sr-only text-chalk-dim focus:not-sr-only focus:flex focus:h-11 focus:w-11 focus:shrink-0 focus:items-center focus:justify-center"
          >
            <ChevronRightIcon className="h-5 w-5 -rotate-90" />
          </button>
          <button
            type="button"
            onClick={() => moveItem(re.id, 1)}
            disabled={index === items.length - 1}
            aria-label={`Move ${re.exercises.name} down`}
            className="sr-only text-chalk-dim focus:not-sr-only focus:flex focus:h-11 focus:w-11 focus:shrink-0 focus:items-center focus:justify-center"
          >
            <ChevronRightIcon className="h-5 w-5 rotate-90" />
          </button>
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-chalk">{re.exercises.name}</span>
          <RepRangeField
            key={`${re.rep_min}-${re.rep_max}`}
            routineExercise={re}
            ownRoutineIds={ownRoutineIds}
            onSaved={onReordered}
            onError={onError}
          />
          <ConfirmDeleteButton
            onConfirm={() => {
              // Gone at once; a failed delete refetches, which brings it back.
              setItems((current) => current.filter((it) => it.id !== re.id))
              onRemove(re.id)
            }}
            idleLabel={`Remove ${re.exercises.name} from ${routine.name}`}
            armedLabel={`Tap again to confirm removing ${re.exercises.name} from ${routine.name}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          />
        </motion.li>
      ))}
    </ul>
  )
}

function DayToggles({ routine, schedule, userId, onPlan, onChanged, onError }) {
  async function toggleDay(day) {
    onError('')
    const existing = schedule.find((s) => s.user_id === userId && s.day_of_week === day)
    const routineId = existing?.routine_id === routine.id ? null : routine.id
    onPlan(day, routineId)

    const { error } = await supabase.from('schedule').upsert(
      { user_id: userId, day_of_week: day, label: '', routine_id: routineId },
      { onConflict: 'user_id,day_of_week' }
    )

    if (error) {
      onPlan(day, undefined)
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
        aria-label={WEEKDAY_NAME[day]}
        className={`h-11 min-w-0 flex-1 rounded-full border text-[13px] font-semibold transition-colors ${
          linked
            ? 'border-blue-500 bg-blue-500 text-onblue'
            : `bg-surface text-chalk-dim ${takenDays.has(day) ? 'border-dashed border-chalk-dim/60' : 'border-transparent'}`
        }`}
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
        <p className="px-1 text-caption text-chalk-dim">
          {[...groupBy(takenElsewhere, (s) => s.routines?.name ?? 'another routine')]
            .map(([name, entries]) => `${entries.map((s) => WEEKDAY_SHORT[s.day_of_week].slice(0, 2)).join(', ')}: ${name}`)
            .join(' · ')}{' '}
          — tapping one moves it here.
        </p>
      )}
    </>
  )
}

// Up/down buttons rather than drag: one-handed, keyboard- and VoiceOver-usable,
// and a short list of routines never needs more than a few taps.
function ReorderRoutinesList({ routines, onMove, onDone }) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col divide-y divide-line rounded-field bg-surface-2">
        {routines.map((routine, index) => (
          <motion.li key={routine.id} layout transition={snappy} className="flex min-h-14 items-center gap-1 pr-1.5 pl-4">
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-chalk">{routine.name}</span>
            <button
              type="button"
              onClick={() => onMove(routines, index, -1)}
              disabled={index === 0}
              aria-label={`Move ${routine.name} up`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-chalk-dim active:bg-surface disabled:opacity-30"
            >
              <ChevronRightIcon className="h-5 w-5 -rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => onMove(routines, index, 1)}
              disabled={index === routines.length - 1}
              aria-label={`Move ${routine.name} down`}
              className="flex h-11 w-11 items-center justify-center rounded-full text-chalk-dim active:bg-surface disabled:opacity-30"
            >
              <ChevronRightIcon className="h-5 w-5 rotate-90" />
            </button>
          </motion.li>
        ))}
      </ol>
      <Button variant="secondary" onClick={onDone}>
        Done
      </Button>
    </div>
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
  // The "…" sheet. The routine is kept after closing so the exit animation still shows its name.
  const [actions, setActions] = useState({ open: false, routine: null })
  const closeActions = () => setActions((current) => ({ ...current, open: false }))
  const [addExerciseOpenIds, setAddExerciseOpenIds] = useState(() => new Set())
  const { isPending, message, stageDelete, undo } = useDeferredDelete('routines')

  // Day taps light up at once: planned[day] is the routine id (or null) just
  // saved, shown over the schedule prop until App's refetch of it arrives.
  // Kept here, not per routine, so a day moving between routines updates both.
  const [planned, setPlanned] = useState({})
  const [plannedFor, setPlannedFor] = useState(schedule)
  if (plannedFor !== schedule) {
    setPlannedFor(schedule)
    setPlanned({})
  }
  const plannedSchedule = [
    ...schedule.filter((s) => s.user_id !== userId || !(s.day_of_week in planned)),
    ...Object.entries(planned).map(([day, routineId]) => ({
      ...schedule.find((s) => s.user_id === userId && s.day_of_week === Number(day)),
      user_id: userId,
      day_of_week: Number(day),
      routine_id: routineId,
      routines: { name: routines.find((r) => r.id === routineId)?.name },
    })),
  ]

  // Train › Reorder: ownOrder (routine ids) is shown over the fetched order at
  // once and saved in the background, then dropped when the refetch lands.
  const [reordering, setReordering] = useState(false)
  const [ownOrder, setOwnOrder] = useState(null)
  const [ownOrderFor, setOwnOrderFor] = useState(routines)
  if (ownOrderFor !== routines) {
    setOwnOrderFor(routines)
    setOwnOrder(null)
  }
  // Only the last of several quick moves refetches, so an earlier refetch
  // can't briefly put back an order the user has already changed again.
  const reorderSeqRef = useRef(0)
  // Saves run one at a time in tap order: per-row updates sent in parallel
  // could land out of order and leave two routines on one position.
  const reorderSaveRef = useRef(Promise.resolve())

  async function moveRoutine(ordered, index, direction) {
    const next = [...ordered]
    const [moved] = next.splice(index, 1)
    next.splice(index + direction, 0, moved)
    setOwnOrder(next.map((r) => r.id))
    onError('')
    const seq = ++reorderSeqRef.current
    // Per-row updates, not one upsert: routines.id is GENERATED ALWAYS, so an
    // upsert carrying ids is rejected. A partial failure refetches the real order.
    const save = reorderSaveRef.current.then(() =>
      Promise.all(next.map((r, position) =>
        supabase.from('routines').update({ position }).eq('id', r.id)
      ))
    )
    reorderSaveRef.current = save.catch(() => {})
    const error = (await save).find((result) => result.error)?.error
    if (error) onError(error.message)
    if (error || seq === reorderSeqRef.current) onRoutinesChanged()
  }

  function planDay(day, routineId) {
    setPlanned((current) => {
      const next = { ...current }
      if (routineId === undefined) delete next[day]
      else next[day] = routineId
      return next
    })
  }

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
    const { error } = await supabase.from('routines').insert({ name: trimmed, position: nextOwnPosition })
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
      .insert({ name: `${routine.name} (copy)`, position: nextOwnPosition })
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
          rep_min: re.rep_min,
          rep_max: re.rep_max,
          // Your existing range for the exercise wins over the source routine's.
          ...repRangeFor(re.exercise_id),
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
    if (error) onError(error.message)
    onRoutinesChanged()
  }

  // Your own routines first, in your order (Reorder); others' after, in theirs.
  const ownRoutines = ownOrder
    ? ownOrder.map((id) => routines.find((r) => r.id === id)).filter(Boolean)
    : routines.filter((r) => r.user_id === userId)
  const visibleRoutines = [...ownRoutines, ...routines.filter((r) => r.user_id !== userId)].filter(
    (r) => !isPending(r.id)
  )
  const nextOwnPosition = Math.max(-1, ...ownRoutines.map((r) => r.position ?? -1)) + 1
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))
  const ownRoutineIds = ownRoutines.map((r) => r.id)
  // The user's current range for an exercise, from any of their routines that
  // sets one; {} when none does.
  function repRangeFor(exerciseId) {
    const re = ownRoutines
      .flatMap((r) => r.routine_exercises)
      .find((x) => x.exercise_id === exerciseId && (x.rep_min != null || x.rep_max != null))
    return re ? { rep_min: re.rep_min, rep_max: re.rep_max } : {}
  }

  return (
    <>
    <div className="-my-1.5 flex min-h-11 items-center justify-between gap-2">
      <h2 className="text-headline text-chalk">{reordering ? 'Reorder routines' : 'Routines'}</h2>
      {loaded && !reordering && ownRoutines.length > 1 && (
        <button
          type="button"
          onClick={() => setReordering(true)}
          className="-mr-2 h-11 px-2 text-[15px] font-semibold text-blue-400"
        >
          Reorder
        </button>
      )}
    </div>
    <div className="mt-3 flex flex-col gap-3">
      {!loaded ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Loading</span>
          <Skeleton tone="surface-2" className="h-11 rounded-field" />
          <Skeleton tone="surface-2" className="h-11 rounded-field" />
        </div>
      ) : visibleRoutines.length === 0 ? (
        <p className="px-1 text-[15px] text-chalk-dim">No routines yet. Name one below to start planning your week.</p>
      ) : reordering ? (
        <ReorderRoutinesList
          routines={ownRoutines.filter((r) => !isPending(r.id))}
          onMove={moveRoutine}
          onDone={() => setReordering(false)}
        />
      ) : (
        visibleRoutines.map((routine) => {
          const isOwn = routine.user_id === userId
          const availableExercises = exercises.filter(
            (ex) => !routine.routine_exercises.some((re) => re.exercise_id === ex.id)
          )
          const exerciseCount = routine.routine_exercises.length
          const collapsed = collapsedIds.has(routine.id)

          return (
            <div key={routine.id} className="rounded-field bg-surface-2 p-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(routine.id)}
                  aria-expanded={!collapsed}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronRightIcon
                    className={`h-4 w-4 shrink-0 text-chalk-dim transition-transform ${collapsed ? '' : 'rotate-90'}`}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[17px] font-semibold text-chalk">{routine.name}</span>
                    <span className="truncate text-caption text-chalk-dim">
                      {[
                        !isOwn && profileById[routine.user_id] && displayName(profileById[routine.user_id]),
                        `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onStart(routine)}
                  disabled={exerciseCount === 0}
                  aria-label={`Start ${routine.name}`}
                  className="h-11 shrink-0 rounded-full bg-blue-500 px-4 text-[15px] font-semibold text-onblue active:bg-blue-600 disabled:opacity-40"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => setActions({ open: true, routine })}
                  aria-haspopup="dialog"
                  aria-label={`More actions for ${routine.name}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-chalk-dim active:bg-surface"
                >
                  <MoreIcon className="h-5 w-5" />
                </button>
              </div>

              {!collapsed && (
                <>
                  <section className="mt-3 flex flex-col gap-2">
                    <h3 className="px-1 text-caption font-medium text-chalk-dim">Exercises</h3>
                    {isOwn ? (
                      <>
                        <ReorderableExerciseList
                          routine={routine}
                          ownRoutineIds={ownRoutineIds}
                          onRemove={handleRemoveExercise}
                          onReordered={onRoutinesChanged}
                          onError={onError}
                        />
                        {addExerciseOpenIds.has(routine.id) ? (
                          <AddExerciseToRoutine
                            routine={routine}
                            availableExercises={availableExercises}
                            repRangeFor={repRangeFor}
                            onAdded={onRoutinesChanged}
                            onCancel={() => toggleAddExerciseOpen(routine.id)}
                            onError={onError}
                          />
                        ) : (
                          availableExercises.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleAddExerciseOpen(routine.id)}
                              className="flex h-11 items-center gap-1.5 self-start px-1 text-[15px] font-semibold text-blue-400 active:text-blue-300"
                            >
                              <PlusIcon className="h-4 w-4" aria-hidden="true" />
                              Add exercise
                            </button>
                          )
                        )}
                      </>
                    ) : routine.routine_exercises.length === 0 ? (
                      <p className="px-1 text-[15px] text-chalk-dim">No exercises yet.</p>
                    ) : (
                      groupByMuscle(routine.routine_exercises, (re) => re.exercises).map((group) => (
                        <div key={group.key}>
                          <GroupHeader>{group.label}</GroupHeader>
                          <div className="flex flex-wrap gap-1.5">
                            {group.items.map((re) => (
                              <span key={re.id} className="rounded-full bg-surface px-3 py-1.5 text-[13px] text-chalk">
                                {re.exercises.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </section>

                  {isOwn && (
                    <section className="mt-4 flex flex-col gap-2">
                      <h3 className="px-1 text-caption font-medium text-chalk-dim">Schedule</h3>
                      <DayToggles
                        routine={routine}
                        schedule={plannedSchedule}
                        userId={userId}
                        onPlan={planDay}
                        onChanged={onScheduleChanged}
                        onError={onError}
                      />
                    </section>
                  )}
                </>
              )}
            </div>
          )
        })
      )}

      {!reordering && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newRoutineName}
            onChange={(e) => setNewRoutineName(e.target.value)}
            placeholder="New routine"
            aria-label="New routine name"
            className="h-11 w-full min-w-0 rounded-field bg-surface-2 px-4 text-base text-chalk placeholder:text-chalk-dim focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="h-11 shrink-0 rounded-full bg-blue-500 px-5 text-[15px] font-semibold text-onblue active:bg-blue-600 disabled:opacity-40"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}
    </div>

    <Sheet open={actions.open} onClose={closeActions} title={actions.routine?.name}>
      <div className="flex flex-col gap-3">
        {/* Renaming lives here rather than as an always-open field under the
            title, which repeated the name and invited stray keyboard pops. */}
        {actions.routine?.user_id === userId && (
          <label className="flex flex-col gap-1.5 px-1 text-caption text-chalk-dim">
            Name
            <RoutineNameField
              key={actions.routine.id}
              routine={actions.routine}
              onSaved={onRoutinesChanged}
              onError={onError}
            />
          </label>
        )}
        <Button
          variant="secondary"
          disabled={duplicatingId !== null}
          onClick={() => {
            closeActions()
            handleDuplicateRoutine(actions.routine)
          }}
        >
          Duplicate
        </Button>
        <p className="-mt-1 px-1 text-caption text-chalk-dim">
          Copies the exercises into a new routine of yours. Days aren’t copied.
        </p>
        {actions.routine?.user_id === userId && (
          <Button
            variant="destructive"
            onClick={() => {
              closeActions()
              setRoutineToDelete(actions.routine)
            }}
          >
            Delete routine
          </Button>
        )}
      </div>
    </Sheet>

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
