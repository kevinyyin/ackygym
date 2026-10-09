import HistoryChartModal from './HistoryChartModal'
import { convertWeight, roundWeight } from './weightUnits'

function WeightHistoryModal({ group, unit, onClose }) {
  return (
    <HistoryChartModal
      group={group}
      valueKey="weight"
      getValue={(entry) => roundWeight(convertWeight(entry.weight_kg, 'kg', unit))}
      formatTooltip={(value) => [`${value} ${unit}`, 'Weight']}
      onClose={onClose}
    />
  )
}

export default WeightHistoryModal
