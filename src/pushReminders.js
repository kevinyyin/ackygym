import { supabase } from './supabaseClient'

// Public half of the VAPID pair; the private half is the VAPID_PRIVATE_KEY edge function secret.
const VAPID_PUBLIC_KEY =
  'BPgb42ZFiJoPTFfXL9c5ec-cU_YoSC3Ey2xDKEnCZQibKzox8Y1GTpyqctVnO0vuBQMtuB6fQqlLhkOxY1BisFA'

export const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window

export async function getPushSubscription() {
  if (!pushSupported) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

// Must be called from a tap: iOS only allows the permission prompt on a user gesture.
export async function enablePushReminders(userId) {
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Notifications are blocked — allow them for Ackygym in your phone settings.')
  }
  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    }))
  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint,
    user_id: userId,
    p256dh: keys.p256dh,
    auth: keys.auth,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  if (error) throw error
}

export async function disablePushReminders() {
  const subscription = await getPushSubscription()
  if (!subscription) return
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  if (error) throw error
  await subscription.unsubscribe()
}
