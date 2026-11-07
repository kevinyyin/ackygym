import { useEffect, useState } from 'react'
import Card from './Card'
import SegmentedControl from './SegmentedControl'
import { toDisplayWeight, toStorageWeightKg, convertWeightInput } from './weightUnits'
import {
  calculateCalorieTargets,
  ACTIVITY_LEVELS,
  cmToIn,
  inToCm,
  getProfileStorageKey,
  loadStoredProfile,
} from './calorieMath'

function roundTenth(value) {
  return Math.round(value * 10) / 10
}

const GOAL_SEGMENTS = [
  { key: 'lose', label: 'Lose' },
  { key: 'maintain', label: 'Maintain' },
  { key: 'gain', label: 'Gain' },
]
const SEX_SEGMENTS = [
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
]

function CalorieCalculator({ userId, latestWeightKg, unit }) {
  const [expanded, setExpanded] = useState(false)
  const stored = loadStoredProfile(userId)

  const [height, setHeight] = useState(String(stored.height ?? ''))
  const [age, setAge] = useState(String(stored.age ?? ''))
  const [sex, setSex] = useState(stored.sex ?? 'female')
  const [activityLevel, setActivityLevel] = useState(stored.activityLevel ?? 'sedentary')
  const [goal, setGoal] = useState(stored.goal ?? 'maintain')
  const [weight, setWeight] = useState(() => (latestWeightKg ? String(toDisplayWeight(latestWeightKg, unit)) : ''))

  // Re-derive weight/height when the latest logged weight or the display
  // unit changes, without a setState-in-effect cascade — this is React's
  // recommended "adjust state during render" pattern for syncing local
  // state to props, rather than useEffect. Critically, a unit flip must
  // also convert the height field's *value* (not just its label) — cm and
  // in aren't interchangeable digits, so leaving the number as-is would
  // silently reinterpret it in the new unit.
  // Seed from the unit the stored height was actually saved under (not the
  // current `unit` prop) — otherwise a unit toggle that happened in a
  // previous session goes undetected on mount, and the stale height value
  // silently gets reinterpreted under the new unit without conversion.
  const [prevUnit, setPrevUnit] = useState(() =>
    stored.heightUnit ? (stored.heightUnit === 'cm' ? 'kg' : 'lb') : unit
  )
  const [prevWeightKg, setPrevWeightKg] = useState(latestWeightKg)

  if (prevUnit !== unit || prevWeightKg !== latestWeightKg) {
    const unitChanged = prevUnit !== unit
    setPrevUnit(unit)
    setPrevWeightKg(latestWeightKg)

    if (latestWeightKg) {
      setWeight(String(toDisplayWeight(latestWeightKg, unit)))
    } else if (unitChanged && weight) {
      setWeight(convertWeightInput(weight, prevUnit, unit))
    }

    if (unitChanged && height) {
      const n = Number(height)
      const wasCm = prevUnit === 'kg'
      const isCm = unit === 'kg'
      if (!Number.isNaN(n) && wasCm !== isCm) {
        setHeight(String(roundTenth(isCm ? inToCm(n) : cmToIn(n))))
      }
    }
  }

  useEffect(() => {
    localStorage.setItem(
      getProfileStorageKey(userId),
      JSON.stringify({ height, age, sex, activityLevel, goal, heightUnit: unit === 'kg' ? 'cm' : 'in' })
    )
  }, [userId, height, age, sex, activityLevel, goal, unit])

  const heightUnit = unit === 'kg' ? 'cm' : 'in'

  const weightKg = toStorageWeightKg(weight, unit)
  const heightCm = heightUnit === 'cm' ? Number(height) : inToCm(Number(height))
  const ageNum = Number(age)

  const canCalculate = weightKg > 0 && heightCm > 0 && ageNum > 0
  const result = canCalculate
    ? calculateCalorieTargets({ weightKg, heightCm, age: ageNum, sex, activityLevel, goal })
    : null

  const inputClasses =
    'h-11 w-full min-w-0 rounded-field bg-surface-2 px-4 text-base text-chalk placeholder:text-chalk-dim focus:ring-2 focus:ring-blue-500 focus:outline-none'
  const labelClasses = 'flex flex-1 flex-col gap-1.5 text-caption text-chalk-dim'

  return (
    <Card className="p-4">
      <div className="-my-1.5 flex items-center justify-between gap-2">
        <h2 className="text-headline text-chalk">Calorie calculator</h2>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="-mr-2 h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-blue-400 active:text-blue-300"
        >
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex gap-3">
            <label className={labelClasses}>
              Weight ({unit})
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputClasses}
              />
            </label>
            <label className={labelClasses}>
              Height ({heightUnit})
              <input
                type="number"
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className={inputClasses}
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className={labelClasses}>
              Age
              <input
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className={inputClasses}
              />
            </label>
            <div role="group" aria-label="Sex" className={labelClasses}>
              Sex
              <div className="flex h-11 flex-col justify-center">
                <SegmentedControl segments={SEX_SEGMENTS} value={sex} onChange={setSex} layoutId="seg-calc-sex" />
              </div>
            </div>
          </div>

          <label className={labelClasses}>
            Activity level
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              className={inputClasses}
            >
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} — {level.hint}
                </option>
              ))}
            </select>
          </label>

          <div role="group" aria-label="Goal" className={labelClasses}>
            Goal
            <SegmentedControl segments={GOAL_SEGMENTS} value={goal} onChange={setGoal} layoutId="seg-calc-goal" />
          </div>

          {result ? (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] text-chalk-dim">BMR</span>
                <span className="text-[15px] tabular-nums text-chalk">{result.bmr} kcal/day</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[15px] text-chalk-dim">Maintenance</span>
                <span className="text-[15px] tabular-nums text-chalk">{result.maintenance} kcal/day</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[17px] font-semibold text-chalk">Daily target</span>
                <span className="text-[17px] font-semibold tabular-nums text-blue-400">
                  {result.target} kcal/day
                </span>
              </div>
              <p className="mt-1 text-caption text-chalk-dim">
                BMR is what you'd burn at rest; maintenance adds your activity level on top; the
                target adjusts that for your goal.
              </p>
            </div>
          ) : (
            <p className="text-caption text-chalk-dim">
              Enter your weight, height, and age to calculate.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

export default CalorieCalculator
