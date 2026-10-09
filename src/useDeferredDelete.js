import { useCallback, useEffect, useSyncExternalStore } from 'react'

const DELAY_MS = 5500

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
    // `committing` holds ids whose delete request is in flight: they must stay
    // hidden after leaving `pending`, or the row flashes back until the
    // request (and the caller's refetch) lands. `hidden` is the union, rebuilt
    // on every change so useSyncExternalStore sees a new snapshot.
    store = {
      pending: null,
      committing: new Set(),
      hidden: new Set(),
      timeoutId: null,
      mountedCount: 0,
      listeners: new Set(),
    }
    stores.set(key, store)
  }
  return store
}

function notify(key) {
  const store = getStore(key)
  store.hidden = new Set([...(store.pending?.ids ?? []), ...store.committing])
  store.listeners.forEach((listener) => listener())
}

async function runCommit(key, { ids, commit }) {
  const store = getStore(key)
  ids.forEach((id) => store.committing.add(id))
  notify(key)
  try {
    await commit(isForeground(key))
  } finally {
    ids.forEach((id) => store.committing.delete(id))
    notify(key)
  }
}

function subscribe(key, listener) {
  const store = getStore(key)
  store.listeners.add(listener)
  return () => store.listeners.delete(listener)
}

function getHidden(key) {
  return getStore(key).hidden
}

function getMessage(key) {
  return getStore(key).pending?.message ?? ''
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

function stageDeleteFor(key, { ids, message, commit }) {
  const store = getStore(key)
  if (store.pending) {
    // A second delete staged before the first's grace period elapsed —
    // commit the earlier one immediately rather than losing track of it.
    clearTimeout(store.timeoutId)
    runCommit(key, store.pending)
  }

  store.timeoutId = setTimeout(() => {
    const staged = store.pending
    store.pending = null
    runCommit(key, staged)
  }, DELAY_MS)

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
// Storage) until DELAY_MS elapses with no Undo tap; `commit` is the caller's
// real delete logic, so a failure there still surfaces via the caller's own
// onError, just after the delay rather than immediately.
//
// The pending timer always fires and commits the delete regardless of
// whether any page for this `key` is currently mounted — navigating away
// must never silently cancel a confirmed delete. `commit` is called with
// `isForeground` (whether a component for this `key` is currently mounted)
// so callers can skip surfacing errors through a page-level banner for a
// delete that finished while nobody was looking at this feature.
export function useDeferredDelete(key) {
  useEffect(() => {
    mount(key)
    return () => unmount(key)
  }, [key])

  const subscribeToKey = useCallback((listener) => subscribe(key, listener), [key])
  const hidden = useSyncExternalStore(subscribeToKey, () => getHidden(key))
  const message = useSyncExternalStore(subscribeToKey, () => getMessage(key))

  return {
    isPending: (id) => hidden.has(id),
    message,
    stageDelete: (staged) => stageDeleteFor(key, staged),
    undo: () => undoFor(key),
  }
}
