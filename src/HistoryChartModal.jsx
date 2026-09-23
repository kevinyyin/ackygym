import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import Sheet from './Sheet'
import { formatDate } from './dateUtils'

function HistoryChartModal({ group, valueKey, getValue, formatTooltip, emptyLabel, referenceValue, onClose }) {
  return (
    <Sheet open={!!group} onClose={onClose} title={group?.name}>
      {group && (
        <HistoryChartBody
          group={group}
          valueKey={valueKey}
          getValue={getValue}
          formatTooltip={formatTooltip}
          emptyLabel={emptyLabel}
          referenceValue={referenceValue}
        />
      )}
    </Sheet>
  )
}

function HistoryChartBody({ group, valueKey, getValue, formatTooltip, emptyLabel, referenceValue }) {
  const sorted = [...group.entries].sort((a, b) => (a.date < b.date ? -1 : 1))
  const chartData = sorted.map((entry) => ({
    date: formatDate(entry.date),
    [valueKey]: getValue(entry),
  }))

  return (
    <div className="mt-4">
      {chartData.length === 0 ? (
        <p className="text-sm text-chalk-dim">{emptyLabel}</p>
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
                formatter={formatTooltip}
              />
              {referenceValue && (
                <ReferenceLine
                  y={referenceValue}
                  stroke="var(--color-chalk-dim)"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Target',
                    position: 'insideTopLeft',
                    fill: 'var(--color-chalk-dim)',
                    fontSize: 11,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey={valueKey}
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
  )
}

export default HistoryChartModal
