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
    'w-full rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500'

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center p-4">
      <form className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Gym Tracker
        </h1>
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
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
        >
          Sign in
        </button>
        <button
          type="submit"
          onClick={handleSignUp}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base font-semibold text-neutral-700 active:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:active:bg-neutral-800"
        >
          Sign up
        </button>
        {message && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{message}</p>
        )}
      </form>
    </div>
  )
}

export default Auth
