import HistoryChartModal from './HistoryChartModal'

function CalorieHistoryModal({ group, target, onClose }) {
  return (
    <HistoryChartModal
      group={group}
      valueKey="calories"
      getValue={(entry) => Math.round(Number(entry.calories))}
      formatTooltip={(value) => [`${value} kcal`, 'Calories']}
      emptyLabel="No calories logged yet."
      referenceValue={target}
      onClose={onClose}
    />
  )
}

export default CalorieHistoryModal
