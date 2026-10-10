import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from './Card'
import Routines from './Routines'
import { useCachedState } from './pageCache'
import { fetchExercises, fetchRoutines } from './library'

// Routine management, split out of Home so that page can stay focused on
// today's status/logging. The exercise library itself lives on the
// Exercises segment (LiftsPage).
function RoutinesPage({ session, profiles, schedule, onScheduleSaved, onError, onActiveRoutineChange }) {
  const navigate = useNavigate()
  const [exercises, setExercises] = useCachedState('routinesPage:exercises', [])
  const [routines, setRoutines] = useCachedState('routinesPage:routines', [])
  const [routinesLoaded, setRoutinesLoaded] = useCachedState('routinesPage:routinesLoaded', false)
  const [routinesVersion, setRoutinesVersion] = useState(0)

  useEffect(() => {
    async function loadExercises() {
      const { data, error } = await fetchExercises()
      if (error) {
        onError(error.message)
        return
      }
      setExercises(data)
    }

    loadExercises()
  }, [onError, setExercises])

  useEffect(() => {
    async function loadRoutines() {
      const { data, error } = await fetchRoutines()
      if (error) {
        onError(error.message)
        return
      }
      setRoutines(data)
      setRoutinesLoaded(true)
    }

    loadRoutines()
  }, [routinesVersion, onError, setRoutines, setRoutinesLoaded])

  function handleStart(routine) {
    onActiveRoutineChange(routine)
    navigate('/')
  }

  return (
    <Card className="p-4">
      <h2 className="text-headline text-chalk">Routines</h2>
      <Routines
        routines={routines}
        loaded={routinesLoaded}
        exercises={exercises}
        profiles={profiles}
        schedule={schedule}
        userId={session.user.id}
        onRoutinesChanged={() => {
          setRoutinesVersion((v) => v + 1)
          // App's schedule embeds routine names, so a rename/delete refreshes it too.
          onScheduleSaved()
        }}
        onScheduleChanged={onScheduleSaved}
        onStart={handleStart}
        onError={onError}
      />
    </Card>
  )
}

export default RoutinesPage
