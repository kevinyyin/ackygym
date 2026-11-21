-- Security audit fixes (2026-11-20).

-- 1. "Stop sharing" didn't revoke access: the shared-object policy matched any shared row with
--    the same path, so another user could insert their own shared row pointing at someone else's
--    file. Only the file owner's row may now grant access, and rows must point into the owner's folder.
drop policy "Users can view shared progress photo objects" on storage.objects;
create policy "Users can view shared progress photo objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and exists (
      select 1 from public.progress_photos pp
      where pp.path = objects.name
        and pp.shared = true
        and pp.user_id::text = (storage.foldername(objects.name))[1]
    )
  );

alter policy "Users can insert own progress photos" on public.progress_photos
  with check (auth.uid() = user_id and (storage.foldername(path))[1] = auth.uid()::text);
alter policy "Users can update own progress photos" on public.progress_photos
  with check (auth.uid() = user_id and (storage.foldername(path))[1] = auth.uid()::text);

-- 2. water_logs policies were granted to PUBLIC, so the anon key could read every user's logs.
alter policy "authenticated can read all water logs" on public.water_logs to authenticated;
alter policy "users write own water logs" on public.water_logs to authenticated;

-- 3. Updating a set didn't re-check workout ownership (insert does), so a set could be moved
--    into another user's workout.
alter policy "users can update own sets" on public.sets
  with check (
    (select auth.uid()) = user_id
    and workout_id in (select id from public.workouts where user_id = (select auth.uid()))
  );
