drop policy "f100.select.admin" on "public"."f100";

drop policy "f100.select.bank_viewer" on "public"."f100";

drop policy "farmer_documents.admin_all" on "public"."farmer_documents";

drop policy "farmer_documents.bank_viewer_all" on "public"."farmer_documents";

drop policy "farmer_documents.delete" on "public"."farmer_documents";

drop policy "farmer_documents.insert" on "public"."farmer_documents";

drop policy "farmer_documents.read" on "public"."farmer_documents";

drop policy "farmer_documents.update" on "public"."farmer_documents";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Users can view own profile" on "public"."profiles";

drop policy "profiles.manage.admin" on "public"."profiles";

drop policy "profiles_select_policy" on "public"."profiles";

drop policy "profiles_update_policy" on "public"."profiles";

drop policy "farmer_documents.update.bank_viewer" on "public"."farmer_documents";

alter table "public"."profiles" drop constraint "profiles_invitation_status_check";

drop function if exists "public"."check_existing_invitation"(user_email text, target_bank_id uuid);

drop function if exists "public"."mark_invitation_accepted_on_signin"();

drop function if exists "public"."update_invitation_on_signin"();

drop index if exists "public"."profiles_invitation_status_idx";

create table "public"."farmer_loans" (
    "id" uuid not null default gen_random_uuid(),
    "farmer_id" uuid not null,
    "bank_id" uuid not null,
    "amount" numeric(14,2) not null,
    "currency" text not null,
    "start_date" date not null,
    "end_date" date not null,
    "issuance_date" date not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "created_by" uuid
);


alter table "public"."farmer_loans" enable row level security;

alter table "public"."farmers" add column "bank_comment" text;

alter table "public"."farmers" add column "cadastral_codes" text[];

alter table "public"."farmers" add column "location_lat" double precision;

alter table "public"."farmers" add column "location_lng" double precision;

alter table "public"."farmers" add column "location_name" text;

alter table "public"."farmers" add column "other_comment" text;

alter table "public"."farmers" add column "registration_date" timestamp with time zone default now();

alter table "public"."farmers" add column "service_cost_breakdown" jsonb;

alter table "public"."farmers" add column "service_cost_selections" jsonb;

alter table "public"."farmers" add column "service_cost_tariff" text;

alter table "public"."farmers" add column "service_cost_total_eur" numeric(14,2);

alter table "public"."farmers" alter column "type" set default 'company'::farmer_type;

alter table "public"."profiles" alter column "invitation_status" set default 'pending'::text;

CREATE UNIQUE INDEX farmer_loans_pkey ON public.farmer_loans USING btree (id);

CREATE INDEX idx_farmer_loans_bank ON public.farmer_loans USING btree (bank_id);

CREATE INDEX idx_farmer_loans_farmer ON public.farmer_loans USING btree (farmer_id);

alter table "public"."farmer_loans" add constraint "farmer_loans_pkey" PRIMARY KEY using index "farmer_loans_pkey";

alter table "public"."farmer_loans" add constraint "farmer_loans_amount_check" CHECK ((amount >= (0)::numeric)) not valid;

alter table "public"."farmer_loans" validate constraint "farmer_loans_amount_check";

alter table "public"."farmer_loans" add constraint "farmer_loans_bank_id_fkey" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE CASCADE not valid;

alter table "public"."farmer_loans" validate constraint "farmer_loans_bank_id_fkey";

alter table "public"."farmer_loans" add constraint "farmer_loans_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."farmer_loans" validate constraint "farmer_loans_created_by_fkey";

alter table "public"."farmer_loans" add constraint "farmer_loans_currency_check" CHECK ((currency = ANY (ARRAY['GEL'::text, 'USD'::text, 'EUR'::text]))) not valid;

alter table "public"."farmer_loans" validate constraint "farmer_loans_currency_check";

alter table "public"."farmer_loans" add constraint "farmer_loans_farmer_id_fkey" FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE not valid;

