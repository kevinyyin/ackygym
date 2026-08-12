import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Card from './Card'
import { displayName } from './displayName'
import { getTodayDateString } from './dateUtils'
import { convertWeight, roundWeight } from './weightUnits'
import CalorieCalculator from './CalorieCalculator'

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

function SectionLabel({ children }) {
  return (
    <h2 className="flex items-center gap-2 px-1 text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
      <span className="h-2.5 w-0.5 bg-blue-500" />
      {children}
    </h2>
  )
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
    'w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none'

  const unitToggle = (
    <div className="inline-flex rounded-full border border-line bg-surface-2 p-0.5">
      {['kg', 'lb'].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => handleUnitChange(option)}
          className={`rounded-full px-3 py-1 font-mono text-xs font-semibold ${
            unit === option ? 'bg-blue-500 text-onblue' : 'text-chalk-dim'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
            Body weight
          </p>
          {unitToggle}
        </div>
        <p className="mt-3 font-mono text-5xl font-bold text-blue-400">
          {latestOwnEntry
            ? `${roundWeight(convertWeight(latestOwnEntry.weight_kg, 'kg', unit))}`
            : '—'}
          <span className="ml-2 font-body text-lg font-normal text-chalk-dim">{unit}</span>
        </p>
        <p className="mt-1 text-xs text-chalk-dim">
          {latestOwnEntry ? formatDate(latestOwnEntry.date) : 'Nothing logged yet'}
        </p>
      </Card>

      <Card className="p-4">
        <SectionLabel>Log today&apos;s weight</SectionLabel>
        <form onSubmit={handleSubmit} className="mt-3 flex gap-3">
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
            className="shrink-0 rounded-md bg-blue-500 px-4 py-3 font-body text-base font-bold text-onblue active:bg-blue-600"
          >
            Log
          </button>
        </form>
      </Card>

      <CalorieCalculator latestWeightKg={latestOwnEntry?.weight_kg} unit={unit} />

      <div className="flex flex-col gap-3">
        <SectionLabel>History</SectionLabel>
        {groupedEntries.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">No body weight logged yet.</p>
          </Card>
        ) : (
          groupedEntries.map((group) => (
            <Card key={group.userId} className="overflow-hidden">
              <h3 className="border-b border-line px-4 py-2 font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
                {group.name}
              </h3>
              <ul className="divide-y divide-line">
                {group.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 px-4 py-3"
                  >
                    <span className="font-mono text-sm text-chalk-dim">
                      {formatDate(entry.date)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono font-medium text-chalk">
                        {roundWeight(convertWeight(entry.weight_kg, 'kg', unit))} {unit}
                      </span>
                      {entry.user_id === userId && (
                        <button
                          onClick={() => handleDelete(entry.id)}
                          aria-label={`Delete ${formatDate(entry.date)} weight entry`}
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
    </div>
  )
}

export default BodyWeightPage
