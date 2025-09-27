-- AI chat persistence and specialist context tables

begin;

-- 1. Create ai_chat_sessions to group runs per assignment/farmer
create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  specialist_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid references public.specialist_assignments(id) on delete set null,
  phase int not null check (phase between 1 and 12),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create ai_chat_messages for conversation history
create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions(id) on delete cascade,
  sender_role text not null check (sender_role in ('specialist','assistant')),
  content text not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- 3. Table to capture which data uploads were referenced in a run
create table if not exists public.ai_chat_context_files (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.ai_chat_messages(id) on delete cascade,
  data_upload_id uuid not null references public.farmer_data_uploads(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 4. RLS policies

alter table public.ai_chat_sessions enable row level security;
alter table public.ai_chat_messages enable row level security;
alter table public.ai_chat_context_files enable row level security;

drop policy if exists "Specialists manage own chat sessions" on public.ai_chat_sessions;
create policy "Specialists manage own chat sessions" on public.ai_chat_sessions
  for all
  using (specialist_id = auth.uid())
  with check (specialist_id = auth.uid());

-- Specialists can access messages belonging to their sessions
drop policy if exists "Specialists view session messages" on public.ai_chat_messages;
create policy "Specialists view session messages" on public.ai_chat_messages
  for select using (
    exists (
      select 1 from public.ai_chat_sessions s
      where s.id = ai_chat_messages.session_id
        and s.specialist_id = auth.uid()
    )
  );

drop policy if exists "Specialists insert session messages" on public.ai_chat_messages;
create policy "Specialists insert session messages" on public.ai_chat_messages
  for insert with check (
    exists (
      select 1 from public.ai_chat_sessions s
      where s.id = ai_chat_messages.session_id
        and s.specialist_id = auth.uid()
    )
  );

-- Context files only accessible if session is owned by specialist
drop policy if exists "Specialists view context files" on public.ai_chat_context_files;
create policy "Specialists view context files" on public.ai_chat_context_files
  for select using (
    exists (
      select 1 from public.ai_chat_messages m
      join public.ai_chat_sessions s on s.id = m.session_id
      where m.id = ai_chat_context_files.message_id
        and s.specialist_id = auth.uid()
    )
  );

drop policy if exists "Specialists insert context files" on public.ai_chat_context_files;
create policy "Specialists insert context files" on public.ai_chat_context_files
  for insert with check (
    exists (
      select 1 from public.ai_chat_messages m
      join public.ai_chat_sessions s on s.id = m.session_id
      where m.id = ai_chat_context_files.message_id
        and s.specialist_id = auth.uid()
    )
  );

-- 5. Triggers for updated_at
create trigger update_ai_chat_sessions_updated_at
  before update on public.ai_chat_sessions
  for each row execute function public.update_updated_at_column();

commit;

