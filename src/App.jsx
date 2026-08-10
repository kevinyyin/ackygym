import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [exercises, setExercises] = useState([])

  useEffect(() => {
    async function fetchExercises() {
      const { data, error } = await supabase.from('exercises').select('*')
      if (error) {
        console.error(error)
        return
      }
      setExercises(data)
    }

    fetchExercises()
  }, [])

  return (
    <ul>
      {exercises.map((exercise) => (
        <li key={exercise.id}>{exercise.name}</li>
      ))}
    </ul>
  )
}

export default App
