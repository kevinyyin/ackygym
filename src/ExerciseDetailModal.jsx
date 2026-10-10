import { useState } from 'react'
import Sheet from './Sheet'
import Button from './Button'
import MuscleTags from './MuscleTags'
import MuscleBodyMap from './MuscleBodyMap'
import ExerciseProgression from './ExerciseProgression'

// Keyed by exercise id, so an open rename never carries over to the next exercise.
function ExerciseHeader({ exercise, onRename }) {
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const saved = await onRename(exercise, draft)
    setSaving(false)
    if (saved) setDraft(null)
  }

  if (draft === null) {
    return (
      <div className="flex items-start gap-3">
        <MuscleTags muscles={exercise.exercise_muscles} />
        <button
          type="button"
          onClick={() => setDraft(exercise.name)}
          className="ml-auto shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
        >
          Rename
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Exercise name"
        className="w-full min-w-0 rounded-md border border-line bg-surface-2 px-3 py-2 font-body text-sm text-chalk focus:border-blue-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={saving || !draft.trim()}
        className="shrink-0 rounded-md bg-blue-500 px-3 py-2 font-body text-sm font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => setDraft(null)}
        className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
      >
        Cancel
      </button>
    </form>
  )
}

function ExerciseDetailModal({ exercise, userId, weightUnit, onClose, onError, onChanged, onRename, onDelete }) {
  return (
    <Sheet open={!!exercise} onClose={onClose} title={exercise?.name} size="large">
      {exercise && (
        <>
          <ExerciseHeader key={exercise.id} exercise={exercise} onRename={onRename} />

          <div className="mt-4">
            <MuscleBodyMap muscles={exercise.exercise_muscles} />
          </div>

          <div className="mt-8">
            <h3 className="text-headline">Progression</h3>
            <ExerciseProgression
              exerciseId={exercise.id}
              userId={userId}
              weightUnit={weightUnit}
              onError={onError}
              onChanged={onChanged}
            />
          </div>

          <Button variant="destructive" className="mt-8" onClick={() => onDelete(exercise)}>
            Delete exercise
          </Button>
        </>
      )}
    </Sheet>
  )
}

export default ExerciseDetailModal
