import { useState } from 'react'
import Card from './Card'
import { formatDate } from './dateUtils'
import { FlameIcon } from './icons'
import CalorieHistoryModal from './CalorieHistoryModal'
import HistoryLogSection from './HistoryLogSection'

function CalorieTracker({ profiles, userId, target, onError }) {
  const [entries, setEntries] = useState([])
  const [entriesLoaded, setEntriesLoaded] = useState(false)

  const latestOwnEntry = entries.find((entry) => entry.user_id === userId)

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

      <HistoryLogSection
        profiles={profiles}
        userId={userId}
        onError={onError}
        tableName="calorie_logs"
        selectColumns="id, user_id, date, calories"
        valueColumn="calories"
        logLabel="Log today's calories"
        placeholder="Calories (kcal)"
        inputProps={{ min: 1, step: 1 }}
        parseInput={(v) => Number(v)}
        formatValue={(raw) => Math.round(Number(raw))}
        unitSuffix="kcal"
        emptyLogMessage="No calories logged yet."
        onEntriesChange={(data) => {
          setEntries(data)
          setEntriesLoaded(true)
        }}
        renderChartModal={(group, onClose) => (
          <CalorieHistoryModal group={group} target={group?.userId === userId ? target : null} onClose={onClose} />
        )}
      />
    </div>
  )
}

export default CalorieTracker
