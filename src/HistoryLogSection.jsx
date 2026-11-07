import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import Card from './Card'
import { groupByUser } from './groupByUser'
import { getTodayDateString, formatDate } from './dateUtils'
import { isPositiveNumber } from './validation'
import { CheckIcon, CloseIcon, ChevronRightIcon } from './icons'
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
    'h-11 w-full min-w-0 rounded-field bg-surface-2 px-4 text-base text-chalk placeholder:text-chalk-dim focus:ring-2 focus:ring-blue-500 focus:outline-none'

  return (
    <>
      <Card className="p-4">
        <h2 className="text-headline text-chalk">{logLabel}</h2>
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode={inputProps.inputMode}
            min={inputProps.min}
            step={inputProps.step}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            required
            className={inputClasses}
          />
          <button
            type="submit"
            disabled={submitting}
            className="h-11 shrink-0 rounded-full bg-blue-500 px-5 text-[15px] font-semibold text-onblue active:bg-blue-600 disabled:opacity-40"
          >
            {submitting ? 'Saving…' : accumulate ? 'Add' : 'Log'}
          </button>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="px-1 text-headline text-chalk">History</h2>
        {entriesLoaded && entries.length > 0 && (
          <input
            type="text"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="Filter by date (e.g. 2026-03)"
            aria-label="Filter by date"
            autoComplete="off"
            className="h-11 w-full min-w-0 rounded-field bg-surface px-4 text-base text-chalk placeholder:text-chalk-dim focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
            <p className="text-[15px] text-chalk-dim">{emptyLogMessage}</p>
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
                  aria-haspopup="dialog"
                  className="flex min-h-12 w-full items-center justify-between gap-2 border-b border-line px-4 text-left active:bg-surface-2"
                >
                  <span className="min-w-0 truncate text-[17px] font-semibold text-chalk">{group.name}</span>
                  <span className="flex shrink-0 items-center gap-0.5 text-[15px] text-blue-400">
                    Chart
                    <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
                {visibleEntries.length === 0 ? (
                  <p className="px-4 py-3 text-[15px] text-chalk-dim">No entries match “{normalizedDateFilter}”.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {visibleEntries.map((entry) => {
                      const isEditing = editingEntryId === entry.id
                      return (
                        <li key={entry.id} className="flex min-h-12 items-center justify-between gap-2 py-0.5 pr-1 pl-4">
                          <span className="text-[15px] tabular-nums text-chalk-dim">
                            {formatDate(entry.date, { year: true })}
                          </span>
                          {isEditing ? (
                            <span className="flex items-center">
                              <input
                                type="number"
                                inputMode={inputProps.inputMode}
                                min={inputProps.min}
                                step={inputProps.step}
                                autoFocus
                                value={draftValue}
                                onChange={(e) => setDraftValue(e.target.value)}
                                aria-label={`New value for ${formatDate(entry.date, { year: true })}`}
                                className="h-11 w-24 rounded-field bg-surface-2 px-3 text-right text-base tabular-nums text-chalk focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                              <span className="ml-1.5 text-caption text-chalk-dim">{unitSuffix}</span>
                              <button
                                type="button"
                                onClick={() => saveEdit(entry.id)}
                                disabled={!isPositiveNumber(parseInput(draftValue))}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-blue-400 disabled:opacity-40"
                                aria-label="Save entry"
                              >
                                <CheckIcon className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-chalk-dim"
                                aria-label="Cancel editing entry"
                              >
                                <CloseIcon className="h-5 w-5" />
                              </button>
                            </span>
                          ) : (
                            <span className="flex min-h-11 items-center">
                              <span className="pr-3 text-[15px] font-semibold tabular-nums text-chalk">
                                {formatValue(entry[valueColumn])} {unitSuffix}
                              </span>
                              {entry.user_id === userId && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(entry)}
                                    aria-label={`Edit ${formatDate(entry.date, { year: true })} entry`}
                                    className="h-11 rounded-full px-2 text-[15px] text-blue-400 active:text-blue-300"
                                  >
                                    Edit
                                  </button>
                                  <ConfirmDeleteButton
                                    onConfirm={() => handleDelete(entry.id)}
                                    label={`${formatDate(entry.date, { year: true })} entry`}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
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
