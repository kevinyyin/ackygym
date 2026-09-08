import { useCallback, useEffect, useSyncExternalStore } from 'react'

const DEFAULT_DELAY_MS = 5500

// One store per caller-supplied `key`, module-level rather than React state,
// so the pending delete survives that key's own page unmounting/remounting
// (e.g. navigating away and back within the grace window) instead of a fresh
// hook instance losing track of it. Independent keys (routines vs exercises
// vs photos) don't interfere with each other's grace periods.
//
// All mutation happens inside these plain, key-addressed functions rather
// than on an object handed to a component's render/effect closures — that
// keeps the mutable singleton out of the compiler's view of "values used in
// an effect," which otherwise flags direct mutation of a render-scoped
// object reference.
const stores = new Map()

function getStore(key) {
  let store = stores.get(key)
  if (!store) {
    store = { pending: null, timeoutId: null, mountedCount: 0, listeners: new Set() }
    stores.set(key, store)
  }
  return store
}

function notify(key) {
  getStore(key).listeners.forEach((listener) => listener())
}

function subscribe(key, listener) {
  const store = getStore(key)
  store.listeners.add(listener)
  return () => store.listeners.delete(listener)
}

function getPending(key) {
  return getStore(key).pending
}

function mount(key) {
  getStore(key).mountedCount += 1
}

function unmount(key) {
  getStore(key).mountedCount -= 1
}

function isForeground(key) {
  return getStore(key).mountedCount > 0
}

function stageDeleteFor(key, { ids, message, commit }, delay) {
  const store = getStore(key)
  if (store.pending) {
    // A second delete staged before the first's grace period elapsed —
    // commit the earlier one immediately rather than losing track of it.
    clearTimeout(store.timeoutId)
    store.pending.commit(isForeground(key))
  }

  store.timeoutId = setTimeout(async () => {
    await commit(isForeground(key))
    store.pending = null
    notify(key)
  }, delay)

  store.pending = { ids: new Set(ids), message, commit }
  notify(key)
}

function undoFor(key) {
  const store = getStore(key)
  if (!store.pending) return
  clearTimeout(store.timeoutId)
  store.pending = null
  notify(key)
}

// Backs an "Undo" toast for a delete that's already been confirmed (via
// ConfirmModal/ConfirmDeleteButton) — this is an additional safety net for
// "I meant to confirm but regret it a few seconds later," not a replacement
// for that confirmation step. Nothing is actually removed from Supabase (or
// Storage) until `delay` elapses with no Undo tap; `commit` is the caller's
// real delete logic, so a failure there still surfaces via the caller's own
// onError, just after the delay rather than immediately.
//
// The pending timer always fires and commits the delete regardless of
// whether any page for this `key` is currently mounted — navigating away
// must never silently cancel a confirmed delete. `commit` is called with
// `isForeground` (whether a component for this `key` is currently mounted)
// so callers can skip surfacing errors through a page-level banner for a
// delete that finished while nobody was looking at this feature.
export function useDeferredDelete(key, { delay = DEFAULT_DELAY_MS } = {}) {
  useEffect(() => {
    mount(key)
    return () => unmount(key)
  }, [key])

  const pending = useSyncExternalStore(
    useCallback((listener) => subscribe(key, listener), [key]),
    () => getPending(key)
  )

  function stageDelete({ ids, message, commit }) {
    stageDeleteFor(key, { ids, message, commit }, delay)
  }

  function undo() {
    undoFor(key)
  }

  return {
    isPending: (id) => pending?.ids.has(id) ?? false,
    message: pending?.message ?? '',
    stageDelete,
    undo,
  }
}
