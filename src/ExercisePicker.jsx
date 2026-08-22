import { useEffect, useRef, useState } from 'react'
import { groupByMuscle } from './exerciseGrouping'

const DEFAULT_INPUT_CLASSES =
  'w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none disabled:opacity-40'

// A searchable exercise dropdown: types like a text field but behaves like a
// <select>, so long exercise lists don't need to be scrolled through to find
// one by name. `value`/`onChange` mirror a native select (id as a string).
function ExercisePicker({
  exercises,
  value,
  onChange,
  placeholder = 'Search exercises',
  emptyMessage = 'No exercises yet',
  inputClassName = DEFAULT_INPUT_CLASSES,
}) {
  const selected = exercises.find((ex) => ex.id === Number(value)) ?? null
  const [search, setSearch] = useState(selected?.name ?? '')
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  // Resync the search text when the selected id changes externally (e.g. a
  // routine switch), without clobbering what the user is actively typing.
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    setSearch(selected?.name ?? '')
  }

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const normalized = search.trim().toLowerCase()
  const filtered = normalized
    ? exercises.filter((ex) => ex.name.toLowerCase().includes(normalized))
    : exercises
  const groups = groupByMuscle(filtered, (ex) => ex)

  function selectExercise(exercise) {
    setSearch(exercise.name)
    setOpen(false)
    onChange(String(exercise.id))
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
        }}
        onFocus={(e) => {
          e.target.select()
          setOpen(true)
        }}
        placeholder={exercises.length === 0 ? emptyMessage : placeholder}
        disabled={exercises.length === 0}
        autoComplete="off"
        className={inputClassName}
      />
      {open && exercises.length > 0 && (
        <div className="absolute top-full left-0 z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line bg-surface-2 shadow-lg">
          {groups.length === 0 ? (
            <p className="px-3 py-2 text-sm text-chalk-dim">No matches</p>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <p className="px-3 pt-2 pb-1 font-mono text-[10px] tracking-[0.15em] text-chalk-dim uppercase">
                  {group.label}
                </p>
                {group.items.map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectExercise(exercise)}
                    className={
                      exercise.id === selected?.id
                        ? 'block w-full truncate px-3 py-2 text-left text-sm text-blue-400'
                        : 'block w-full truncate px-3 py-2 text-left text-sm text-chalk hover:bg-surface'
                    }
                  >
                    {exercise.name}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default ExercisePicker
