import { useState } from 'react'
import Card from './Card'
import {
  calculatePlates,
  STANDARD_PLATES_KG,
  STANDARD_BAR_KG,
  STANDARD_PLATES_LB,
  STANDARD_BAR_LB,
} from './plateCalculator'
import { convertWeight, roundWeight } from './weightUnits'
import { CloseIcon } from './icons'

const UNIT_STORAGE_KEY = 'gym-tracker:plate-calc-unit'

function getStoredUnit() {
  const stored = localStorage.getItem(UNIT_STORAGE_KEY)
  return stored === 'lb' ? 'lb' : 'kg'
}

function standardBarFor(unit) {
  return unit === 'kg' ? STANDARD_BAR_KG : STANDARD_BAR_LB
}

function plateSizeClass(weight) {
  if (weight >= 20) return 'h-24 w-3.5'
  if (weight >= 10) return 'h-20 w-3'
  if (weight >= 5) return 'h-16 w-2.5'
  return 'h-12 w-2'
}

function Plate({ weight }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <span className="font-mono text-[9px] text-chalk-dim">{weight}</span>
      <div className={`rounded-sm bg-blue-500 ${plateSizeClass(weight)}`} />
    </div>
  )
}

function PlateCalculatorModal({ initialWeight, onClose }) {
  const [unit, setUnit] = useState(getStoredUnit)
  const [weight, setWeight] = useState(String(initialWeight || ''))
  const [barWeight, setBarWeight] = useState(String(standardBarFor(unit)))

  function handleUnitChange(newUnit) {
    if (newUnit === unit) return

    setWeight((prev) => {
      if (prev === '') return prev
      const numeric = Number(prev)
      if (Number.isNaN(numeric)) return prev
      return String(roundWeight(convertWeight(numeric, unit, newUnit)))
    })
    // Bar weights are fixed real-world standards (20kg / 45lb), not a
    // conversion of one another, so reset rather than convert.
    setBarWeight(String(standardBarFor(newUnit)))
    setUnit(newUnit)
    localStorage.setItem(UNIT_STORAGE_KEY, newUnit)
  }

  const targetWeight = Number(weight) || 0
  const bar = Number(barWeight) || 0
  const standardPlates = unit === 'kg' ? STANDARD_PLATES_KG : STANDARD_PLATES_LB
  const { platesPerSide, achievedWeight, remainder } = calculatePlates(
    targetWeight,
    bar,
    standardPlates
  )

  const leftSide = [...platesPerSide].reverse()

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
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/80 p-4"
      onClick={onClose}
    >
      <Card
        className="max-h-[85vh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-none tracking-tight text-chalk uppercase">
            Plate calculator
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-chalk-dim hover:text-danger"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex justify-end">{unitToggle}</div>

        <div className="mt-3 flex gap-3">
          <label className="flex-1">
            <span className="text-[11px] text-chalk-dim uppercase">Target weight ({unit})</span>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-chalk focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="flex-1">
            <span className="text-[11px] text-chalk-dim uppercase">Bar weight ({unit})</span>
            <input
              type="number"
              value={barWeight}
              onChange={(e) => setBarWeight(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-chalk focus:border-blue-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="flex min-w-max items-center justify-center gap-0.5 py-2">
            <div className="h-1.5 w-6 shrink-0 rounded-l bg-line" />
            {leftSide.map((p, i) => (
              <Plate key={`l-${i}`} weight={p} />
            ))}
            <div className="h-2.5 w-10 shrink-0 bg-line" />
            {platesPerSide.map((p, i) => (
              <Plate key={`r-${i}`} weight={p} />
            ))}
            <div className="h-1.5 w-6 shrink-0 rounded-r bg-line" />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1 text-center">
          {platesPerSide.length === 0 ? (
            <p className="text-sm text-chalk-dim">
              {targetWeight <= bar
                ? `No plates needed — the bar alone is ${bar}${unit}.`
                : 'Enter a target weight to calculate.'}
            </p>
          ) : (
            <p className="text-sm text-chalk">
              Each side:{' '}
              <span className="font-mono font-bold text-blue-400">
                {platesPerSide.join(' + ')} {unit}
              </span>
            </p>
          )}
          {remainder > 0 && (
            <p className="text-xs text-chalk-dim">
              {targetWeight}
              {unit} isn't exactly achievable with these plates — closest is {achievedWeight}
              {unit}.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

export default PlateCalculatorModal
