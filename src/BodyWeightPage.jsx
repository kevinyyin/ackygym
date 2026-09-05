import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Card, { SectionLabel } from './Card'
import { groupByUser } from './groupByUser'
import { getTodayDateString, formatDate } from './dateUtils'
import { convertWeight, roundWeight } from './weightUnits'
import CalorieCalculator from './CalorieCalculator'
import { calculateCalorieTargets, inToCm, loadStoredProfile } from './calorieMath'
import MuscleVolume from './MuscleVolume'
import WeightHistoryModal from './WeightHistoryModal'
import CalorieTracker from './CalorieTracker'
import ConfirmDeleteButton from './ConfirmDeleteButton'

const UNIT_STORAGE_KEY = 'gym-tracker:body-weight-unit'

function getStoredUnit() {
  const stored = localStorage.getItem(UNIT_STORAGE_KEY)
  return stored === 'lb' ? 'lb' : 'kg'
}

function BodyWeightPage({ profiles, userId, onError, showCalorieTracker, showCalorieTracking }) {
  const [unit, setUnit] = useState(getStoredUnit)
  const [entries, setEntries] = useState([])
  const [entriesLoaded, setEntriesLoaded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [chartGroup, setChartGroup] = useState(null)

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
      setEntriesLoaded(true)
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
    if (!numeric || numeric <= 0) return
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

  const groupedEntries = groupByUser(entries, profiles, userId, 'entries')

  const latestOwnEntry = entries.find((entry) => entry.user_id === userId)

  let calorieTarget = null
  if (latestOwnEntry) {
    const stored = loadStoredProfile(userId)
    const storedHeightUnit = stored.heightUnit ?? (unit === 'kg' ? 'cm' : 'in')
    const heightCm = stored.height
      ? storedHeightUnit === 'cm'
        ? Number(stored.height)
        : inToCm(Number(stored.height))
      : NaN
    const ageNum = Number(stored.age)
    if (heightCm > 0 && ageNum > 0) {
      calorieTarget = calculateCalorieTargets({
        weightKg: latestOwnEntry.weight_kg,
        heightCm,
        age: ageNum,
        sex: stored.sex ?? 'female',
        activityLevel: stored.activityLevel ?? 'sedentary',
        goal: stored.goal ?? 'maintain',
      }).target
    }
  }

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
          {!entriesLoaded
            ? 'Loading…'
            : latestOwnEntry
              ? formatDate(latestOwnEntry.date, { year: true })
              : 'Nothing logged yet'}
        </p>
      </Card>

      <MuscleVolume userId={userId} onError={onError} />

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

      {showCalorieTracker && (
        <CalorieCalculator userId={userId} latestWeightKg={latestOwnEntry?.weight_kg} unit={unit} />
      )}

      {showCalorieTracking && (
        <CalorieTracker profiles={profiles} userId={userId} target={calorieTarget} onError={onError} />
      )}

      <div className="flex flex-col gap-3">
        <SectionLabel>History</SectionLabel>
        {!entriesLoaded ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">Loading…</p>
          </Card>
        ) : groupedEntries.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">No body weight logged yet.</p>
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
                        {roundWeight(convertWeight(entry.weight_kg, 'kg', unit))} {unit}
                      </span>
                      {entry.user_id === userId && (
                        <ConfirmDeleteButton
                          onConfirm={() => handleDelete(entry.id)}
                          label={`${formatDate(entry.date, { year: true })} weight entry`}
                          className="shrink-0"
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>

      <WeightHistoryModal group={chartGroup} unit={unit} onClose={() => setChartGroup(null)} />
    </div>
  )
}

export default BodyWeightPage
