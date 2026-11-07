// Hourly (pg_cron → pg_net): push a creatine reminder to every subscribed device whose owner
// hasn't logged creatine for their local today, from FIRST_HOUR to LAST_HOUR local time.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { reminderDate } from './reminder.js'

webpush.setVapidDetails(
  'https://github.com/kevinyyin/ackygym',
  // Public key also lives in src/pushReminders.js.
  'BPgb42ZFiJoPTFfXL9c5ec-cU_YoSC3Ey2xDKEnCZQibKzox8Y1GTpyqctVnO0vuBQMtuB6fQqlLhkOxY1BisFA',
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const PAYLOAD = JSON.stringify({
  title: 'Creatine',
  body: "You haven't taken your creatine today.",
  tag: 'creatine',
})

Deno.serve(async () => {
  const now = new Date()
  const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('*')
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const due = subscriptions.flatMap((sub) => {
    try {
      const date = reminderDate(now, sub.time_zone, sub.last_notified_at)
      return date ? [{ ...sub, date }] : []
    } catch {
      return [] // unknown time zone string from the client
    }
  })
  if (due.length === 0) return Response.json({ sent: 0, failed: [] })

  const { data: logs, error: logsError } = await supabase
    .from('creatine_logs')
    .select('user_id, date')
    .in('user_id', [...new Set(due.map((sub) => sub.user_id))])
    .in('date', [...new Set(due.map((sub) => sub.date))])
  if (logsError) return Response.json({ error: logsError.message }, { status: 500 })

  const taken = new Set(logs.map((log) => `${log.user_id}|${log.date}`))
  const toRemind = due.filter((sub) => !taken.has(`${sub.user_id}|${sub.date}`))

  const results = await Promise.allSettled(
    toRemind.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          PAYLOAD,
          { TTL: 3600 }, // a stale nag is useless once the next hour's arrives
        )
      } catch (err) {
        // 404/410: the device unsubscribed or the app was removed — stop trying.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        throw err
      }
      await supabase
        .from('push_subscriptions')
        .update({ last_notified_at: now.toISOString() })
        .eq('endpoint', sub.endpoint)
    }),
  )
  const failed = results
    .filter((result) => result.status === 'rejected')
    .map((result) => String(result.reason?.body || result.reason))
  return Response.json({ sent: toRemind.length - failed.length, failed })
})
