import { useState } from 'react'
import { supabase } from './supabaseClient'
import { displayName } from './displayName'

function UsernameField({ profile, userId, onSaved, onError }) {
  const [value, setValue] = useState(profile?.username ?? '')

  async function handleBlur() {
    const trimmed = value.trim()
    if (trimmed === (profile?.username ?? '')) return

    onError('')
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed || null })
      .eq('id', userId)

    if (error) {
      onError(
        error.code === '23505' ? 'That username is already taken.' : error.message
      )
      setValue(profile?.username ?? '')
      return
    }
    onSaved()
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder={profile ? displayName(profile) : 'Set a username'}
      className="w-full truncate bg-transparent text-xs text-neutral-500 placeholder:text-neutral-500 focus:text-neutral-300 focus:outline-none"
    />
  )
}

export default UsernameField
