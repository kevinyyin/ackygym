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
      <span className="font-mono text-[9px] text-chalk-dim">{weight}</span>
      <div className={`rounded-sm bg-blue-500 ${plateSizeClass(weight)}`} />
    </div>
  )
}

function PlateCalculatorModal({ initialWeight, unit, onClose }) {
  const [weight, setWeight] = useState(String(initialWeight || ''))
  const [barWeight, setBarWeight] = useState(String(STANDARD_SETUP[unit].bar))

  const targetWeight = Number(weight) || 0
  const bar = Number(barWeight) || 0
  const { platesPerSide, achievedWeight, remainder } = calculatePlates(targetWeight, bar, STANDARD_SETUP[unit].plates)

  const leftSide = [...platesPerSide].reverse()

  return (
    <Sheet open onClose={onClose} title="Plate calculator">
      <div className="mt-3 flex gap-3">
        <label className="flex-1">
          <span className="text-[11px] text-chalk-dim uppercase">Target weight ({unit})</span>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-chalk focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="flex-1">
          <span className="text-[11px] text-chalk-dim uppercase">Bar weight ({unit})</span>
          <input
            type="number"
            inputMode="decimal"
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
    </Sheet>
  )
}

export default PlateCalculatorModal
