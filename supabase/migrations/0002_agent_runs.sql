-- Quark — agent runs, and the artifacts the agent produces.
--
-- Run this in the Supabase dashboard → SQL Editor, after 0001_init.sql.
--
-- An agent run records one call to the model for one task: the validated JSON
-- it returned, the actions the server intends to run, and what actually ran.
-- The gate lives here: a run sitting in 'awaiting_confirmation' has NOT had any
-- of its pending_actions executed.

create table if not exists public.agent_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  task_id           uuid not null references public.tasks (id) on delete cascade,
  status            text not null default 'running'
                      check (status in ('running', 'awaiting_confirmation', 'done', 'rejected', 'failed')),
  model             text not null default '',
  -- The model's structured reply, after zod validation. The UI renders from
  -- this and never parses prose.
  response          jsonb,
  -- Tool calls held back pending approval. Empty once they've run.
  pending_actions   jsonb not null default '[]'::jsonb,
  -- What the server actually executed, with real results.
  executed_actions  jsonb not null default '[]'::jsonb,
  error             text not null default '',
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

create index if not exists agent_runs_task_idx on public.agent_runs (task_id, created_at desc);
create index if not exists agent_runs_user_idx on public.agent_runs (user_id);

-- Drafts and documents the agent produces (draft_email / draft_document in
-- milestone 6). One table rather than one per tool.
create table if not exists public.agent_artifacts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  run_id     uuid not null references public.agent_runs (id) on delete cascade,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  kind       text not null check (kind in ('email_draft', 'document')),
  content    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_artifacts_task_idx on public.agent_artifacts (task_id, created_at desc);

drop trigger if exists agent_runs_set_updated_at on public.agent_runs;

-- ── Row-Level Security ───────────────────────────────────────────────────
alter table public.agent_runs enable row level security;
alter table public.agent_artifacts enable row level security;

drop policy if exists agent_runs_select_own on public.agent_runs;
create policy agent_runs_select_own on public.agent_runs
  for select using (auth.uid() = user_id);

drop policy if exists agent_runs_insert_own on public.agent_runs;
create policy agent_runs_insert_own on public.agent_runs
  for insert with check (auth.uid() = user_id);

drop policy if exists agent_runs_update_own on public.agent_runs;
create policy agent_runs_update_own on public.agent_runs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists agent_runs_delete_own on public.agent_runs;
create policy agent_runs_delete_own on public.agent_runs
  for delete using (auth.uid() = user_id);

drop policy if exists agent_artifacts_select_own on public.agent_artifacts;
create policy agent_artifacts_select_own on public.agent_artifacts
  for select using (auth.uid() = user_id);

drop policy if exists agent_artifacts_insert_own on public.agent_artifacts;
create policy agent_artifacts_insert_own on public.agent_artifacts
  for insert with check (auth.uid() = user_id);

drop policy if exists agent_artifacts_update_own on public.agent_artifacts;
create policy agent_artifacts_update_own on public.agent_artifacts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists agent_artifacts_delete_own on public.agent_artifacts;
create policy agent_artifacts_delete_own on public.agent_artifacts
  for delete using (auth.uid() = user_id);
