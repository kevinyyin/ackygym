-- Lets each user order their own routines (Train › Reorder). Existing routines
-- keep their current alphabetical order, per owner, as the starting order.
alter table public.routines add column position integer;

update public.routines r
set position = ranked.rn
from (
  select id, row_number() over (partition by user_id order by name) - 1 as rn
  from public.routines
) ranked
where r.id = ranked.id;
