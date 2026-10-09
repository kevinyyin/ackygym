import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'

const TICK = { fill: 'var(--color-chalk-dim)', fontSize: 11 }

// The app's one line chart: `data` is [{ date, value }], colored through the
// theme's CSS variables so it follows light/dark live. Without `yDomain` the
// Y axis starts at zero (recharts' default).
function TrendChart({ data, formatTooltip, yDomain, referenceValue, className }) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} />
          <YAxis domain={yDomain} tick={TICK} tickLine={false} axisLine={false} width={36} />
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
            dataKey="value"
            stroke="var(--color-blue-500)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--color-blue-500)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default TrendChart
