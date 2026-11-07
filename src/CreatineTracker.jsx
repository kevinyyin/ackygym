import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { displayName } from './displayName'
import { getTodayDateString } from './dateUtils'
import { CheckIcon } from './icons'
import { useCachedState } from './pageCache'

// One row per user per day in creatine_logs means "took it today".
function CreatineTracker({ session, profiles, onError }) {
  // Date-scoped and fixed per mount, like Home's today's sets.
  const [today] = useState(getTodayDateString)
  const [takenUserIds, setTakenUserIds] = useCachedState(`creatine:taken:${today}`, new Set())
  const [refreshKey, setRefreshKey] = useState(0)
  // A second tap while the first save is in flight is ignored, so an insert
  // and a delete can never land out of order.
  const savingRef = useRef(false)

  useEffect(() => {
    async function fetchLogs() {
      const { data, error } = await supabase
        .from('creatine_logs')
        .select('user_id')
        .eq('date', today)

      if (error) {
        onError(error.message)
        return
      }
      setTakenUserIds(new Set(data.map((log) => log.user_id)))
    }

    fetchLogs()
  }, [refreshKey, today, onError, setTakenUserIds])

  const taken = takenUserIds.has(session.user.id)

  // The check flips at once; a failed save reports and refetches the real state.
  async function handleToggle() {
    if (savingRef.current) return
    savingRef.current = true
    onError('')
    const userId = session.user.id
    setTakenUserIds((current) => {
      const next = new Set(current)
      if (taken) next.delete(userId)
      else next.add(userId)
      return next
    })
    const { error } = taken
      ? await supabase.from('creatine_logs').delete().eq('user_id', userId).eq('date', today)
      : await supabase.from('creatine_logs').insert({ user_id: userId, date: today })
    savingRef.current = false

    if (error) {
      onError(error.message)
      setRefreshKey((k) => k + 1)
    }
  }

  const others = profiles
    .filter((p) => p.id !== session.user.id)
    .map((p) => ({ name: displayName(p), taken: takenUserIds.has(p.id) }))
  // One line under the label: the household's status, or yours when you're alone.
  const othersLine =
    others.length === 0
      ? taken
        ? 'Taken today'
        : 'Not yet today'
      : others.length === 1
        ? `${others[0].name}: ${others[0].taken ? 'taken' : 'not yet'}`
        : `${others.filter((o) => o.taken).length} of ${others.length} others taken`

  // A compact tile beside Water on Today: the whole tile is the checkbox.
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={taken}
      onClick={handleToggle}
      className="flex min-h-16 items-center justify-between gap-3 rounded-field bg-surface px-4 py-3 text-left active:bg-surface-2"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-medium text-chalk">Creatine</span>
        <span className="truncate text-caption text-chalk-dim">{othersLine}</span>
      </span>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          taken ? 'border-blue-500 bg-blue-500 text-onblue' : 'border-line text-transparent'
        }`}
      >
        <CheckIcon className="h-4 w-4" />
      </span>
    </button>
  )
}

export default CreatineTracker
