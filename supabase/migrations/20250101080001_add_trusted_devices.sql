-- TRUSTED DEVICES TABLE
-- Stores device fingerprints for 30-day 2FA bypass
create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  device_fingerprint text not null,
  device_info jsonb not null default '{}', -- Browser, OS, IP, etc.
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz default now(),
  
  -- Ensure unique device per user
  unique (user_email, device_fingerprint)
);

-- INDEXES
create index trusted_devices_email_idx on public.trusted_devices(user_email);
create index trusted_devices_fingerprint_idx on public.trusted_devices(device_fingerprint);
create index trusted_devices_expires_idx on public.trusted_devices(expires_at);

-- RLS POLICIES
alter table public.trusted_devices enable row level security;

-- Users can only see their own trusted devices
create policy "Users can view their own trusted devices" on public.trusted_devices
for select using (
  user_email = auth.jwt() ->> 'email'
);

-- Users can insert their own trusted devices
create policy "Users can create their own trusted devices" on public.trusted_devices
for insert with check (
  user_email = auth.jwt() ->> 'email'
);

-- Users can update their own trusted devices (last_used_at)
create policy "Users can update their own trusted devices" on public.trusted_devices
for update using (
  user_email = auth.jwt() ->> 'email'
);

-- Users can delete their own trusted devices
create policy "Users can delete their own trusted devices" on public.trusted_devices
for delete using (
  user_email = auth.jwt() ->> 'email'
);

-- CLEANUP FUNCTION
-- Automatically remove expired trusted devices
create or replace function cleanup_expired_trusted_devices()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.trusted_devices
  where expires_at < now();
end;
$$;

-- SCHEDULED CLEANUP
-- Run cleanup daily using pg_cron (if available) or manually
comment on function cleanup_expired_trusted_devices() is 
'Removes expired trusted devices. Should be run daily via cron job or manual execution.';

-- HELPER FUNCTION 
-- Check if a device is trusted for a user
create or replace function is_device_trusted(
  p_user_email text,
  p_device_fingerprint text
)
returns boolean
language plpgsql
security definer
as $$
declare
  device_count integer;
begin
  select count(*)
  into device_count
  from public.trusted_devices
  where user_email = p_user_email
    and device_fingerprint = p_device_fingerprint
    and expires_at > now();
  
  return device_count > 0;
end;
$$;

-- HELPER FUNCTION
-- Add or update a trusted device
create or replace function add_trusted_device(
  p_user_email text,
  p_device_fingerprint text,
  p_device_info jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  device_id uuid;
begin
  -- Insert or update trusted device (upsert)
  insert into public.trusted_devices (
    user_email,
    device_fingerprint,
    device_info,
    expires_at,
    last_used_at
  )
  values (
    p_user_email,
    p_device_fingerprint,
    p_device_info,
    now() + interval '30 days',
    now()
  )
  on conflict (user_email, device_fingerprint)
  do update set
    expires_at = now() + interval '30 days',
    last_used_at = now(),
    device_info = p_device_info
  returning id into device_id;
  
  return device_id;
end;
$$;
