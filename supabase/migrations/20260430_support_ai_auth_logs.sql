-- supabase/migrations/20260430_support_ai_auth_logs.sql
-- Purpose: add AI request and feedback logs for authenticated support chat users.

create extension if not exists pgcrypto;

create table if not exists public.ai_request_logs (
  id uuid primary key default gen_random_uuid(),
  session_token text,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  question text not null,
  answer text,
  page_url text,
  page_title text,
  source_type text,
  solution_id text,
  solution_slug text,
  matched_card_id text,
  matched_pages jsonb not null default '[]'::jsonb,
  retrieved_content jsonb not null default '{}'::jsonb,
  ip_address text,
  ip_hash text,
  user_agent text,
  status text not null default 'success' check (status in ('success', 'blocked', 'error')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ai_request_logs_created_at_idx
  on public.ai_request_logs (created_at desc);

create index if not exists ai_request_logs_user_id_created_at_idx
  on public.ai_request_logs (user_id, created_at desc);

create index if not exists ai_request_logs_user_email_created_at_idx
  on public.ai_request_logs (user_email, created_at desc);

create index if not exists ai_request_logs_source_type_created_at_idx
  on public.ai_request_logs (source_type, created_at desc);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  request_log_id uuid references public.ai_request_logs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  feedback_type text not null check (feedback_type in ('like', 'dislike', 'helpful', 'not_helpful')),
  comment text,
  page_path text,
  problem_slug text,
  created_at timestamptz not null default now()
);

create index if not exists ai_feedback_request_log_id_idx
  on public.ai_feedback (request_log_id);

create index if not exists ai_feedback_user_id_created_at_idx
  on public.ai_feedback (user_id, created_at desc);

create index if not exists ai_feedback_created_at_idx
  on public.ai_feedback (created_at desc);

alter table public.ai_request_logs enable row level security;
alter table public.ai_feedback enable row level security;

drop policy if exists "service_role can manage ai_request_logs" on public.ai_request_logs;
create policy "service_role can manage ai_request_logs"
  on public.ai_request_logs
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role can manage ai_feedback" on public.ai_feedback;
create policy "service_role can manage ai_feedback"
  on public.ai_feedback
  for all
  to service_role
  using (true)
  with check (true);

-- Existing support feedback is submitted from the public frontend.
-- This insert-only policy lets the frontend attach like/dislike feedback to a request_log_id.
drop policy if exists "public can insert ai_feedback" on public.ai_feedback;
create policy "public can insert ai_feedback"
  on public.ai_feedback
  for insert
  to anon, authenticated
  with check (feedback_type in ('like', 'dislike', 'helpful', 'not_helpful'));
