import { useEffect, useState } from 'react'
import Card from './Card'
import { convertWeight, roundWeight } from './weightUnits'
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

const GOALS = [
  { value: 'lose', label: 'Lose' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain' },
]

function CalorieCalculator({ userId, latestWeightKg, unit }) {
  const [expanded, setExpanded] = useState(false)
  const stored = loadStoredProfile(userId)

  const [height, setHeight] = useState(String(stored.height ?? ''))
  const [age, setAge] = useState(String(stored.age ?? ''))
  const [sex, setSex] = useState(stored.sex ?? 'female')
  const [activityLevel, setActivityLevel] = useState(stored.activityLevel ?? 'sedentary')
  const [goal, setGoal] = useState(stored.goal ?? 'maintain')
  const [weight, setWeight] = useState(() =>
    latestWeightKg ? String(roundWeight(convertWeight(latestWeightKg, 'kg', unit))) : ''
  )

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
      setWeight(String(roundWeight(convertWeight(latestWeightKg, 'kg', unit))))
    } else if (unitChanged && weight) {
      const n = Number(weight)
      if (!Number.isNaN(n)) setWeight(String(roundWeight(convertWeight(n, prevUnit, unit))))
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

  const weightKg = unit === 'kg' ? Number(weight) : convertWeight(Number(weight), 'lb', 'kg')
  const heightCm = heightUnit === 'cm' ? Number(height) : inToCm(Number(height))
  const ageNum = Number(age)

  const canCalculate = weightKg > 0 && heightCm > 0 && ageNum > 0
  const result = canCalculate
    ? calculateCalorieTargets({ weightKg, heightCm, age: ageNum, sex, activityLevel, goal })
    : null

  const inputClasses =
    'w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-body text-sm text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
          Calorie calculator
        </p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
        >
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="text-[11px] text-chalk-dim uppercase">Weight ({unit})</span>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={`mt-1 ${inputClasses}`}
              />
            </label>
            <label className="flex-1">
              <span className="text-[11px] text-chalk-dim uppercase">Height ({heightUnit})</span>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className={`mt-1 ${inputClasses}`}
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="text-[11px] text-chalk-dim uppercase">Age</span>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className={`mt-1 ${inputClasses}`}
              />
            </label>
            <div className="flex-1">
              <span className="text-[11px] text-chalk-dim uppercase">Sex</span>
              <div className="mt-1 inline-flex w-full rounded-md border border-line bg-surface-2 p-0.5">
                {['female', 'male'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSex(option)}
                    className={`flex-1 rounded px-2 py-1.5 font-mono text-xs font-semibold capitalize ${
                      sex === option ? 'bg-blue-500 text-onblue' : 'text-chalk-dim'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label>
            <span className="text-[11px] text-chalk-dim uppercase">Activity level</span>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              className={`mt-1 ${inputClasses}`}
            >
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label} — {level.hint}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-[11px] text-chalk-dim uppercase">Goal</span>
            <div className="mt-1 inline-flex w-full rounded-md border border-line bg-surface-2 p-0.5">
              {GOALS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGoal(option.value)}
                  className={`flex-1 rounded px-2 py-1.5 font-mono text-xs font-semibold ${
                    goal === option.value ? 'bg-blue-500 text-onblue' : 'text-chalk-dim'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {result ? (
            <div className="mt-1 flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-chalk-dim">BMR</span>
                <span className="font-mono text-sm text-chalk">{result.bmr} kcal/day</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-chalk-dim">Maintenance</span>
                <span className="font-mono text-sm text-chalk">{result.maintenance} kcal/day</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-chalk">Daily target</span>
                <span className="font-mono text-lg font-bold text-blue-400">
                  {result.target} kcal/day
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-chalk-dim">
              Enter your weight, height, and age to calculate.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

export default CalorieCalculator
