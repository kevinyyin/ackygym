import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { normalizeExerciseName } from './normalizeExerciseName'
import { sortMuscleGroups } from './muscleGroupOrder'

function AddExerciseForm({ exercises, showMuscleGroups, onAdded, onError }) {
  const [name, setName] = useState('')
  const [muscleGroups, setMuscleGroups] = useState([])
  const [selected, setSelected] = useState({})
  const [catalog, setCatalog] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    async function fetchMuscleGroups() {
      const { data, error } = await supabase.from('muscle_groups').select('name, label')
      if (error) {
        onError(error.message)
        return
      }
      setMuscleGroups(sortMuscleGroups(data))
    }

    fetchMuscleGroups()
  }, [onError])

  async function ensureCatalogLoaded() {
    if (catalog !== null) return catalog

    const { data, error } = await supabase
      .from('exercise_catalog')
      .select('id, name, exercise_catalog_muscles(muscle, role)')
      .order('name')

    if (error) {
      onError(error.message)
      setCatalog([])
      return []
    }
    setCatalog(data)
    return data
  }

  async function addToCatalogIfMissing(trimmedName, normalizedName, muscleRows) {
    const currentCatalog = await ensureCatalogLoaded()
    const alreadyCataloged = currentCatalog.some(
      (item) => normalizeExerciseName(item.name) === normalizedName
    )
    if (alreadyCataloged) return

    const { data: catalogInserted, error: catalogError } = await supabase
      .from('exercise_catalog')
      .insert({ name: trimmedName })
      .select('id')
      .single()

    // Catalog enrichment is a background nice-to-have — the exercise the
    // user actually asked for is already saved, so don't surface an error
    // for this secondary step.
    if (catalogError) return

    const catalogMuscles = muscleRows.map((m) => ({ muscle: m.muscle, role: m.role }))
    if (catalogMuscles.length > 0) {
      await supabase.from('exercise_catalog_muscles').insert(
        catalogMuscles.map((m) => ({ catalog_id: catalogInserted.id, ...m }))
      )
    }

    setCatalog((current) => [
      ...(current ?? []),
      {
        id: catalogInserted.id,
        name: trimmedName,
        exercise_catalog_muscles: catalogMuscles,
      },
    ])
  }

  const normalized = normalizeExerciseName(name)
  const suggestions =
    catalog && normalized
      ? catalog
          .filter((item) => normalizeExerciseName(item.name).includes(normalized))
          .slice(0, 8)
      : []

  function selectSuggestion(item) {
    setName(item.name)
    setSelected(Object.fromEntries(item.exercise_catalog_muscles.map((m) => [m.muscle, m.role])))
    setDropdownOpen(false)
  }

  function cycleMuscle(muscleName) {
    setSelected((current) => {
      const next = { ...current }
      if (next[muscleName] === 'primary') {
        next[muscleName] = 'secondary'
      } else if (next[muscleName] === 'secondary') {
        delete next[muscleName]
      } else {
        next[muscleName] = 'primary'
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submittingRef.current) return

    const trimmedName = name.trim()
    if (!trimmedName) return

    const normalizedName = normalizeExerciseName(trimmedName)
    const isDuplicate = exercises.some(
      (exercise) => normalizeExerciseName(exercise.name) === normalizedName
    )
    if (isDuplicate) {
      onError('That exercise already exists.')
      return
    }

    submittingRef.current = true
    onError('')
    setSubmitting(true)

    const { data: inserted, error } = await supabase
      .from('exercises')
      .insert({ name: trimmedName })
      .select('id')
      .single()

    if (error) {
      onError(error.message)
      submittingRef.current = false
      setSubmitting(false)
      return
    }

    const muscleRows = Object.entries(selected).map(([muscle, role]) => ({
      exercise_id: inserted.id,
      muscle,
      role,
    }))

    if (muscleRows.length > 0) {
      const { error: muscleError } = await supabase.from('exercise_muscles').insert(muscleRows)
      if (muscleError) {
        onError(muscleError.message)
        submittingRef.current = false
        setSubmitting(false)
        return
      }
    }

    await addToCatalogIfMissing(trimmedName, normalizedName, muscleRows)

    submittingRef.current = false
    setSubmitting(false)
    setName('')
    setSelected({})
    setDropdownOpen(false)
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setDropdownOpen(true)
            }}
            onFocus={() => {
              ensureCatalogLoaded()
              setDropdownOpen(true)
            }}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            placeholder="Search or add an exercise"
            autoComplete="off"
            className="w-full min-w-0 rounded-md border border-line bg-surface-2 px-3 py-2 font-body text-sm text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
          />
          {dropdownOpen && suggestions.length > 0 && (
            <ul className="absolute top-full left-0 z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-line bg-surface-2 shadow-lg">
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(item)}
                    className="block w-full truncate px-3 py-2 text-left text-sm text-chalk hover:bg-surface"
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="shrink-0 rounded-md bg-blue-500 px-3 py-2 font-body text-sm font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
        >
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>

      {muscleGroups.length > 0 && showMuscleGroups && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-chalk-dim">
            Muscle groups worked — tap to mark primary, tap again for secondary
          </p>
          <div className="flex flex-wrap gap-1.5">
            {muscleGroups.map((muscle) => {
              const role = selected[muscle.name]
              return (
                <button
                  key={muscle.name}
                  type="button"
                  onClick={() => cycleMuscle(muscle.name)}
                  className={
                    role === 'primary'
                      ? 'rounded-full border border-blue-500 bg-blue-500 px-2.5 py-1 font-mono text-[11px] tracking-wide text-onblue uppercase'
                      : role === 'secondary'
                        ? 'rounded-full border border-blue-500/50 bg-blue-500/15 px-2.5 py-1 font-mono text-[11px] tracking-wide text-blue-300 uppercase'
                        : 'rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-chalk-dim uppercase'
                  }
                >
                  {muscle.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </form>
  )
}

export default AddExerciseForm
