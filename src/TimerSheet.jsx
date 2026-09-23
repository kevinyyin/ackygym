import Sheet from './Sheet'
import TimerPanel from './TimerPanel'

function TimerSheet({ open, onClose, timer }) {
  return (
    <Sheet open={open} onClose={onClose} title="Rest">
      <TimerPanel
        duration={timer.duration}
        remaining={timer.remaining}
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
