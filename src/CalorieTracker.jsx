import { useState } from 'react'
import Card from './Card'
import { formatDate, getTodayDateString } from './dateUtils'
import { FlameIcon } from './icons'
import HistoryLogSection from './HistoryLogSection'

function CalorieTracker({ profiles, userId, target, onError }) {
  const [entries, setEntries] = useState([])
  const [entriesLoaded, setEntriesLoaded] = useState(false)

  const today = getTodayDateString()
  const todaysEntry = entries.find((entry) => entry.user_id === userId && entry.date === today)

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
          {todaysEntry ? Math.round(Number(todaysEntry.calories)) : '—'}
          <span className="ml-2 font-body text-lg font-normal text-chalk-dim">
            {target ? `/ ${target} kcal` : 'kcal'}
          </span>
        </p>
        <p className="mt-1 text-xs text-chalk-dim">
          {!entriesLoaded
            ? 'Loading…'
            : todaysEntry
              ? formatDate(today, { year: true })
              : 'Nothing logged today'}
        </p>
      </Card>

      <HistoryLogSection
        profiles={profiles}
        userId={userId}
        onError={onError}
        tableName="calorie_logs"
        valueColumn="calories"
        logLabel="Add calories"
        placeholder="Calories eaten (kcal)"
        inputProps={{ min: 1, step: 1, inputMode: 'numeric' }}
        parseInput={(v) => Number(v)}
        formatValue={(raw) => Math.round(Number(raw))}
        unitSuffix="kcal"
        emptyLogMessage="No calories logged yet."
        onEntriesChange={(data) => {
          setEntries(data)
          setEntriesLoaded(true)
        }}
        chartLabel="Calories"
        chartTarget={target}
        accumulate
      />
    </div>
  )
}

export default CalorieTracker
