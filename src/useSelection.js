import { useState } from 'react'

export function toggled(set, id) {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

// Select mode for bulk actions on a list: whether it's on, which ids are
// picked, and select-all over whichever ids are currently selectable.
export function useSelection() {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  function exit() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  return {
    selectMode,
    selectedIds,
    exit,
    toggleMode: () => {
      setSelectMode((v) => !v)
      setSelectedIds(new Set())
    },
    toggle: (id) => setSelectedIds((current) => toggled(current, id)),
    toggleAll: (ids) => setSelectedIds((current) => (current.size === ids.length ? new Set() : new Set(ids))),
  }
}
