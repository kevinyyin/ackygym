import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'

function App() {
  const [session, setSession] = useState(null)
  const [exercises, setExercises] = useState([])

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
        console.error(error)
        return
      }
      setExercises(data)
    }

    fetchExercises()
  }, [session])

  if (!session) {
    return <Auth />
  }

  return (
    <>
      <p>{session.user.email}</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      <ul>
        {exercises.map((exercise) => (
          <li key={exercise.id}>{exercise.name}</li>
        ))}
      </ul>
    </>
  )
}

export default App
