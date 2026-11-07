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
          className="-my-2 ml-auto h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-blue-400 active:text-blue-300"
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
        className="h-11 w-full min-w-0 rounded-field bg-surface-2 px-4 text-base text-chalk focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={saving || !draft.trim()}
        className="h-11 shrink-0 rounded-full bg-blue-500 px-5 text-[15px] font-semibold text-onblue active:bg-blue-600 disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => setDraft(null)}
        className="h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-chalk-dim active:text-chalk"
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

          <section className="mt-6">
            <h3 className="text-headline">Progression</h3>
            <ExerciseProgression
              exerciseId={exercise.id}
              userId={userId}
              weightUnit={weightUnit}
              onError={onError}
              onChanged={onChanged}
            />
          </section>

          <section className="mt-8">
            <h3 className="text-headline">Muscles worked</h3>
            <div className="mt-3">
              <MuscleBodyMap muscles={exercise.exercise_muscles} />
            </div>
          </section>

          <Button variant="destructive" className="mt-8" onClick={() => onDelete(exercise)}>
            Delete exercise
          </Button>
        </>
      )}
    </Sheet>
  )
}

export default ExerciseDetailModal
