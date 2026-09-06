import { useState } from 'react'
import { supabase } from './supabaseClient'

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingAction, setPendingAction] = useState(null)

  async function handleSignIn(e) {
    e.preventDefault()
    if (pendingAction) return
    setMessage('')
    setPendingAction('signin')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPendingAction(null)
    if (error) setMessage(error.message)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    if (pendingAction) return
    setMessage('')
    setPendingAction('signup')
    const { data, error } = await supabase.auth.signUp({ email, password })
    setPendingAction(null)
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
      <form className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-lg border border-line bg-surface p-6 shadow-[inset_0_1px_0_var(--card-highlight),0_10px_28px_-16px_var(--shadow-tint)]">
        <p className="mb-1 text-[11px] font-semibold tracking-[0.3em] text-blue-400 uppercase">
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
          autoComplete="email"
          className={inputClasses}
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className={`${inputClasses} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <button
          type="submit"
          onClick={handleSignIn}
          disabled={!!pendingAction}
          className="w-full rounded-md bg-blue-500 px-4 py-3 font-body text-base font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
        >
          {pendingAction === 'signin' ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          type="submit"
          onClick={handleSignUp}
          disabled={!!pendingAction}
          className="w-full rounded-md border border-line px-4 py-3 font-body text-base font-semibold text-chalk-dim active:border-blue-500 active:text-blue-400 disabled:opacity-40"
        >
          {pendingAction === 'signup' ? 'Creating account…' : 'Sign up'}
        </button>
        {message && <p className="text-sm text-chalk-dim">{message}</p>}
      </form>
    </div>
  )
}

export default Auth
