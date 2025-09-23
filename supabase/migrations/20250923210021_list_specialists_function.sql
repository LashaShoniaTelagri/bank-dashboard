create or replace function public.list_specialists(p_bank_id uuid default null)
returns table (
  user_id uuid,
  email text,
  bank_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin'
  ) into is_admin;

  if not is_admin then
    return;
  end if;

  return query
  select p.user_id, u.email, p.bank_id
  from profiles p
  join auth.users u on u.id = p.user_id
  where p.role = 'specialist'
    and (
      p_bank_id is null
      or p.bank_id = p_bank_id
      or p.bank_id is null
    );
end;
$$;

grant execute on function public.list_specialists(uuid) to authenticated;

notify pgrst, 'reload schema';