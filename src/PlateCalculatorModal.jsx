import { useState } from 'react'
import Sheet from './Sheet'
import { calculatePlates, STANDARD_SETUP } from './plateCalculator'

function plateSizeClass(weight) {
  if (weight >= 20) return 'h-24 w-3.5'
  if (weight >= 10) return 'h-20 w-3'
  if (weight >= 5) return 'h-16 w-2.5'
  return 'h-12 w-2'
}

function Plate({ weight }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <span className="text-[11px] tabular-nums text-chalk-dim">{weight}</span>
      <div className={`rounded-sm bg-blue-500 ${plateSizeClass(weight)}`} />
    </div>
  )
}

// Stays mounted (Sheet needs that to animate out), so each open re-seeds the
// target from the form's current weight.
function PlateCalculatorModal({ open, initialWeight, unit, onClose }) {
  const [weight, setWeight] = useState(String(initialWeight || ''))
  const [barWeight, setBarWeight] = useState(String(STANDARD_SETUP[unit].bar))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setWeight(String(initialWeight || ''))
  }

  const targetWeight = Number(weight) || 0
  const bar = Number(barWeight) || 0
  const { platesPerSide, achievedWeight, remainder } = calculatePlates(targetWeight, bar, STANDARD_SETUP[unit].plates)

  const leftSide = [...platesPerSide].reverse()

  return (
    <Sheet open={open} onClose={onClose} title="Plate calculator">
      <div className="mt-3 flex gap-3">
        <label className="flex-1">
          <span className="text-caption text-chalk-dim">Target weight ({unit})</span>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="mt-1.5 h-11 w-full min-w-0 rounded-field bg-surface-2 px-4 text-base tabular-nums text-chalk focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </label>
        <label className="flex-1">
          <span className="text-caption text-chalk-dim">Bar weight ({unit})</span>
          <input
            type="number"
            inputMode="decimal"
            value={barWeight}
            onChange={(e) => setBarWeight(e.target.value)}
            className="mt-1.5 h-11 w-full min-w-0 rounded-field bg-surface-2 px-4 text-base tabular-nums text-chalk focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
          <p className="text-[15px] text-chalk-dim">
            {targetWeight <= bar
              ? `No plates needed — the bar alone is ${bar}${unit}.`
              : 'Enter a target weight to calculate.'}
          </p>
        ) : (
          <p className="text-[15px] text-chalk-dim">
            Each side{' '}
            <span className="text-[17px] font-semibold tabular-nums text-chalk">
              {platesPerSide.join(' + ')} {unit}
            </span>
          </p>
        )}
        {remainder > 0 && (
          <p className="text-caption text-chalk-dim">
            {targetWeight}
            {unit} isn't exactly achievable with these plates — closest is {achievedWeight}
            {unit}.
          </p>
        )}
      </div>
    </Sheet>
  )
}

export default PlateCalculatorModal
