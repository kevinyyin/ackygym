import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import Card from './Card'
import { convertWeight, roundWeight } from './weightUnits'

function formatDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function WeightHistoryModal({ group, unit, onClose }) {
  if (!group) return null

  const sorted = [...group.entries].sort((a, b) => (a.date < b.date ? -1 : 1))
  const chartData = sorted.map((entry) => ({
    date: formatDate(entry.date),
    weight: roundWeight(convertWeight(entry.weight_kg, 'kg', unit)),
  }))

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
            {group.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-chalk-dim hover:text-danger"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          {chartData.length === 0 ? (
            <p className="text-sm text-chalk-dim">No body weight logged yet.</p>
          ) : chartData.length === 1 ? (
            <p className="text-xs text-chalk-dim">Log another entry to see a trend.</p>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--color-chalk-dim)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fill: 'var(--color-chalk-dim)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-2)',
                      border: '1px solid var(--color-line)',
                      borderRadius: 6,
                      color: 'var(--color-chalk)',
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'var(--color-chalk-dim)' }}
                    formatter={(value) => [`${value} ${unit}`, 'Weight']}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-blue-500)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--color-blue-500)' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default WeightHistoryModal
