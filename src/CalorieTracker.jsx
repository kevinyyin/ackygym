import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Card, { SectionLabel } from './Card'
import { groupByUser } from './groupByUser'
import { getTodayDateString, formatDate } from './dateUtils'
import { FlameIcon } from './icons'
import CalorieHistoryModal from './CalorieHistoryModal'

function CalorieTracker({ profiles, userId, target, onError }) {
  const [entries, setEntries] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [chartGroup, setChartGroup] = useState(null)

  useEffect(() => {
    async function fetchEntries() {
      const { data, error } = await supabase
        .from('calorie_logs')
        .select('id, user_id, date, calories')
        .order('date', { ascending: false })

      if (error) {
        onError(error.message)
        return
      }
      setEntries(data)
    }

    fetchEntries()
  }, [refreshKey, onError])

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')

    const numeric = Number(inputValue)
    if (!numeric || numeric <= 0) return

    const { error } = await supabase.from('calorie_logs').upsert(
      { user_id: userId, date: getTodayDateString(), calories: numeric },
      { onConflict: 'user_id,date' }
    )

    if (error) {
      onError(error.message)
      return
    }

    setInputValue('')
    setRefreshKey((k) => k + 1)
  }

  async function handleDelete(entryId) {
    onError('')
    const { error } = await supabase.from('calorie_logs').delete().eq('id', entryId)
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((k) => k + 1)
  }

  const groupedEntries = groupByUser(entries, profiles, userId, 'entries')

  const latestOwnEntry = entries.find((entry) => entry.user_id === userId)

  const inputClasses =
    'w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none'

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
            <FlameIcon className="h-4 w-4 text-blue-400" />
            Calories today
          </p>
        </div>
        <p className="mt-3 font-mono text-5xl font-bold text-blue-400">
          {latestOwnEntry ? Math.round(Number(latestOwnEntry.calories)) : '—'}
          <span className="ml-2 font-body text-lg font-normal text-chalk-dim">
            {target ? `/ ${target} kcal` : 'kcal'}
          </span>
        </p>
        <p className="mt-1 text-xs text-chalk-dim">
          {latestOwnEntry ? formatDate(latestOwnEntry.date, { year: true }) : 'Nothing logged yet'}
        </p>
      </Card>

      <Card className="p-4">
        <SectionLabel>Log today&apos;s calories</SectionLabel>
        <form onSubmit={handleSubmit} className="mt-3 flex gap-3">
          <input
            type="number"
            step="1"
            min="1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Calories (kcal)"
            required
            className={inputClasses}
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-blue-500 px-4 py-3 font-body text-base font-bold text-onblue active:bg-blue-600"
          >
            Log
          </button>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        <SectionLabel>History</SectionLabel>
        {groupedEntries.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">No calories logged yet.</p>
          </Card>
        ) : (
          groupedEntries.map((group) => (
            <Card key={group.userId} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setChartGroup(group)}
                className="w-full border-b border-line px-4 py-2 text-left font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
              >
                {group.name}
              </button>
              <ul className="divide-y divide-line">
                {group.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 px-4 py-3"
                  >
                    <span className="font-mono text-sm text-chalk-dim">
                      {formatDate(entry.date, { year: true })}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono font-medium text-chalk">
                        {Math.round(Number(entry.calories))} kcal
                      </span>
                      {entry.user_id === userId && (
                        <button
                          onClick={() => handleDelete(entry.id)}
                          aria-label={`Delete ${formatDate(entry.date, { year: true })} calorie entry`}
                          className="shrink-0 text-chalk-dim hover:text-danger"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>

      <CalorieHistoryModal
        group={chartGroup}
        target={chartGroup?.userId === userId ? target : null}
        onClose={() => setChartGroup(null)}
      />
    </div>
  )
}

export default CalorieTracker
