import { useEffect, useState } from 'react'

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

  // Written from an effect, not inside the setter: a fetch that resolves
  // after its page unmounted (e.g. after sign-out cleared the cache) must not
  // repopulate it — an unmounted component's effects never run.
  useEffect(() => {
    cacheWrite(key, value)
  }, [key, value])

  return [value, setValue]
}
