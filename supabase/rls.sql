alter table public.support_feedback enable row level security;
alter table public.search_logs enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.ai_messages enable row level security;
alter table public.draft_solution_cards enable row level security;
alter table public.content_sync_queue enable row level security;

create policy "Anonymous users can submit support feedback"
on public.support_feedback
for insert
to anon
with check (true);

create policy "Service role can manage support feedback"
on public.support_feedback
for all
to service_role
using (true)
with check (true);

create policy "Admins can read support feedback"
on public.support_feedback
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Anonymous users can submit search logs"
on public.search_logs
for insert
to anon
with check (true);

create policy "Service role can manage search logs"
on public.search_logs
for all
to service_role
using (true)
with check (true);

create policy "Admins can read search logs"
on public.search_logs
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Service role can manage AI sessions"
on public.ai_sessions
for all
to service_role
using (true)
with check (true);

create policy "Service role can manage AI messages"
on public.ai_messages
for all
to service_role
using (true)
with check (true);

create policy "Service role can manage draft solution cards"
on public.draft_solution_cards
for all
to service_role
using (true)
with check (true);

create policy "Admins can read draft solution cards"
on public.draft_solution_cards
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can update draft solution cards"
on public.draft_solution_cards
for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Service role can manage content sync queue"
on public.content_sync_queue
for all
to service_role
using (true)
with check (true);

create policy "Admins can read content sync queue"
on public.content_sync_queue
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
