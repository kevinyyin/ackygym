import Sheet from './Sheet'
import TimerPanel from './TimerPanel'
import { useRemaining } from './useRestTimer'

function TimerSheet({ open, onClose, timer }) {
  const remaining = useRemaining(timer)
  return (
    <Sheet open={open} onClose={onClose} title="Rest">
      <TimerPanel
        duration={timer.duration}
        remaining={remaining}
        status={timer.status}
        selectDuration={timer.selectDuration}
        onStart={timer.start}
        onPause={timer.pause}
        onReset={timer.reset}
      />
    </Sheet>
  )
}

export default TimerSheet
