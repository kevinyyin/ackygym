import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import Card, { SectionLabel } from './Card'
import { groupByUser } from './groupByUser'
import { getTodayDateString, formatDate } from './dateUtils'
import { FlameIcon } from './icons'
import CalorieHistoryModal from './CalorieHistoryModal'
import ConfirmDeleteButton from './ConfirmDeleteButton'
import { isPositiveNumber } from './validation'

function CalorieTracker({ profiles, userId, target, onError }) {
  const [entries, setEntries] = useState([])
  const [entriesLoaded, setEntriesLoaded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [chartGroup, setChartGroup] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [editingEntryId, setEditingEntryId] = useState(null)
  const [draftCalories, setDraftCalories] = useState('')

  useEffect(() => {
    async function fetchEntries() {
      const { data, error } = await supabase
        .from('calorie_logs')
        .select('id, user_id, date, calories')
        .order('date', { ascending: false })

      if (error) {
        onError(error.message)
        return
      }
      setEntries(data)
      setEntriesLoaded(true)
    }

    fetchEntries()
  }, [refreshKey, onError])

  async function handleSubmit(e) {
    e.preventDefault()
    if (submittingRef.current) return

    const numeric = Number(inputValue)
    if (!isPositiveNumber(numeric)) return

    submittingRef.current = true
    onError('')
    setSubmitting(true)

    const { error } = await supabase.from('calorie_logs').upsert(
      { user_id: userId, date: getTodayDateString(), calories: numeric },
      { onConflict: 'user_id,date' }
    )

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
    const { error } = await supabase.from('calorie_logs').delete().eq('id', entryId)
    if (error) {
      onError(error.message)
      return
    }
    setRefreshKey((k) => k + 1)
  }

  function startEdit(entry) {
    setEditingEntryId(entry.id)
    setDraftCalories(String(Math.round(Number(entry.calories))))
  }

  function cancelEdit() {
    setEditingEntryId(null)
  }

  async function saveEdit(entryId) {
    const numeric = Number(draftCalories)
    if (!isPositiveNumber(numeric)) return

    onError('')
    const { error } = await supabase
      .from('calorie_logs')
      .update({ calories: numeric })
      .eq('id', entryId)

    if (error) {
      onError(error.message)
      return
    }
    setEditingEntryId(null)
    setRefreshKey((k) => k + 1)
  }

  const groupedEntries = groupByUser(entries, profiles, userId, 'entries')

  const latestOwnEntry = entries.find((entry) => entry.user_id === userId)

  const inputClasses =
    'w-full rounded-md border border-line bg-surface-2 px-4 py-3 font-body text-base text-chalk placeholder:text-chalk-dim focus:border-blue-500 focus:outline-none'

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-chalk-dim uppercase">
            <FlameIcon className="h-4 w-4 text-blue-400" />
            Calories today
          </p>
        </div>
        <p className="mt-3 font-mono text-5xl font-bold text-blue-400">
          {latestOwnEntry ? Math.round(Number(latestOwnEntry.calories)) : '—'}
          <span className="ml-2 font-body text-lg font-normal text-chalk-dim">
            {target ? `/ ${target} kcal` : 'kcal'}
          </span>
        </p>
        <p className="mt-1 text-xs text-chalk-dim">
          {!entriesLoaded
            ? 'Loading…'
            : latestOwnEntry
              ? formatDate(latestOwnEntry.date, { year: true })
              : 'Nothing logged yet'}
        </p>
      </Card>

      <Card className="p-4">
        <SectionLabel>Log today&apos;s calories</SectionLabel>
        <form onSubmit={handleSubmit} className="mt-3 flex gap-3">
          <input
            type="number"
            step="1"
            min="1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Calories (kcal)"
            required
            className={inputClasses}
          />
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 rounded-md bg-blue-500 px-4 py-3 font-body text-base font-bold text-onblue active:bg-blue-600 disabled:opacity-40"
          >
            {submitting ? 'Logging…' : 'Log'}
          </button>
        </form>
      </Card>

      <div className="flex flex-col gap-3">
        <SectionLabel>History</SectionLabel>
        {!entriesLoaded ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">Loading…</p>
          </Card>
        ) : groupedEntries.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-chalk-dim">No calories logged yet.</p>
          </Card>
        ) : (
          groupedEntries.map((group) => (
            <Card key={group.userId} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setChartGroup(group)}
                className="w-full border-b border-line px-4 py-2 text-left font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
              >
                {group.name}
              </button>
              <ul className="divide-y divide-line">
                {group.entries.map((entry) => {
                  const isEditing = editingEntryId === entry.id
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-2 px-4 py-3"
                    >
                      <span className="font-mono text-sm text-chalk-dim">
                        {formatDate(entry.date, { year: true })}
                      </span>
                      {isEditing ? (
                        <span className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            autoFocus
                            value={draftCalories}
                            onChange={(e) => setDraftCalories(e.target.value)}
                            className="w-20 rounded-md border border-line bg-surface-2 px-2 py-1 text-right font-mono text-sm text-chalk focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => saveEdit(entry.id)}
                            disabled={!isPositiveNumber(draftCalories)}
                            className="shrink-0 text-blue-400 disabled:opacity-40"
                            aria-label="Save calorie entry"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="shrink-0 text-chalk-dim hover:text-danger"
                            aria-label="Cancel editing calorie entry"
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-3">
                          <span className="font-mono font-medium text-chalk">
                            {Math.round(Number(entry.calories))} kcal
                          </span>
                          {entry.user_id === userId && (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(entry)}
                                aria-label="Edit calorie entry"
                                className="font-mono text-[11px] tracking-wide text-chalk-dim uppercase hover:text-blue-400"
                              >
                                Edit
                              </button>
                              <ConfirmDeleteButton
                                onConfirm={() => handleDelete(entry.id)}
                                label={`${formatDate(entry.date, { year: true })} calorie entry`}
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
            </Card>
          ))
        )}
      </div>

      <CalorieHistoryModal
        group={chartGroup}
        target={chartGroup?.userId === userId ? target : null}
        onClose={() => setChartGroup(null)}
      />
    </div>
  )
}

export default CalorieTracker
