import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Card, { SectionLabel } from './Card'
import { displayName } from './displayName'
import { getTodayDateString } from './dateUtils'
import { DropletIcon } from './icons'
import WaterBottle from './WaterBottle'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import { formatBottles } from './waterUnits'

const SHOW_WATER_KEY = 'gym-tracker:home-show-water'
const GOAL_ML = 2000
const QUICK_ADD_ML = [250, 500, 750]
const QUICK_ADD_BOTTLE_FRACTIONS = [
  { fraction: 0.5, label: '+½ bottle' },
  { fraction: 1, label: '+1 bottle' },
  { fraction: 2, label: '+2 bottles' },
]

function WaterTracker({ session, profiles, onError, waterMode, bottleSizeMl }) {
  const isBottles = waterMode === 'bottles'
  const [logs, setLogs] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [customValue, setCustomValue] = useState('')
  const [expanded, setExpandedState] = useState(() => localStorage.getItem(SHOW_WATER_KEY) === 'true')

  function setExpanded(next) {
    setExpandedState(next)
    localStorage.setItem(SHOW_WATER_KEY, String(next))
  }

  useEffect(() => {
    async function fetchLogs() {
      const { data, error } = await supabase
        .from('water_logs')
        .select('id, user_id, amount_ml, created_at')
        .eq('date', getTodayDateString())
        .order('created_at')

      if (error) {
        onError(error.message)
        return
      }
      setLogs(data)
    }

    fetchLogs()
  }, [refreshKey, onError])

  async function handleAdd(amountMl) {
    onError('')
    const { error } = await supabase
      .from('water_logs')
      .insert({ user_id: session.user.id, amount_ml: amountMl, date: getTodayDateString() })

    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((k) => k + 1)
  }

  async function handleCustomAdd(e) {
    e.preventDefault()
    const amount = Number(customValue)
    if (!amount || amount <= 0) return
    await handleAdd(isBottles ? Math.round(amount * bottleSizeMl) : amount)
    setCustomValue('')
  }

  async function handleUndo() {
    const ownLogs = logs.filter((log) => log.user_id === session.user.id)
    const last = ownLogs[ownLogs.length - 1]
    if (!last) return

    onError('')
    const { error } = await supabase.from('water_logs').delete().eq('id', last.id)
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((k) => k + 1)
  }

  async function handleClear() {
    onError('')
    const { error } = await supabase
      .from('water_logs')
      .delete()
      .eq('user_id', session.user.id)
      .eq('date', getTodayDateString())
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((k) => k + 1)
  }

  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p]))

  const totalsByUserId = new Map()
  for (const log of logs) {
    totalsByUserId.set(
      log.user_id,
      (totalsByUserId.get(log.user_id) || 0) + Number(log.amount_ml)
    )
  }

  const ownTotalMl = totalsByUserId.get(session.user.id) || 0
  const ownProgress = Math.min(ownTotalMl / GOAL_ML, 1)

  const otherTotals = [...totalsByUserId.entries()]
    .filter(([userId]) => userId !== session.user.id)
    .map(([userId, totalMl]) => ({
      userId,
      name: profileByUserId[userId] ? displayName(profileByUserId[userId]) : userId,
      totalMl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Water</SectionLabel>
        <div className="flex shrink-0 items-center gap-3">
          <DropletIcon className="h-4 w-4 text-blue-400" />
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div className="mt-3 flex items-center gap-4">
            <WaterBottle progress={ownProgress} className="h-32 w-20 shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-4xl font-bold text-blue-400">
                {isBottles ? formatBottles(ownTotalMl, bottleSizeMl) : ownTotalMl}
                <span className="ml-1 font-body text-lg font-normal text-chalk-dim">
                  / {isBottles ? `${formatBottles(GOAL_ML, bottleSizeMl)} bottles` : `${GOAL_ML} ml`}
                </span>
              </p>
              <p className="mt-1 font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
                {ownProgress >= 1 ? (
                  <span className="text-blue-400">Goal reached</span>
                ) : (
                  `${Math.round(ownProgress * 100)}% of today's goal`
                )}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {isBottles
              ? QUICK_ADD_BOTTLE_FRACTIONS.map(({ fraction, label }) => (
                  <button
                    key={fraction}
                    onClick={() => handleAdd(Math.round(bottleSizeMl * fraction))}
                    className="rounded-full border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs font-semibold text-chalk active:border-blue-500 active:text-blue-400"
                  >
                    {label}
                  </button>
                ))
              : QUICK_ADD_ML.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAdd(amount)}
                    className="rounded-full border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs font-semibold text-chalk active:border-blue-500 active:text-blue-400"
                  >
                    +{amount} ml
                  </button>
                ))}
            <button
              onClick={handleUndo}
              disabled={ownTotalMl === 0}
              aria-label="Undo last water entry"
              className="rounded-full border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs font-semibold text-chalk-dim active:border-danger active:text-danger disabled:opacity-40"
            >
              Undo
            </button>
            <ConfirmDeleteButton
              onConfirm={handleClear}
              disabled={ownTotalMl === 0}
              idleLabel="Clear today's water"
              armedLabel="Tap again to confirm clearing today's water"
              armedChildren="Confirm?"
              className="rounded-full border px-3 py-1.5 font-mono text-xs font-semibold disabled:opacity-40"
              idleClassName="border-line bg-surface-2 text-chalk-dim active:border-danger active:text-danger"
              armedClassName="border-danger bg-surface-2"
            >
              Clear
            </ConfirmDeleteButton>
          </div>

          <form onSubmit={handleCustomAdd} className="mt-3 flex gap-2">
            <input
              type="number"
              min={isBottles ? '0.1' : '1'}
              step={isBottles ? '0.1' : '1'}
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={isBottles ? 'Custom amount (bottles)' : 'Custom amount (ml)'}
              className="w-full rounded-md border border-line bg-surface-2 px-4 py-2.5 font-body text-sm text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-blue-500 px-4 py-2.5 font-body text-sm font-bold text-onblue active:bg-blue-600"
            >
              Add
            </button>
          </form>

          {otherTotals.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
              {otherTotals.map((entry) => (
                <li key={entry.userId} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-chalk-dim">{entry.name}</span>
                  <span className="font-mono text-sm text-chalk">
                    {isBottles
                      ? `${formatBottles(entry.totalMl, bottleSizeMl)} / ${formatBottles(GOAL_ML, bottleSizeMl)} bottles`
                      : `${entry.totalMl} / ${GOAL_ML} ml`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

export default WaterTracker
