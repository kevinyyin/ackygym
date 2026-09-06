import { useState } from 'react'
import { supabase } from './supabaseClient'

function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingAction, setPendingAction] = useState(null)

  // A real form onSubmit (rather than onClick on the submit buttons) so the
  // browser's native required/type="email" constraint validation runs before
  // this ever fires — the previous onClick + preventDefault wiring skipped
  // that check entirely, letting malformed input reach Supabase and come
  // back as a misleading "Invalid login credentials".
  async function handleSubmit(e) {
    e.preventDefault()
    if (pendingAction) return
    const intent = e.nativeEvent.submitter?.value === 'signup' ? 'signup' : 'signin'

    setMessage('')
    setPendingAction(intent)

    if (intent === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      setPendingAction(null)
      if (error) {
        setMessage(error.message)
      } else if (!data.session) {
        setMessage('Check your email to confirm your account.')
      }
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPendingAction(null)
    if (error) setMessage(error.message)
  }

  const inputClasses =
    'w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none'

  return (
    <div className="flex min-h-svh flex-col justify-center bg-ink p-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-lg border border-line bg-surface p-6 shadow-[inset_0_1px_0_var(--card-highlight)]"
      >
        <p className="mb-1 text-[11px] font-semibold tracking-[0.3em] text-blue-400 uppercase">
          Ackygym
        </p>
        <h1 className="mb-1 font-display text-4xl leading-none tracking-tight text-chalk uppercase">
          Sign in
        </h1>
        <label htmlFor="auth-email" className="sr-only">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className={inputClasses}
        />
        <label htmlFor="auth-password" className="sr-only">
          Password
        </label>
        <div className="relative">
          <input
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
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
          name="intent"
          value="signin"
          disabled={!!pendingAction}
          className="w-full rounded-md bg-blue-500 px-4 py-3 font-body text-base font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
        >
          {pendingAction === 'signin' ? 'Signing in…' : 'Sign in'}
        </button>
        <button
          type="submit"
          name="intent"
          value="signup"
          disabled={!!pendingAction}
          className="w-full rounded-md border border-line px-4 py-3 font-body text-base font-semibold text-chalk-dim active:border-blue-500 active:text-blue-400 disabled:opacity-40"
        >
          {pendingAction === 'signup' ? 'Creating account…' : 'Sign up'}
        </button>
        {message && (
          <p role="alert" aria-live="assertive" className="text-sm text-chalk-dim">
            {message}
          </p>
        )}
      </form>
    </div>
  )
}

export default Auth
