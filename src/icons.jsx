function BaseIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

export function GridIcon(props) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </BaseIcon>
  )
}

export function CalendarIcon(props) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="1.5" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </BaseIcon>
  )
}

export function BarbellIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M3 9v6M6 7v10M18 7v10M21 9v6" strokeWidth="2.5" />
      <path d="M6 12h12" strokeWidth="3.5" />
    </BaseIcon>
  )
}

export function ScaleIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.25" fill="currentColor" stroke="none" />
    </BaseIcon>
  )
}

export function TimerIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" />
      <path d="M9 2h6" />
    </BaseIcon>
  )
}

export function DropletIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12Z" />
    </BaseIcon>
  )
}

export function LogOutIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </BaseIcon>
  )
}

export function ChevronLeftIcon(props) {
  return (
    <BaseIcon strokeWidth="2.5" {...props}>
      <path d="M15 18l-6-6 6-6" />
    </BaseIcon>
  )
}

export function ChevronRightIcon(props) {
  return (
    <BaseIcon strokeWidth="2.5" {...props}>
      <path d="M9 18l6-6-6-6" />
    </BaseIcon>
  )
}
