import Sheet from './Sheet'
import TrendChart from './TrendChart'
import { formatDate } from './dateUtils'

function HistoryChartModal({ group, getValue, formatTooltip, referenceValue, onClose }) {
  const chartData = group
    ? [...group.entries]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((entry) => ({ date: formatDate(entry.date), value: getValue(entry) }))
    : []

  return (
    <Sheet open={!!group} onClose={onClose} title={group?.name}>
      {group && (
        <div className="mt-4">
          {chartData.length === 1 ? (
            <p className="text-xs text-chalk-dim">Log another entry to see a trend.</p>
          ) : (
            <TrendChart
              className="h-56 w-full"
              data={chartData}
              yDomain={['auto', 'auto']}
              formatTooltip={formatTooltip}
              referenceValue={referenceValue}
            />
          )}
        </div>
      )}
    </Sheet>
  )
}

export default HistoryChartModal
