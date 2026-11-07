import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import Card from './Card'
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
    .map((p) => ({ id: p.id, name: displayName(p), taken: takenUserIds.has(p.id) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Card className="p-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={taken}
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-headline text-chalk">Creatine</h2>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
            taken ? 'border-blue-500 bg-blue-500 text-onblue' : 'border-line text-transparent'
          }`}
        >
          <CheckIcon className="h-4 w-4" />
        </span>
      </button>

      {others.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {others.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-2">
              <span className="text-sm text-chalk-dim">{entry.name}</span>
              <span className={`text-sm ${entry.taken ? 'text-blue-400' : 'text-chalk-dim'}`}>
                {entry.taken ? 'Taken' : 'Not yet'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default CreatineTracker
