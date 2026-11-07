-- The exercise library is shared, so any signed-in user may rename an entry,
-- matching the existing insert/delete policies. Without an UPDATE policy a
-- rename matched 0 rows and silently did nothing.
create policy "authenticated can update exercises" on public.exercises
  for update to authenticated
  using (true)
  with check (true);

-- Deleting an exercise used to cascade it out of every routine, anyone's.
-- Restrict instead: the app checks first and names the routines using it.
alter table public.routine_exercises
  drop constraint routine_exercises_exercise_id_fkey,
  add constraint routine_exercises_exercise_id_fkey
    foreign key (exercise_id) references public.exercises (id) on delete restrict;
