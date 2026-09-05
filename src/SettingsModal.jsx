import { useState } from 'react'
import Card from './Card'
import { supabase } from './supabaseClient'
import { TOGGLEABLE_CARDS } from './cardVisibility'

function SettingsModal({ open, visibility, onToggle, onClose, profile, userId, onProfileSaved, onError }) {
  const [username, setUsername] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState('')
  const [wasOpen, setWasOpen] = useState(open)

  // Re-seed the input from the current username each time the modal opens
  // (state adjustment during render, per React's guidance — not an effect —
  // since this component stays mounted and just returns null while closed).
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setUsername(profile?.username ?? '')
      setUsernameStatus('')
    }
  }

  if (!open) return null

  async function handleSaveUsername() {
    const trimmed = username.trim()
    if (!trimmed || trimmed === (profile?.username ?? '')) {
      setUsernameStatus('No changes to save.')
      return
    }

    onError('')
    setUsernameStatus('')
    setSavingUsername(true)
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', userId)
    setSavingUsername(false)

    if (error) {
      onError(error.code === '23505' ? 'That username is already taken.' : error.message)
      return
    }
    setUsernameStatus('Saved.')
    onProfileSaved()
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-none tracking-tight text-chalk uppercase">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-chalk-dim hover:text-danger"
          >
            ✕
          </button>
        </div>

        <p className="mt-4 text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
          Username
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setUsernameStatus('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
            placeholder="Set a username"
            className="w-full min-w-0 rounded-md border border-line bg-surface-2 px-3 py-2 font-body text-sm text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSaveUsername}
            disabled={savingUsername}
            className="shrink-0 rounded-md bg-blue-500 px-3 py-2 font-body text-sm font-bold text-onblue active:bg-blue-600 disabled:opacity-50"
          >
            {savingUsername ? 'Saving…' : 'Save'}
          </button>
        </div>
        {usernameStatus && <p className="mt-1.5 text-xs text-chalk-dim">{usernameStatus}</p>}

        <p className="mt-5 text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
          Visible cards
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {TOGGLEABLE_CARDS.map((card) => (
            <label
              key={card.key}
              className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-4 py-3"
            >
              <span className="text-sm text-chalk">{card.label}</span>
              <input
                type="checkbox"
                checked={visibility[card.key]}
                onChange={() => onToggle(card.key)}
                className="h-5 w-5 accent-blue-500"
              />
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default SettingsModal
