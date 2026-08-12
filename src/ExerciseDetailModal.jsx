import Card from './Card'
import MuscleTags from './MuscleTags'
import MuscleBodyMap from './MuscleBodyMap'

function ExerciseDetailModal({ exercise, onClose }) {
  if (!exercise) return null

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md p-5"
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
      </Card>
    </div>
  )
}

export default ExerciseDetailModal
