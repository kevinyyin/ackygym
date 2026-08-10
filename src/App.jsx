import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import WorkoutForm from './WorkoutForm'

function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function App() {
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])
  const [todaysSets, setTodaysSets] = useState([])
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    async function fetchExercises() {
      const { data, error } = await supabase.from('exercises').select('*')
      if (error) {
        setError(error.message)
        return
      }
      setExercises(data)
    }

    fetchExercises()
  }, [session])

  useEffect(() => {
    if (!session) return

    async function fetchTodaysSets() {
      const { data, error } = await supabase
        .from('sets')
        .select('id, weight, reps, exercises (name), workouts!inner (date)')
        .eq('workouts.date', getTodayDateString())
        .order('id')

      if (error) {
        setError(error.message)
        return
      }
      setTodaysSets(data)
    }

    fetchTodaysSets()
  }, [session, refreshKey])

  if (!session) {
    return <Auth />
  }

  return (
    <>
      <p>{session.user.email}</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>

      {error && <p>{error}</p>}

      <WorkoutForm
        exercises={exercises}
        userId={session.user.id}
        onLogged={() => setRefreshKey((key) => key + 1)}
        onError={setError}
      />

      <h2>Today&apos;s sets</h2>
      <ul>
        {todaysSets.map((set) => (
          <li key={set.id}>
            {set.exercises.name}: {set.weight} x {set.reps}
          </li>
        ))}
      </ul>

      <h2>Exercises</h2>
      <ul>
        {exercises.map((exercise) => (
          <li key={exercise.id}>{exercise.name}</li>
        ))}
      </ul>
    </>
  )
}

export default App