alter table "public"."farmer_loans" validate constraint "farmer_loans_farmer_id_fkey";

alter table "public"."farmer_loans" add constraint "farmer_loans_valid_dates" CHECK ((start_date <= end_date)) not valid;

alter table "public"."farmer_loans" validate constraint "farmer_loans_valid_dates";

alter table "public"."profiles" add constraint "profiles_invitation_status_check" CHECK ((invitation_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_invitation_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enforce_max_loans_per_farmer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  loan_count integer;
BEGIN
  SELECT COUNT(*) INTO loan_count FROM public.farmer_loans WHERE farmer_id = NEW.farmer_id;
  IF TG_OP = 'INSERT' THEN
    IF loan_count >= 15 THEN
      RAISE EXCEPTION 'A farmer can have at most 15 loans.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_farmer_loan_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT bank_id INTO NEW.bank_id FROM public.farmers WHERE id = NEW.farmer_id;
    NEW.created_by := auth.uid();
    NEW.updated_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_invitation_status_on_confirm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update the invitation status to 'accepted' when user confirms email
  UPDATE public.profiles 
  SET 
    invitation_status = 'accepted',
    invitation_accepted_at = NOW()
  WHERE user_id = NEW.id 
    AND invitation_status = 'pending'
    AND invited_at IS NOT NULL
    AND NEW.email_confirmed_at IS NOT NULL
    AND OLD.email_confirmed_at IS NULL;
    
  RETURN NEW;
END;
$function$
;

create or replace view "public"."v_recent_invitations" as  SELECT p.user_id,
    p.role,
    p.bank_id,
    b.name AS bank_name,
    p.invited_by,
    p.invited_at,
    p.invitation_accepted_at,
    p.invitation_status,
    p.created_at,
    au.email
   FROM ((profiles p
     LEFT JOIN banks b ON ((p.bank_id = b.id)))
     LEFT JOIN auth.users au ON ((p.user_id = au.id)))
  WHERE (p.invited_at IS NOT NULL)
  ORDER BY p.invited_at DESC;


CREATE OR REPLACE FUNCTION public.get_invitation_details()
 RETURNS TABLE(user_id uuid, email text, role text, bank_id uuid, bank_name text, invited_by text, invited_at timestamp with time zone, invitation_accepted_at timestamp with time zone, invitation_status text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    COALESCE(au.email, au.raw_user_meta_data->>'email') as email,
    p.role,
    p.bank_id,
    COALESCE(b.name, 'Unknown Bank') as bank_name,
    COALESCE(p.invited_by, 'Unknown') as invited_by,
    p.invited_at,
    p.invitation_accepted_at,
    -- Determine status based on actual user state
    CASE 
      -- If user has confirmed their email and has a valid auth record, they're accepted
      WHEN au.email_confirmed_at IS NOT NULL AND au.deleted_at IS NULL THEN 'accepted'
      -- If invitation was sent more than 48 hours ago and no confirmation, it's expired
      WHEN p.invited_at IS NOT NULL AND p.invited_at < NOW() - INTERVAL '48 hours' AND au.email_confirmed_at IS NULL THEN 'expired'
      -- If manually cancelled or status explicitly set
      WHEN p.invitation_status = 'cancelled' THEN 'cancelled'
      -- Otherwise it's still pending
      ELSE 'pending'
    END as invitation_status,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.banks b ON p.bank_id = b.id  
  LEFT JOIN auth.users au ON p.user_id = au.id
  WHERE p.invited_at IS NOT NULL
  ORDER BY p.invited_at DESC
  LIMIT 10;
$function$
;

CREATE OR REPLACE FUNCTION public.set_farmer_document_created_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
    BEGIN
      NEW.created_by = auth.uid();
      RETURN NEW;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.sync_invitation_statuses()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Update profiles to 'accepted' if the user has confirmed their email
  UPDATE public.profiles p
  SET 
    invitation_status = 'accepted',
    invitation_accepted_at = COALESCE(p.invitation_accepted_at, au.email_confirmed_at)
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.invitation_status = 'pending'
    AND p.invited_at IS NOT NULL
    AND au.email_confirmed_at IS NOT NULL;
    
  -- Update profiles to 'expired' if invitation is older than 48 hours and not confirmed
  UPDATE public.profiles p
  SET invitation_status = 'expired'
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.invitation_status = 'pending'
    AND p.invited_at IS NOT NULL
    AND p.invited_at < NOW() - INTERVAL '48 hours'
    AND au.email_confirmed_at IS NULL;
$function$
;

grant delete on table "public"."farmer_loans" to "anon";

grant insert on table "public"."farmer_loans" to "anon";

grant references on table "public"."farmer_loans" to "anon";

grant select on table "public"."farmer_loans" to "anon";

grant trigger on table "public"."farmer_loans" to "anon";

grant truncate on table "public"."farmer_loans" to "anon";

grant update on table "public"."farmer_loans" to "anon";

grant delete on table "public"."farmer_loans" to "authenticated";

grant insert on table "public"."farmer_loans" to "authenticated";

grant references on table "public"."farmer_loans" to "authenticated";

grant select on table "public"."farmer_loans" to "authenticated";

grant trigger on table "public"."farmer_loans" to "authenticated";

grant truncate on table "public"."farmer_loans" to "authenticated";

grant update on table "public"."farmer_loans" to "authenticated";

grant delete on table "public"."farmer_loans" to "service_role";

grant insert on table "public"."farmer_loans" to "service_role";

grant references on table "public"."farmer_loans" to "service_role";

grant select on table "public"."farmer_loans" to "service_role";

grant trigger on table "public"."farmer_loans" to "service_role";

grant truncate on table "public"."farmer_loans" to "service_role";

grant update on table "public"."farmer_loans" to "service_role";

create policy "farmer_documents.insert.admin"
on "public"."farmer_documents"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));


create policy "farmer_documents.insert.bank_viewer"
on "public"."farmer_documents"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = farmer_documents.bank_id)))));


