import { useState } from 'react'
import { supabase } from './supabaseClient'

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleSignIn(e) {
    e.preventDefault()
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setMessage('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(error.message)
    } else if (!data.session) {
      setMessage('Check your email to confirm your account.')
    }
  }

  const inputClasses =
    'w-full rounded-2xl border border-neutral-800 bg-neutral-800/60 px-4 py-3 text-base text-white placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none'

  return (
    <div className="flex min-h-svh flex-col justify-center bg-neutral-950 p-4">
      <form className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-3xl bg-neutral-900 p-6">
        <h1 className="mb-1 text-2xl font-bold text-white">Gym Tracker</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={inputClasses}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className={inputClasses}
        />
        <button
          type="submit"
          onClick={handleSignIn}
          className="w-full rounded-2xl bg-blue-500 px-4 py-3 text-base font-semibold text-white active:bg-blue-600"
        >
          Sign in
        </button>
        <button
          type="submit"
          onClick={handleSignUp}
          className="w-full rounded-2xl border border-neutral-700 px-4 py-3 text-base font-semibold text-neutral-200 active:bg-neutral-800"
        >
          Sign up
        </button>
        {message && <p className="text-sm text-neutral-400">{message}</p>}
      </form>
    </div>
  )
}

export default Auth
