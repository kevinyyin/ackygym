-- Web Push subscriptions (one row per device) + hourly cron that runs the creatine-reminder
-- edge function. The function itself decides who is due (local 10:00–23:00, not yet checked).
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  time_zone text not null,
  last_notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "users manage own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- <ANON_KEY> is the project's public anon key (same value as VITE_SUPABASE_ANON_KEY); it only
-- satisfies the function's JWT check. Extra calls are harmless: the function sends at most one
-- reminder per device per hour.
select cron.schedule(
  'creatine-reminder',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://ovecnpsfpwnkcfphffqq.supabase.co/functions/v1/creatine-reminder',
    headers := jsonb_build_object('Authorization', 'Bearer <ANON_KEY>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
