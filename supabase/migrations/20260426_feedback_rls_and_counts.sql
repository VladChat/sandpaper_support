-- Ensure feedback inserts work for public site usage and expose
-- count-only data through a restricted public view.

alter table if exists public.support_feedback enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant insert on table public.support_feedback to anon;
grant select on table public.support_feedback to authenticated, service_role;
revoke select on table public.support_feedback from anon;

drop policy if exists "Anonymous users can submit support feedback" on public.support_feedback;
create policy "Anonymous users can submit support feedback"
on public.support_feedback
for insert
to anon
with check (true);

drop policy if exists "Service role can manage support feedback" on public.support_feedback;
create policy "Service role can manage support feedback"
on public.support_feedback
for all
to service_role
using (true)
with check (true);

drop policy if exists "Admins can read support feedback" on public.support_feedback;
create policy "Admins can read support feedback"
on public.support_feedback
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace view public.support_feedback_public_counts as
select
  page_path,
  feedback_type,
  created_at
from public.support_feedback
where page_path is not null
  and feedback_type in ('helpful', 'not_helpful');

grant select on table public.support_feedback_public_counts to anon, authenticated, service_role;
