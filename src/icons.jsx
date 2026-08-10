function BaseIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

export function GridIcon(props) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </BaseIcon>
  )
}

export function CalendarIcon(props) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </BaseIcon>
  )
}

export function ChartIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </BaseIcon>
  )
}

export function ScaleIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
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
    <BaseIcon strokeWidth="2" {...props}>
      <path d="M15 18l-6-6 6-6" />
    </BaseIcon>
  )
}

export function ChevronRightIcon(props) {
  return (
    <BaseIcon strokeWidth="2" {...props}>
      <path d="M9 18l6-6-6-6" />
    </BaseIcon>
  )
}
