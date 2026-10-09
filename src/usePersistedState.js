import { useEffect, useState } from 'react'

// useState that survives reloads. Strings are stored raw and everything else
// as JSON — the formats these keys have always used, so saved preferences
// carry over. A stored value of another type, or one `isValid` rejects, falls
// back to `initial`; stored objects are merged over it so a field added
// later still gets its default.
export function usePersistedState(key, initial, isValid = () => true) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initial
      const stored = typeof initial === 'string' ? raw : JSON.parse(raw)
      if (typeof stored !== typeof initial || !isValid(stored)) return initial
      return typeof initial === 'object' ? { ...initial, ...stored } : stored
    } catch {
      return initial
    }
  })

  useEffect(() => {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}
