import Sheet from './Sheet'
import MuscleTags from './MuscleTags'
import MuscleBodyMap from './MuscleBodyMap'
import ExerciseProgression from './ExerciseProgression'

function ExerciseDetailModal({ exercise, userId, weightUnit, onClose, onError, onChanged }) {
  return (
    <Sheet open={!!exercise} onClose={onClose} title={exercise?.name} size="large">
      {exercise && (
        <>
          <MuscleTags muscles={exercise.exercise_muscles} />

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
        </>
      )}
    </Sheet>
  )
}

export default ExerciseDetailModal
