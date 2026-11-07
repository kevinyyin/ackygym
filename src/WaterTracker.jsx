import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import Sheet from './Sheet'
import { displayName } from './displayName'
import { getTodayDateString } from './dateUtils'
import { DropletIcon } from './icons'
import WaterBottle from './WaterBottle'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import { formatBottles } from './waterUnits'
import { useCachedState } from './pageCache'

const QUICK_ADD_ML = [250, 500, 750]
// String ids are optimistic entries still saving (see handleAdd).
const isSaving = (log) => typeof log.id === 'string'
const QUICK_ADD_BOTTLE_FRACTIONS = [
  { fraction: 0.5, label: '+½ bottle' },
  { fraction: 1, label: '+1 bottle' },
  { fraction: 2, label: '+2 bottles' },
]

function WaterTracker({ session, profiles, onError, waterMode, bottleSizeMl, goalMl }) {
  const isBottles = waterMode === 'bottles'
  // Date-scoped and fixed per mount, like Home's today's sets.
  const [today] = useState(getTodayDateString)
  const [logs, setLogs] = useCachedState(`water:logs:${today}`, [])
  const [refreshKey, setRefreshKey] = useState(0)
  // Temp ids this mount is still saving; a cached temp entry from an earlier
  // mount can't be swapped for its real row any more, so a refetch drops it.
  const savingIdsRef = useRef(new Set())
  const [customValue, setCustomValue] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    async function fetchLogs() {
      const { data, error } = await supabase
        .from('water_logs')
        .select('id, user_id, amount_ml, created_at')
        .eq('date', today)
        .order('created_at')

      if (error) {
        onError(error.message)
        return
      }
      setLogs((current) => [...data, ...current.filter((log) => savingIdsRef.current.has(log.id))])
    }

    fetchLogs()
  }, [refreshKey, today, onError, setLogs])

  // Every write updates the bottle first and saves after; a failed save
  // reports the error and refetches, which puts the real total back.
  async function write(query) {
    onError('')
    const { error } = await query
    if (error) {
      onError(error.message)
      setRefreshKey((k) => k + 1)
    }
  }

  async function handleAdd(amountMl) {
    onError('')
    const tempId = `saving-${crypto.randomUUID()}`
    savingIdsRef.current.add(tempId)
    setLogs((current) => [
      ...current,
      { id: tempId, user_id: session.user.id, amount_ml: amountMl, created_at: new Date().toISOString() },
    ])
    const { data, error } = await supabase
      .from('water_logs')
      .insert({ user_id: session.user.id, amount_ml: amountMl, date: today })
      .select('id, user_id, amount_ml, created_at')
      .single()
    savingIdsRef.current.delete(tempId)
    setLogs((current) =>
      error ? current.filter((log) => log.id !== tempId) : current.map((log) => (log.id === tempId ? data : log))
    )
    if (error) onError(error.message)
  }

  function handleCustomAdd(e) {
    e.preventDefault()
    const amount = Number(customValue)
    if (!amount || amount <= 0) return
    handleAdd(isBottles ? Math.round(amount * bottleSizeMl) : amount)
    setCustomValue('')
  }

  const ownLogs = logs.filter((log) => log.user_id === session.user.id)
  const lastOwnLog = ownLogs[ownLogs.length - 1]

  function handleUndo() {
    // An entry still saving has no id to delete yet; the button is disabled meanwhile.
    if (!lastOwnLog || isSaving(lastOwnLog)) return
    setLogs((current) => current.filter((log) => log.id !== lastOwnLog.id))
    return write(supabase.from('water_logs').delete().eq('id', lastOwnLog.id))
  }

  function handleClear() {
    setLogs((current) => current.filter((log) => log.user_id !== session.user.id))
    return write(supabase.from('water_logs').delete().eq('user_id', session.user.id).eq('date', today))
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
  const ownProgress = Math.min(ownTotalMl / goalMl, 1)

  const otherTotals = [...totalsByUserId.entries()]
    .filter(([userId]) => userId !== session.user.id)
    .map(([userId, totalMl]) => ({
      userId,
      name: profileByUserId[userId] ? displayName(profileByUserId[userId]) : userId,
      totalMl,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const quickAdds = isBottles
    ? QUICK_ADD_BOTTLE_FRACTIONS.map(({ fraction, label }) => ({ key: fraction, ml: Math.round(bottleSizeMl * fraction), label }))
    : QUICK_ADD_ML.map((ml) => ({ key: ml, ml, label: `+${ml} ml` }))

  const totalLabel = isBottles
    ? `${formatBottles(ownTotalMl, bottleSizeMl)} / ${formatBottles(goalMl, bottleSizeMl)} bottles`
    : `${ownTotalMl} / ${goalMl} ml`

  // A compact tile beside Creatine on Today; the full controls open in a sheet.
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="relative flex min-h-16 flex-col items-start justify-center gap-0.5 overflow-hidden rounded-field bg-surface px-4 py-3 text-left active:bg-surface-2"
      >
        <span className="flex items-center gap-1.5 text-[15px] font-medium text-chalk">
          <DropletIcon className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
          Water
        </span>
        <span className="text-caption text-chalk-dim tabular-nums">
          {ownProgress >= 1 ? 'Goal reached' : totalLabel}
        </span>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-surface-2">
          <span className="block h-full bg-blue-400 transition-[width]" style={{ width: `${ownProgress * 100}%` }} />
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Water">
        <div>
          <div className="flex items-center gap-4">
            <WaterBottle progress={ownProgress} className="h-32 w-20 shrink-0" />
            <div className="min-w-0">
              <p className="font-mono text-4xl font-bold text-blue-400">
                {isBottles ? formatBottles(ownTotalMl, bottleSizeMl) : ownTotalMl}
                <span className="ml-1 font-body text-lg font-normal text-chalk-dim">
                  / {isBottles ? `${formatBottles(goalMl, bottleSizeMl)} bottles` : `${goalMl} ml`}
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
            {quickAdds.map(({ key, ml, label }) => (
              <button
                key={key}
                onClick={() => handleAdd(ml)}
                className="rounded-full border border-line bg-surface-2 px-3 py-1.5 font-mono text-xs font-semibold text-chalk active:border-blue-500 active:text-blue-400"
              >
                {label}
              </button>
            ))}
            <button
              onClick={handleUndo}
              disabled={!lastOwnLog || isSaving(lastOwnLog)}
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
              inputMode="decimal"
              min={isBottles ? '0.1' : '1'}
              step={isBottles ? '0.1' : '1'}
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={isBottles ? 'Custom amount (bottles)' : 'Custom amount (ml)'}
              className="w-full rounded-md border border-line bg-surface-2 px-4 py-2.5 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
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
                      ? `${formatBottles(entry.totalMl, bottleSizeMl)} / ${formatBottles(goalMl, bottleSizeMl)} bottles`
                      : `${entry.totalMl} / ${goalMl} ml`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </>
  )
}

export default WaterTracker
