-- 20260429_support_ai_request_limits.sql
-- Persistent counters for server-side AI request protection.

create table if not exists public.support_ai_request_limits (
  id text primary key,
  session_token text not null,
  ip_hash text not null,
  anonymous_count integer not null default 0,
  turnstile_count integer not null default 0,
  turnstile_verified_at timestamptz,
  recent_request_times jsonb not null default '[]'::jsonb,
  window_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_ai_request_limits_session_idx
  on public.support_ai_request_limits (session_token);

create index if not exists support_ai_request_limits_ip_hash_idx
  on public.support_ai_request_limits (ip_hash);

create index if not exists support_ai_request_limits_updated_at_idx
  on public.support_ai_request_limits (updated_at desc);

alter table public.support_ai_request_limits enable row level security;

-- No public policies are added. The Edge Function must access this table with
-- SUPABASE_SERVICE_ROLE_KEY, so browser clients cannot read or alter counters.
