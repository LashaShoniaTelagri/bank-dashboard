-- Fix specialist_assignments table: add missing assigned_by column and delete functionality
-- This migration adds the missing assigned_by column and admin delete functionality

begin;

-- 1) Add missing assigned_by column to specialist_assignments
alter table public.specialist_assignments 
add column if not exists assigned_by uuid references auth.users(id) on delete cascade;

-- 2) Update existing assignments to have a valid assigned_by (use first admin)
update public.specialist_assignments 
set assigned_by = (
  select user_id from public.profiles 
  where role = 'admin' 
  limit 1
)
where assigned_by is null;

-- 3) Make assigned_by required for future inserts
alter table public.specialist_assignments 
alter column assigned_by set not null;

-- 4) Update RLS policies to be more explicit about permissions
drop policy if exists "Admins can manage all specialist assignments" on public.specialist_assignments;
drop policy if exists "Bank viewers can manage assignments for their bank" on public.specialist_assignments;
drop policy if exists "Specialists can view and update their own assignments" on public.specialist_assignments;
drop policy if exists "Specialists can update their own assignment status" on public.specialist_assignments;

-- Admin policies (full CRUD)
create policy "Admins can select all specialist assignments" on public.specialist_assignments
  for select using (
    exists (
      select 1 from public.profiles 
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can insert specialist assignments" on public.specialist_assignments
  for insert with check (
    exists (
      select 1 from public.profiles 
      where user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update specialist assignments" on public.specialist_assignments
  for update using (
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

create policy "Admins can delete specialist assignments" on public.specialist_assignments
  for delete using (
    exists (
      select 1 from public.profiles 
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Bank viewer policies (limited to their bank)
create policy "Bank viewers can select assignments for their bank" on public.specialist_assignments
  for select using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() 
        and p.role = 'bank_viewer'
        and p.bank_id = specialist_assignments.bank_id
    )
  );

create policy "Bank viewers can insert assignments for their bank" on public.specialist_assignments
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() 
        and p.role = 'bank_viewer'
        and p.bank_id = specialist_assignments.bank_id
    )
  );

create policy "Bank viewers can update assignments for their bank" on public.specialist_assignments
  for update using (
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

-- Specialist policies (read-only for their assignments, update status only)
create policy "Specialists can select their own assignments" on public.specialist_assignments
  for select using (specialist_id = auth.uid());

create policy "Specialists can update their own assignment status" on public.specialist_assignments
  for update using (specialist_id = auth.uid())
  with check (specialist_id = auth.uid());

-- 5) Function to delete specialist assignments (admin only)
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
