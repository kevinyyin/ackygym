import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Card from './Card'
import { displayName } from './displayName'
import { getTodayDateString } from './dateUtils'
import { convertWeight, roundWeight } from './weightUnits'

const UNIT_STORAGE_KEY = 'gym-tracker:body-weight-unit'

function getStoredUnit() {
  const stored = localStorage.getItem(UNIT_STORAGE_KEY)
  return stored === 'lb' ? 'lb' : 'kg'
}

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function BodyWeightPage({ profiles, userId, onError }) {
  const [unit, setUnit] = useState(getStoredUnit)
  const [entries, setEntries] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function fetchEntries() {
      const { data, error } = await supabase
        .from('body_weights')
        .select('id, user_id, date, weight_kg')
        .order('date', { ascending: false })

      if (error) {
        onError(error.message)
        return
      }
      setEntries(data)
    }

    fetchEntries()
  }, [refreshKey, onError])

  function handleUnitChange(newUnit) {
    if (newUnit === unit) return

    setInputValue((prev) => {
      if (prev === '') return prev
      const numeric = Number(prev)
      if (Number.isNaN(numeric)) return prev
      return String(roundWeight(convertWeight(numeric, unit, newUnit)))
    })
    setUnit(newUnit)
    localStorage.setItem(UNIT_STORAGE_KEY, newUnit)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    onError('')

    const numeric = Number(inputValue)
    const weightKg = unit === 'kg' ? numeric : convertWeight(numeric, 'lb', 'kg')

    const { error } = await supabase.from('body_weights').upsert(
      { user_id: userId, date: getTodayDateString(), weight_kg: weightKg },
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
    const { error } = await supabase.from('body_weights').delete().eq('id', entryId)
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((k) => k + 1)
  }

  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p]))

  const entriesByUserId = new Map()
  for (const entry of entries) {
    if (!entriesByUserId.has(entry.user_id)) entriesByUserId.set(entry.user_id, [])
    entriesByUserId.get(entry.user_id).push(entry)
  }

  const groupedEntries = [...entriesByUserId.entries()]
    .map(([entryUserId, userEntries]) => ({
      userId: entryUserId,
      name: profileByUserId[entryUserId] ? displayName(profileByUserId[entryUserId]) : entryUserId,
      entries: userEntries,
    }))
    .sort((a, b) => {
      if (a.userId === userId) return -1
      if (b.userId === userId) return 1
      return a.name.localeCompare(b.name)
    })

  const latestOwnEntry = entries.find((entry) => entry.user_id === userId)

  const inputClasses =
    'w-full rounded-2xl border border-neutral-800 bg-neutral-800/60 px-4 py-3 text-base text-white placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none'

  const unitToggle = (
    <div className="inline-flex rounded-full bg-neutral-800 p-0.5">
      {['kg', 'lb'].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => handleUnitChange(option)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            unit === option ? 'bg-blue-500 text-white' : 'text-neutral-400'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">Body weight</p>
          {unitToggle}
        </div>
        <p className="mt-3 text-4xl font-bold text-white">
          {latestOwnEntry
            ? `${roundWeight(convertWeight(latestOwnEntry.weight_kg, 'kg', unit))} ${unit}`
            : '—'}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {latestOwnEntry ? formatDate(latestOwnEntry.date) : 'Nothing logged yet'}
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-neutral-300">Log today&apos;s weight</h2>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="number"
            step="0.1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Weight (${unit})`}
            required
            className={inputClasses}
          />
          <button
            type="submit"
            className="shrink-0 rounded-2xl bg-blue-500 px-4 py-3 text-base font-semibold text-white active:bg-blue-600"
          >
            Log
          </button>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-semibold text-neutral-300">History</h2>
        {groupedEntries.length === 0 ? (
          <Card className="p-5">
            <p className="text-sm text-neutral-500">No body weight logged yet.</p>
          </Card>
        ) : (
          groupedEntries.map((group) => (
            <Card key={group.userId} className="overflow-hidden">
              <h3 className="px-5 pt-4 text-xs text-neutral-500">{group.name}</h3>
              <ul className="mt-2 divide-y divide-neutral-800">
                {group.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 px-5 py-3"
                  >
                    <span className="text-sm text-neutral-400">{formatDate(entry.date)}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium text-white">
                        {roundWeight(convertWeight(entry.weight_kg, 'kg', unit))} {unit}
                      </span>
                      {entry.user_id === userId && (
                        <button
                          onClick={() => handleDelete(entry.id)}
                          aria-label={`Delete ${formatDate(entry.date)} weight entry`}
                          className="shrink-0 text-neutral-500 hover:text-red-400"
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
    </div>
  )
}

export default BodyWeightPage
