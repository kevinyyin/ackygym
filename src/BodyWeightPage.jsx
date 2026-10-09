import Card from './Card'
import { formatDate } from './dateUtils'
import { toDisplayWeight, toStorageWeightKg } from './weightUnits'
import CalorieCalculator from './CalorieCalculator'
import { calculateCalorieTargets, inToCm, loadStoredProfile } from './calorieMath'
import MuscleVolume from './MuscleVolume'
import CalorieTracker from './CalorieTracker'
import HistoryLogSection from './HistoryLogSection'
import { useCachedState } from './pageCache'

function BodyWeightPage({ profiles, userId, onError, showCalorieTracker, showCalorieTracking, weightUnit: unit }) {
  const [entries, setEntries] = useCachedState('bodyWeight:entries', [])
  const [entriesLoaded, setEntriesLoaded] = useCachedState('bodyWeight:entriesLoaded', false)

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

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <p className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase">Body weight</p>
        <p className="mt-3 font-mono text-5xl font-bold text-blue-400">
          {latestOwnEntry ? `${toDisplayWeight(latestOwnEntry.weight_kg, unit)}` : '—'}
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

      <HistoryLogSection
        profiles={profiles}
        userId={userId}
        onError={onError}
        tableName="body_weights"
        valueColumn="weight_kg"
        logLabel="Log today's weight"
        placeholder={`Weight (${unit})`}
        inputProps={{ min: 0, step: 0.1 }}
        parseInput={(v) => toStorageWeightKg(v, unit)}
        formatValue={(raw) => toDisplayWeight(raw, unit)}
        unitSuffix={unit}
        emptyLogMessage="No body weight logged yet."
        onEntriesChange={(data) => {
          setEntries(data)
          setEntriesLoaded(true)
        }}
        chartLabel="Weight"
      />

      {showCalorieTracker && (
        <CalorieCalculator userId={userId} latestWeightKg={latestOwnEntry?.weight_kg} unit={unit} />
      )}

      {showCalorieTracking && (
        <CalorieTracker profiles={profiles} userId={userId} target={calorieTarget} onError={onError} />
      )}
    </div>
  )
}

export default BodyWeightPage
