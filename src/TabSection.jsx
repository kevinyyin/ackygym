import { Outlet } from 'react-router-dom'
import SegmentedControl from './SegmentedControl'

function TabSection({ segments, layoutId }) {
  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl segments={segments} layoutId={layoutId} />
      <Outlet />
    </div>
  )
}

export default TabSection
