import Card from './Card'
import MuscleTags from './MuscleTags'
import MuscleBodyMap from './MuscleBodyMap'
import ExerciseProgression from './ExerciseProgression'
import { useEscapeToClose } from './useEscapeToClose'

function ExerciseDetailModal({ exercise, userId, onClose, onError, onChanged }) {
  useEscapeToClose(!!exercise, onClose)

  if (!exercise) return null

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <Card
        className="max-h-[85vh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-none tracking-tight text-chalk uppercase">
            {exercise.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-chalk-dim hover:text-danger"
          >
            ✕
          </button>
        </div>

        <div className="mt-3">
          <MuscleTags muscles={exercise.exercise_muscles} />
        </div>

        <div className="mt-4">
          <MuscleBodyMap muscles={exercise.exercise_muscles} />
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
            Progression
          </p>
          <ExerciseProgression
            exerciseId={exercise.id}
            userId={userId}
            onError={onError}
            onChanged={onChanged}
          />
        </div>
      </Card>
    </div>
  )
}

export default ExerciseDetailModal