create policy "farmer_documents.read.admin"
on "public"."farmer_documents"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));


create policy "farmer_documents.read.bank_viewer"
on "public"."farmer_documents"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = farmer_documents.bank_id)))));


create policy "farmer_loans.delete.admin"
on "public"."farmer_loans"
as permissive
for delete
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));


create policy "farmer_loans.insert.admin"
on "public"."farmer_loans"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));


create policy "farmer_loans.insert.bank_viewer"
on "public"."farmer_loans"
as permissive
for insert
to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = p.bank_id)))));


create policy "farmer_loans.read.admin"
on "public"."farmer_loans"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));


create policy "farmer_loans.read.bank_viewer"
on "public"."farmer_loans"
as permissive
for select
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = p.bank_id)))));


create policy "farmer_loans.update.admin"
on "public"."farmer_loans"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));


create policy "farmer_loans.update.bank_viewer"
on "public"."farmer_loans"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = p.bank_id)))))
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = p.bank_id)))));


create policy "profiles.read.own"
on "public"."profiles"
as permissive
for select
to authenticated
using ((user_id = auth.uid()));


create policy "profiles.update.own"
on "public"."profiles"
as permissive
for update
to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


create policy "farmer_documents.update.bank_viewer"
on "public"."farmer_documents"
as permissive
for update
to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = farmer_documents.bank_id)))))
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = farmer_documents.bank_id)))));


CREATE TRIGGER trg_enforce_max_loans BEFORE INSERT ON public.farmer_loans FOR EACH ROW EXECUTE FUNCTION enforce_max_loans_per_farmer();

CREATE TRIGGER trg_set_farmer_loan_defaults BEFORE INSERT OR UPDATE ON public.farmer_loans FOR EACH ROW EXECUTE FUNCTION set_farmer_loan_defaults();


