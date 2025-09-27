-- Replace enum AnalysisPhase usage with numeric phases (1..12)
-- Simplified approach: drop old schema and recreate with numeric phases

begin;

-- 1) Drop dependent objects
drop view if exists public.specialist_dashboard_data;
drop function if exists public.get_specialist_assignments(uuid);

-- 2) Drop and recreate tables with numeric phases
drop table if exists public.specialist_assignments cascade;
drop table if exists public.analysis_sessions cascade;

-- 3) Recreate specialist_assignments with numeric phase
create table public.specialist_assignments (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  bank_id uuid not null references public.banks(id) on delete cascade,
  specialist_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete cascade,
  phase int not null check (phase >= 1 and phase <= 12),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'on_hold')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(farmer_id, phase, specialist_id)
);

-- 4) Recreate analysis_sessions with numeric phase
create table public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  bank_id uuid not null references public.banks(id) on delete cascade,
  specialist_id uuid not null references auth.users(id) on delete cascade,
  phase int not null check (phase >= 1 and phase <= 12),
  session_name text not null,
  context_data jsonb default '{}',
  analysis_prompt text not null,
  llm_response text,
  llm_model text,
  llm_usage jsonb,
  status text default 'pending' check (status in ('pending', 'in_progress', 'completed', 'failed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5) Add RLS policies for specialist_assignments
alter table public.specialist_assignments enable row level security;

create policy "Admins can manage all specialist assignments" on public.specialist_assignments
  for all using (
    exists (
      select 1 from public.profiles 
      where user_id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles 
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Bank viewers can manage assignments for their bank" on public.specialist_assignments
  for all using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() 
        and p.role = 'bank_viewer'
        and p.bank_id = specialist_assignments.bank_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() 
        and p.role = 'bank_viewer'
        and p.bank_id = specialist_assignments.bank_id
    )
  );

create policy "Specialists can view and update their own assignments" on public.specialist_assignments
  for select using (specialist_id = auth.uid());

create policy "Specialists can update their own assignment status" on public.specialist_assignments
  for update using (specialist_id = auth.uid())
  with check (specialist_id = auth.uid());

-- 6) Add RLS policies for analysis_sessions
alter table public.analysis_sessions enable row level security;

create policy "Admins can manage all analysis sessions" on public.analysis_sessions
  for all using (
    exists (
      select 1 from public.profiles 
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Bank viewers can manage sessions for their bank" on public.analysis_sessions
  for all using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() 
        and p.role = 'bank_viewer'
        and p.bank_id = analysis_sessions.bank_id
    )
  );

create policy "Specialists can manage their own analysis sessions" on public.analysis_sessions
  for all using (specialist_id = auth.uid());

-- 7) Add triggers for updated_at
create trigger update_specialist_assignments_updated_at
  before update on public.specialist_assignments
  for each row execute function public.update_updated_at_column();

create trigger update_analysis_sessions_updated_at
  before update on public.analysis_sessions
  for each row execute function public.update_updated_at_column();

-- 8) Recreate specialist_dashboard_data view using numeric phase
create view public.specialist_dashboard_data as
select 
  sa.id as assignment_id,
  sa.farmer_id,
  sa.phase as phase,
  sa.status as assignment_status,
  sa.assigned_at,
  sa.notes,
  f.name as farmer_name,
  f.id_number as farmer_id_number,
  b.name as bank_name,
  count(fdu.id) as data_uploads_count,
  count(case when fdu.data_type::text = 'photo' then 1 end) as photo_count,
  count(case when fdu.data_type::text = 'analysis' then 1 end) as analysis_count,
  count(case when fdu.data_type::text = 'maps' then 1 end) as maps_count,
  count(case when fdu.data_type::text = 'text' then 1 end) as text_count,
  count(as2.id) as analysis_sessions_count,
  max(as2.updated_at) as last_analysis_at
from public.specialist_assignments sa
join public.farmers f on sa.farmer_id = f.id
join public.banks b on sa.bank_id = b.id
left join public.farmer_data_uploads fdu 
  on sa.farmer_id = fdu.farmer_id
  and coalesce((fdu.metadata->>'f100_phase')::int, null) = sa.phase
left join public.analysis_sessions as2
  on sa.farmer_id = as2.farmer_id
  and sa.phase = as2.phase
  and as2.specialist_id = sa.specialist_id
group by sa.id, sa.farmer_id, sa.phase, sa.status, sa.assigned_at, sa.notes, f.name, f.id_number, b.name;

grant select on public.specialist_dashboard_data to authenticated;

-- 9) Recreate get_specialist_assignments function with numeric phase
create or replace function public.get_specialist_assignments(p_specialist_id uuid default auth.uid())
returns table (
  assignment_id uuid,
  farmer_id uuid,
  farmer_name text,
  farmer_id_number text,
  bank_name text,
  phase int,
  status text,
  assigned_at timestamptz,
  data_uploads_count bigint,
  analysis_sessions_count bigint,
  last_activity timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select 
    sa.id,
    sa.farmer_id,
    f.name,
    f.id_number,
    b.name,
    sa.phase,
    sa.status,
    sa.assigned_at,
    count(distinct fdu.id),
    count(distinct as2.id),
    greatest(
      max(fdu.created_at),
      max(as2.updated_at),
      max(cm.created_at)
    )
  from public.specialist_assignments sa
  join public.farmers f on sa.farmer_id = f.id
  join public.banks b on sa.bank_id = b.id
  left join public.farmer_data_uploads fdu
    on sa.farmer_id = fdu.farmer_id
    and coalesce((fdu.metadata->>'f100_phase')::int, null) = sa.phase
  left join public.analysis_sessions as2
    on sa.farmer_id = as2.farmer_id
    and sa.phase = as2.phase
    and as2.specialist_id = sa.specialist_id
  left join public.chat_messages cm
    on sa.farmer_id = cm.farmer_id
    and cm.sender_id = sa.specialist_id
  where sa.specialist_id = p_specialist_id
  group by sa.id, sa.farmer_id, f.name, f.id_number, b.name, sa.phase, sa.status, sa.assigned_at
  order by sa.assigned_at desc;
end;
$$;

grant execute on function public.get_specialist_assignments(uuid) to authenticated;

-- 10) Function to delete specialist assignments (admin only)
create or replace function public.delete_specialist_assignment(p_assignment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check if user is admin
  if not exists (
    select 1 from public.profiles 
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Access denied. Admin role required.';
  end if;

  -- Delete the assignment
  delete from public.specialist_assignments 
  where id = p_assignment_id;
  
  return found;
end;
$$;

grant execute on function public.delete_specialist_assignment(uuid) to authenticated;

commit;


