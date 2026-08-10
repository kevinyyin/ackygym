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
      className="w-full truncate bg-transparent font-mono text-xs text-chalk-dim placeholder:text-chalk-dim focus:text-blue-400 focus:outline-none"
    />
  )
}

export default UsernameField
