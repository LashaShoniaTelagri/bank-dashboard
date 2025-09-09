-- ENUMS
DO $$ BEGIN
    CREATE TYPE public.farmer_type AS ENUM ('person','company');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- BANKS
create table public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo_url text default '',
  created_at timestamptz not null default now()
);

-- USERS / PROFILES
-- Supabase auth.users holds identities; keep app-specific fields in profiles
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','bank_viewer')),
  bank_id uuid references public.banks(id) on delete set null,
  created_at timestamptz not null default now()
);

-- FARMERS
create table public.farmers (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete cascade,
  type public.farmer_type not null,
  name text not null,
  id_number text not null,
  contact_phone text,
  contact_email text,
  contact_address text,
  created_at timestamptz not null default now(),
  unique (bank_id, id_number)
);

-- F-100 REPORTS
create table public.f100 (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.farmers(id) on delete cascade,
  bank_id uuid not null references public.banks(id) on delete cascade, -- denormalized for scoping
  phase int2 not null check (phase between 1 and 12),
  issue_date date not null,
  score numeric(4,1) not null check (score >= 0 and score <= 10),
  file_path text not null,   -- storage path in bucket `f100`
  file_mime text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

-- INDEXES
create index farmers_text_idx on public.farmers using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(id_number,'')));
create index farmers_bank_idx on public.farmers(bank_id);
create index f100_farmer_phase_issue_idx on public.f100(farmer_id, phase, issue_date desc);
create index f100_bank_issue_idx on public.f100(bank_id, issue_date desc);

-- TRIGGER: keep f100.bank_id in sync with farmer.bank_id
create or replace function public.set_f100_bank_id()
returns trigger as $$
begin
  select bank_id into new.bank_id from public.farmers where id = new.farmer_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_f100_bank_id
before insert or update of farmer_id on public.f100
for each row execute function public.set_f100_bank_id();

-- ENABLE RLS
alter table public.banks enable row level security;
alter table public.profiles enable row level security;
alter table public.farmers enable row level security;
alter table public.f100 enable row level security;

-- RLS POLICIES (READ)
-- PROFILES: a user can read their own profile
create policy "profiles.self.read"
on public.profiles for select
to authenticated
using (user_id = auth.uid());

-- BANKS: Admin can read all banks; viewer can read only their bank
create policy "banks.read.admin"
on public.banks for select
to authenticated
using (
  exists(select 1 from public.profiles p
         where p.user_id = auth.uid() and p.role = 'admin')
);

create policy "banks.read.viewer"
on public.banks for select
to authenticated
using (
  exists(select 1 from public.profiles p
         where p.user_id = auth.uid()
           and p.role = 'bank_viewer'
           and p.bank_id = id)
);

-- FARMERS: Admin: read all. Viewer: only their bank.
create policy "farmers.read"
on public.farmers for select
to authenticated
using (
  exists (select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (
              p.role = 'admin'
              or (p.role = 'bank_viewer' and p.bank_id = farmers.bank_id)
            ))
);

-- F100
create policy "f100.read"
on public.f100 for select
to authenticated
using (
  exists (select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (
              p.role = 'admin'
              or (p.role = 'bank_viewer' and p.bank_id = f100.bank_id)
            ))
);

-- RLS POLICIES (WRITE) - Admin only
create policy "banks.write.admin"
on public.banks for all
to authenticated
using (exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'));

create policy "farmers.write.admin"
on public.farmers for all
to authenticated
using (exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'));

create policy "f100.write.admin"
on public.f100 for all
to authenticated
using (exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'));

-- STORAGE BUCKET
insert into storage.buckets (id, name, public) values ('f100', 'f100', false)
ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES
-- READ: Admin can read all; viewer only within their bank path
create policy "storage.f100.read.admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'f100'
  and exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin')
);

create policy "storage.f100.read.viewer"
on storage.objects for select
to authenticated
using (
  bucket_id = 'f100'
  and exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='bank_viewer'
             and position('/bank/'||p.bank_id::text||'/' in coalesce(name,'')) > 0)
);

-- WRITE: Admin only
create policy "storage.f100.write.admin"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'f100'
  and exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin')
);

create policy "storage.f100.update.delete.admin"
on storage.objects for update using (bucket_id='f100' and exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'))
with check (bucket_id='f100' and exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'));

create policy "storage.f100.delete.admin"
on storage.objects for delete using (bucket_id='f100' and exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role='admin'));

-- LATEST F-100 VIEW
create or replace view public.v_latest_f100 as
select distinct on (farmer_id, phase)
  id, farmer_id, bank_id, phase, issue_date, score, file_path, created_at
from public.f100
order by farmer_id, phase, issue_date desc, created_at desc;

-- RPC FUNCTION FOR FILTERED LISTING
create or replace function public.list_farmers_with_latest_f100(
  search text default null,
  from_date date default null,
  to_date date default null,
  filter_bank_id uuid default null
)
returns table (
  farmer_id uuid,
  bank_id uuid,
  name text,
  id_number text,
  latest jsonb
)
language sql
as $$
  with base as (
    select f.*
    from public.farmers f
    where (search is null or to_tsvector('simple', coalesce(f.name,'')||' '||coalesce(f.id_number,'')) @@ plainto_tsquery('simple', search))
      and (filter_bank_id is null or f.bank_id = filter_bank_id)
  ),
  latest as (
    select l.farmer_id,
           jsonb_object_agg(l.phase::text, jsonb_build_object(
             'issue_date', l.issue_date,
             'score', l.score,
             'file_path', l.file_path
           ) order by l.phase) as phase_map
    from public.v_latest_f100 l
    where (from_date is null or l.issue_date >= from_date)
      and (to_date is null or l.issue_date <= to_date)
    group by l.farmer_id
  )
  select b.id as farmer_id, b.bank_id, b.name, b.id_number, coalesce(l.phase_map, '{}'::jsonb) as latest
  from base b
  left join latest l on l.farmer_id = b.id;
$$;