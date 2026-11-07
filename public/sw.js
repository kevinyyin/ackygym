// Push-only service worker: shows reminders sent by the creatine-reminder edge function.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Ackygym', {
      body: data.body,
      icon: '/icon-192.png',
      // Same tag so each hourly nag replaces the last instead of stacking.
      tag: data.tag,
      renotify: Boolean(data.tag),
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) =>
      windows.length > 0 ? windows[0].focus() : self.clients.openWindow('/'),
    ),
  )
})
