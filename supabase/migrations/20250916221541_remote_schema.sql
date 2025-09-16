drop trigger if exists "trg_enforce_max_loans" on "public"."farmer_loans";

drop trigger if exists "trg_set_farmer_loan_defaults" on "public"."farmer_loans";

drop policy "farmer_documents.insert.admin" on "public"."farmer_documents";

drop policy "farmer_documents.insert.bank_viewer" on "public"."farmer_documents";

drop policy "farmer_documents.read.admin" on "public"."farmer_documents";

drop policy "farmer_documents.read.bank_viewer" on "public"."farmer_documents";

drop policy "farmer_loans.delete.admin" on "public"."farmer_loans";

drop policy "farmer_loans.insert.admin" on "public"."farmer_loans";

drop policy "farmer_loans.insert.bank_viewer" on "public"."farmer_loans";

drop policy "farmer_loans.read.admin" on "public"."farmer_loans";

drop policy "farmer_loans.read.bank_viewer" on "public"."farmer_loans";

drop policy "farmer_loans.update.admin" on "public"."farmer_loans";

drop policy "farmer_loans.update.bank_viewer" on "public"."farmer_loans";

drop policy "profiles.read.own" on "public"."profiles";

drop policy "profiles.update.own" on "public"."profiles";

drop policy "farmer_documents.update.bank_viewer" on "public"."farmer_documents";

revoke delete on table "public"."farmer_loans" from "anon";

revoke insert on table "public"."farmer_loans" from "anon";

revoke references on table "public"."farmer_loans" from "anon";

revoke select on table "public"."farmer_loans" from "anon";

revoke trigger on table "public"."farmer_loans" from "anon";

revoke truncate on table "public"."farmer_loans" from "anon";

revoke update on table "public"."farmer_loans" from "anon";

revoke delete on table "public"."farmer_loans" from "authenticated";

revoke insert on table "public"."farmer_loans" from "authenticated";

revoke references on table "public"."farmer_loans" from "authenticated";

revoke select on table "public"."farmer_loans" from "authenticated";

revoke trigger on table "public"."farmer_loans" from "authenticated";

revoke truncate on table "public"."farmer_loans" from "authenticated";

revoke update on table "public"."farmer_loans" from "authenticated";

revoke delete on table "public"."farmer_loans" from "service_role";

revoke insert on table "public"."farmer_loans" from "service_role";

revoke references on table "public"."farmer_loans" from "service_role";

revoke select on table "public"."farmer_loans" from "service_role";

revoke trigger on table "public"."farmer_loans" from "service_role";

revoke truncate on table "public"."farmer_loans" from "service_role";

revoke update on table "public"."farmer_loans" from "service_role";

alter table "public"."farmer_loans" drop constraint "farmer_loans_amount_check";

alter table "public"."farmer_loans" drop constraint "farmer_loans_bank_id_fkey";

alter table "public"."farmer_loans" drop constraint "farmer_loans_created_by_fkey";

alter table "public"."farmer_loans" drop constraint "farmer_loans_currency_check";

alter table "public"."farmer_loans" drop constraint "farmer_loans_farmer_id_fkey";

alter table "public"."farmer_loans" drop constraint "farmer_loans_valid_dates";

alter table "public"."profiles" drop constraint "profiles_invitation_status_check";

drop function if exists "public"."enforce_max_loans_per_farmer"();

drop function if exists "public"."set_farmer_loan_defaults"();

drop function if exists "public"."update_invitation_status_on_confirm"();

drop view if exists "public"."v_recent_invitations";

alter table "public"."farmer_loans" drop constraint "farmer_loans_pkey";

drop index if exists "public"."farmer_loans_pkey";

drop index if exists "public"."idx_farmer_loans_bank";

drop index if exists "public"."idx_farmer_loans_farmer";

drop table "public"."farmer_loans";

alter table "public"."farmers" alter column type type "public"."farmer_type" using type::text::"public"."farmer_type";

alter table "public"."farmers" drop column "bank_comment";

alter table "public"."farmers" drop column "cadastral_codes";

alter table "public"."farmers" drop column "location_lat";

alter table "public"."farmers" drop column "location_lng";

alter table "public"."farmers" drop column "location_name";

alter table "public"."farmers" drop column "other_comment";

alter table "public"."farmers" drop column "registration_date";

alter table "public"."farmers" drop column "service_cost_breakdown";

alter table "public"."farmers" drop column "service_cost_selections";

alter table "public"."farmers" drop column "service_cost_tariff";

alter table "public"."farmers" drop column "service_cost_total_eur";

alter table "public"."farmers" alter column "type" drop default;

alter table "public"."profiles" alter column "invitation_status" set default 'accepted'::text;

