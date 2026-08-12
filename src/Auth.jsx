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
    'w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none'

  return (
    <div className="flex min-h-svh flex-col justify-center bg-ink p-4">
      <form className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-lg border border-line bg-surface p-6">
        <p className="text-[11px] font-semibold tracking-[0.25em] text-blue-400 uppercase">
          Ackygym
        </p>
        <h1 className="mb-1 font-display text-4xl leading-none tracking-tight text-chalk uppercase">
          Sign in
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
          className="w-full rounded-md bg-blue-500 px-4 py-3 font-body text-base font-bold text-onblue active:bg-blue-600"
        >
          Sign in
        </button>
        <button
          type="submit"
          onClick={handleSignUp}
          className="w-full rounded-md border border-line px-4 py-3 font-body text-base font-semibold text-chalk-dim active:border-blue-500 active:text-blue-400"
        >
          Sign up
        </button>
        {message && <p className="text-sm text-chalk-dim">{message}</p>}
      </form>
    </div>
  )
}

export default Auth
