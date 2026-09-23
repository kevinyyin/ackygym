import { useCallback, useState } from 'react'

// Tab switches unmount pages, and each page's first render used to show
// "Loading…" again while it refetched. This keeps each page's last data in
// memory so a remount paints instantly; the page's own fetch effect still
// runs and swaps in fresh data (stale-while-revalidate). In-memory only —
// a reload starts clean, and sign-out clears it (App.jsx).
const cache = new Map()

export function cacheRead(key, initial) {
  return cache.has(key) ? { hit: true, value: cache.get(key) } : { hit: false, value: initial }
}

export function cacheWrite(key, value) {
  cache.set(key, value)
}

export function clearPageCache() {
  cache.clear()
}

export function useCachedState(key, initial) {
  const [value, setValue] = useState(() => cacheRead(key, initial).value)

  const setCached = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        cacheWrite(key, resolved)
        return resolved
      })
    },
    [key]
  )

  return [value, setCached]
}
