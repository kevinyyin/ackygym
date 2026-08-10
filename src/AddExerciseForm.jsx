import { useState } from 'react'
import { supabase } from './supabaseClient'

function AddExerciseForm({ exercises, onAdded, onError }) {
  const [name, setName] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')

    const trimmedName = name.trim()
    if (!trimmedName) return

    const isDuplicate = exercises.some(
      (exercise) => exercise.name.toLowerCase() === trimmedName.toLowerCase()
    )
    if (isDuplicate) {
      onError('That exercise already exists.')
      return
    }

    const { error } = await supabase.from('exercises').insert({ name: trimmedName })

    if (error) {
      onError(error.message)
      return
    }

    setName('')
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New exercise"
        className="w-full min-w-0 rounded-xl border border-neutral-800 bg-neutral-800/60 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none"
      />
      <button
        type="submit"
        className="shrink-0 rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white active:bg-blue-600"
      >
        Add
      </button>
    </form>
  )
}

export default AddExerciseForm