CREATE INDEX profiles_invitation_status_idx ON public.profiles USING btree (invitation_status, invited_at DESC);

alter table "public"."profiles" add constraint "profiles_invitation_status_check" CHECK ((invitation_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_invitation_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_existing_invitation(user_email text, target_bank_id uuid)
 RETURNS TABLE(invitation_exists boolean, status text, invited_date timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (COUNT(*) > 0) as invitation_exists,  -- ✅ FIXED: Using new column name
    COALESCE(MAX(p.invitation_status), 'none') as status,
    MAX(p.invited_at) as invited_date
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.user_id = au.id
  WHERE au.email::text = user_email  -- ✅ FIXED: Cast email to text
    AND p.bank_id = target_bank_id
    AND p.invitation_status IN ('pending', 'accepted');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_invitation_accepted_on_signin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When user signs in for the first time, mark invitation as accepted
  IF OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL THEN
    UPDATE public.profiles 
    SET 
      invitation_status = 'accepted',
      invitation_accepted_at = NEW.last_sign_in_at
    WHERE user_id = NEW.id 
      AND invitation_status = 'pending'
      AND invited_at IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_invitation_on_signin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- When a user signs in for the first time, mark their invitation as accepted
  IF OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL THEN
    UPDATE public.profiles 
    SET 
      invitation_status = 'accepted',
      invitation_accepted_at = NEW.last_sign_in_at
    WHERE user_id = NEW.id 
      AND invitation_status = 'pending'
      AND invited_at IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$function$
;

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
    -- Fixed status logic: Only show accepted if user has actually signed in
    CASE 
      -- If manually cancelled, respect that
      WHEN p.invitation_status = 'cancelled' THEN 'cancelled'
      -- If invitation is older than 48 hours and never signed in, mark expired
      WHEN p.invited_at IS NOT NULL 
           AND p.invited_at < NOW() - INTERVAL '48 hours' 
           AND (au.last_sign_in_at IS NULL) THEN 'expired'
      -- Only mark as accepted if user has actually signed in (not just email confirmed)
      WHEN p.invitation_status = 'accepted' 
           AND p.invitation_accepted_at IS NOT NULL 
           AND au.last_sign_in_at IS NOT NULL THEN 'accepted'
      -- If auth user is deleted, show cancelled
      WHEN au.deleted_at IS NOT NULL THEN 'cancelled'
      -- Everything else is pending (even if email_confirmed_at is set)
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
    -- Only set created_by if it's not already set and the column exists
    IF NEW.created_by IS NULL THEN
        NEW.created_by = auth.uid();
    END IF;
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
  -- Only update to 'accepted' if user has actually signed in
  UPDATE public.profiles p
  SET 
    invitation_status = 'accepted',
    invitation_accepted_at = COALESCE(p.invitation_accepted_at, au.last_sign_in_at)
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.invitation_status = 'pending'
    AND p.invited_at IS NOT NULL
    AND au.last_sign_in_at IS NOT NULL  -- Key: Only if they've actually signed in
    AND au.deleted_at IS NULL;
    
  -- Update profiles to 'expired' if invitation is older than 48 hours and never signed in
  UPDATE public.profiles p
  SET invitation_status = 'expired'
  FROM auth.users au
  WHERE p.user_id = au.id
    AND p.invitation_status = 'pending'
    AND p.invited_at IS NOT NULL
    AND p.invited_at < NOW() - INTERVAL '48 hours'
    AND (au.last_sign_in_at IS NULL);
$function$
;


  create policy "f100.select.admin"
  on "public"."f100"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "f100.select.bank_viewer"
  on "public"."f100"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = p.bank_id)))));



  create policy "farmer_documents.admin_all"
  on "public"."farmer_documents"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "farmer_documents.bank_viewer_all"
  on "public"."farmer_documents"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text)))))
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text)))));



  create policy "farmer_documents.delete"
  on "public"."farmer_documents"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "farmer_documents.insert"
  on "public"."farmer_documents"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "farmer_documents.read"
  on "public"."farmer_documents"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND ((p.role = 'admin'::text) OR ((p.role = 'bank_viewer'::text) AND (p.bank_id = farmer_documents.bank_id)))))));



  create policy "farmer_documents.update"
  on "public"."farmer_documents"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "Users can update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR ((auth.jwt() ->> 'role'::text) = 'admin'::text)));



  create policy "profiles.manage.admin"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))))
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'admin'::text)))));



  create policy "profiles_select_policy"
  on "public"."profiles"
  as permissive
  for select
  to public
using (true);



  create policy "profiles_update_policy"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "farmer_documents.update.bank_viewer"
  on "public"."farmer_documents"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = p.bank_id)))))
with check ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'bank_viewer'::text) AND (p.bank_id = p.bank_id)))));



