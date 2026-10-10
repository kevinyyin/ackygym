import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import Card from './Card'
import { groupByUser } from './groupByUser'
import { getTodayDateString, formatDate } from './dateUtils'
import { isPositiveNumber } from './validation'
import { CheckIcon, CloseIcon } from './icons'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import Skeleton from './Skeleton'
import { useCachedState } from './pageCache'
import HistoryChartModal from './HistoryChartModal'

// Shared by CalorieTracker.jsx and BodyWeightPage.jsx — both used to
// duplicate this entire log/edit/delete/history-list block verbatim aside
// from table/column names and weight's extra unit dimension.
function HistoryLogSection({
  profiles,
  userId,
  onError,
  tableName,
  valueColumn,
  logLabel,
  placeholder,
  inputProps,
  parseInput,
  formatValue,
  unitSuffix,
  emptyLogMessage,
  onEntriesChange,
  chartLabel,
  chartTarget,
  // Calories add up over a day; body weight replaces the day's value.
  accumulate = false,
}) {
  const [entries, setEntries] = useCachedState(`history:${tableName}:entries`, [])
  const [entriesLoaded, setEntriesLoaded] = useCachedState(`history:${tableName}:entriesLoaded`, false)
  const [inputValue, setInputValue] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [chartGroup, setChartGroup] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [draftValue, setDraftValue] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    async function fetchEntries() {
      const { data, error } = await supabase
        .from(tableName)
        .select(`id, user_id, date, ${valueColumn}`)
        .order('date', { ascending: false })

      if (error) {
        onError(error.message)
        return
      }
      setEntries(data)
      setEntriesLoaded(true)
      onEntriesChange?.(data)
    }

    fetchEntries()
    // tableName/valueColumn/onEntriesChange are fixed for the
    // lifetime of a given call site (a page never switches which table it
    // logs), so they're deliberately excluded to avoid an unstable-callback
    // identity (onEntriesChange) causing a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, onError])

  async function handleSubmit(e) {
    e.preventDefault()
    if (submittingRef.current) return

    const value = parseInput(inputValue)
    if (!isPositiveNumber(value)) return

    submittingRef.current = true
    onError('')
    setSubmitting(true)

    const today = getTodayDateString()
    let total = value
    let error = null
    if (accumulate) {
      // ponytail: read-then-write, so two adds landing at the same instant
      // could drop one; move to a Postgres increment RPC if that ever bites.
      const { data, error: readError } = await supabase
        .from(tableName)
        .select(valueColumn)
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle()
      error = readError
      total += Number(data?.[valueColumn] ?? 0)
    }
    if (!error) {
      ;({ error } = await supabase
        .from(tableName)
        .upsert({ user_id: userId, date: today, [valueColumn]: total }, { onConflict: 'user_id,date' }))
    }

    submittingRef.current = false
    setSubmitting(false)

    if (error) {
      onError(error.message)
      return
    }

    setInputValue('')
    setRefreshKey((k) => k + 1)
  }

  async function handleDelete(entryId) {
    onError('')
    const { error } = await supabase.from(tableName).delete().eq('id', entryId)
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((k) => k + 1)
  }

  function startEdit(entry) {
    setEditingEntryId(entry.id)
    setDraftValue(String(formatValue(entry[valueColumn])))
  }

  function cancelEdit() {
    setEditingEntryId(null)
  }

  async function saveEdit(entryId) {
    const value = parseInput(draftValue)
    if (!isPositiveNumber(value)) return

    onError('')
    const { error } = await supabase.from(tableName).update({ [valueColumn]: value }).eq('id', entryId)

    if (error) {
      onError(error.message)
      return
    }
    setEditingEntryId(null)
    setRefreshKey((k) => k + 1)
  }

  const groupedEntries = groupByUser(entries, profiles, userId, 'entries')
  const normalizedDateFilter = dateFilter.trim()
  const isFiltering = normalizedDateFilter !== ''

  const inputClasses =
    'w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none'

  return (
    <>
      <Card className="p-4">
        <h2 className="text-headline text-chalk">{logLabel}</h2>
        <form onSubmit={handleSubmit} className="mt-3 flex gap-3">
          <input
            type="number"
            inputMode={inputProps.inputMode}
            min={inputProps.min}
            step={inputProps.step}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            required
            className={inputClasses}
          />
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 rounded-md bg-blue-500 px-4 py-3 font-body text-base font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
          >
            {submitting ? 'Saving…' : accumulate ? 'Add' : 'Log'}
          </button>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-headline text-chalk">History</h2>
        {entriesLoaded && entries.length > 0 && (
          <input
            type="text"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="Filter by date (e.g. 2026-03)"
            autoComplete="off"
            className="w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none"
          />
        )}
        {!entriesLoaded ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            <span className="sr-only">Loading</span>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : groupedEntries.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">{emptyLogMessage}</p>
          </Card>
        ) : (
          groupedEntries.map((group) => {
            const visibleEntries = isFiltering
              ? group.entries.filter((entry) => entry.date.includes(normalizedDateFilter))
              : group.entries

            return (
              <Card key={group.userId} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setChartGroup(group)}
                  className="w-full border-b border-line px-4 py-2 text-left font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
                >
                  {group.name}
                </button>
                {visibleEntries.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-chalk-dim">No entries match “{normalizedDateFilter}”.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {visibleEntries.map((entry) => {
                      const isEditing = editingEntryId === entry.id
                      return (
                        <li key={entry.id} className="flex items-center justify-between gap-2 px-4 py-3">
                          <span className="font-mono text-sm text-chalk-dim">
                            {formatDate(entry.date, { year: true })}
                          </span>
                          {isEditing ? (
                            <span className="flex items-center gap-2">
                              <input
                                type="number"
                                inputMode={inputProps.inputMode}
                                min={inputProps.min}
                                step={inputProps.step}
                                autoFocus
                                value={draftValue}
                                onChange={(e) => setDraftValue(e.target.value)}
                                className="w-20 rounded-md border border-line bg-surface-2 px-2 py-1 text-right font-mono text-sm text-chalk focus:border-blue-500 focus:outline-none"
                              />
                              <span className="font-mono text-xs text-chalk-dim">{unitSuffix}</span>
                              <button
                                type="button"
                                onClick={() => saveEdit(entry.id)}
                                disabled={!isPositiveNumber(parseInput(draftValue))}
                                className="shrink-0 text-blue-400 disabled:opacity-40"
                                aria-label="Save entry"
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="shrink-0 text-chalk-dim hover:text-danger"
                                aria-label="Cancel editing entry"
                              >
                                <CloseIcon className="h-4 w-4" />
                              </button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-3">
                              <span className="font-mono font-medium text-chalk">
                                {formatValue(entry[valueColumn])} {unitSuffix}
                              </span>
                              {entry.user_id === userId && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(entry)}
                                    aria-label="Edit entry"
                                    className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
                                  >
                                    Edit
                                  </button>
                                  <ConfirmDeleteButton
                                    onConfirm={() => handleDelete(entry.id)}
                                    label={`${formatDate(entry.date, { year: true })} entry`}
                                    className="shrink-0"
                                  />
                                </>
                              )}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            )
          })
        )}
      </div>

      <HistoryChartModal
        group={chartGroup}
        getValue={(entry) => formatValue(entry[valueColumn])}
        formatTooltip={(value) => [`${value} ${unitSuffix}`, chartLabel]}
        referenceValue={chartGroup?.userId === userId ? chartTarget : null}
        onClose={() => setChartGroup(null)}
      />
    </>
  )
}

export default HistoryLogSection
