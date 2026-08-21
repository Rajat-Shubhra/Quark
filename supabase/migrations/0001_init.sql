-- Quark — tasks and notes, owned per user and protected by Row-Level Security.
--
-- Run this in the Supabase dashboard → SQL Editor (or via the Supabase CLI).
-- Every policy is scoped to auth.uid(), so a user can only ever see or touch
-- their own rows; the anon key in the browser is safe because of this.

-- ── tasks ────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Subtasks are just tasks with a parent. The agent's create_subtasks tool
  -- (milestone 6) writes children here.
  parent_id   uuid references public.tasks (id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  description text not null default '',
  status      text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  -- Sparse ordering within a column: a card dropped between two others takes
  -- the midpoint of their positions, so only the moved row needs an update.
  position    double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_user_status_position_idx
  on public.tasks (user_id, status, position);
create index if not exists tasks_parent_idx
  on public.tasks (parent_id);

-- ── notes ────────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- One note per task; null means a standalone page. Unique enforces the 1:1.
  task_id    uuid unique references public.tasks (id) on delete cascade,
  title      text not null default 'Untitled',
  -- BlockNote's block array, stored verbatim.
  content    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id);

-- ── updated_at maintenance ───────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ── Row-Level Security ───────────────────────────────────────────────────
alter table public.tasks enable row level security;
alter table public.notes enable row level security;

-- Separate policies per command so INSERT gets a WITH CHECK that stops a user
-- from writing rows owned by someone else.
drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
  for delete using (auth.uid() = user_id);

drop policy if exists notes_select_own on public.notes;
create policy notes_select_own on public.notes
  for select using (auth.uid() = user_id);

drop policy if exists notes_insert_own on public.notes;
create policy notes_insert_own on public.notes
  for insert with check (auth.uid() = user_id);

drop policy if exists notes_update_own on public.notes;
create policy notes_update_own on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notes_delete_own on public.notes;
create policy notes_delete_own on public.notes
  for delete using (auth.uid() = user_id);
