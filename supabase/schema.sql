create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.support_feedback (
  id uuid primary key default gen_random_uuid(),
  page_path text,
  problem_slug text,
  rating smallint check (rating between 1 and 5),
  feedback_type text check (feedback_type in ('helpful', 'not_helpful', 'missing_info', 'incorrect', 'other')),
  message text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  normalized_query text,
  result_count integer check (result_count is null or result_count >= 0),
  selected_path text,
  session_token text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  entry_path text,
  status text not null default 'active' check (status in ('active', 'resolved', 'escalated', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  matched_pages jsonb not null default '[]'::jsonb,
  needs_clarification boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.draft_solution_cards (
  id uuid primary key default gen_random_uuid(),
  source_session_id uuid references public.ai_sessions(id) on delete set null,
  problem_slug text,
  title text not null,
  likely_cause text,
  recommended_grit text,
  method text check (method is null or method in ('wet', 'dry', 'wet_or_dry', 'unknown')),
  steps jsonb not null default '[]'::jsonb,
  avoid jsonb not null default '[]'::jsonb,
  success_check text,
  next_step text,
  validation_notes text,
  status text not null default 'draft' check (status in ('draft', 'needs_validation', 'approved', 'rejected')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_sync_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('problem', 'grit', 'product', 'how_to', 'faq', 'draft_solution_card')),
  entity_id text not null,
  action text not null check (action in ('create', 'update', 'delete', 'publish')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  queued_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_ai_sessions_updated_at
before update on public.ai_sessions
for each row execute function public.set_updated_at();

create trigger set_draft_solution_cards_updated_at
before update on public.draft_solution_cards
for each row execute function public.set_updated_at();

create trigger set_content_sync_queue_updated_at
before update on public.content_sync_queue
for each row execute function public.set_updated_at();

create index if not exists support_feedback_created_at_idx on public.support_feedback (created_at desc);
create index if not exists support_feedback_problem_slug_idx on public.support_feedback (problem_slug);
create index if not exists support_feedback_page_path_idx on public.support_feedback (page_path);

create index if not exists search_logs_created_at_idx on public.search_logs (created_at desc);
create index if not exists search_logs_normalized_query_idx on public.search_logs (normalized_query);
create index if not exists search_logs_session_token_idx on public.search_logs (session_token);

create index if not exists ai_sessions_session_token_idx on public.ai_sessions (session_token);
create index if not exists ai_sessions_status_idx on public.ai_sessions (status);
create index if not exists ai_sessions_updated_at_idx on public.ai_sessions (updated_at desc);

create index if not exists ai_messages_session_id_created_at_idx on public.ai_messages (session_id, created_at);
create index if not exists ai_messages_role_idx on public.ai_messages (role);

create index if not exists draft_solution_cards_status_idx on public.draft_solution_cards (status);
create index if not exists draft_solution_cards_problem_slug_idx on public.draft_solution_cards (problem_slug);
create index if not exists draft_solution_cards_updated_at_idx on public.draft_solution_cards (updated_at desc);

create index if not exists content_sync_queue_status_idx on public.content_sync_queue (status, queued_at);
create index if not exists content_sync_queue_entity_idx on public.content_sync_queue (entity_type, entity_id);
