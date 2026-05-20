-- Resolve Supabase linter findings: 0002_auth_users_exposed and 0010_security_definer_view.
-- v_recent_invitations is unused by app code (UsersManagement uses get_invitation_details RPC).
-- v_latest_f100 is consumed only inside the SECURITY DEFINER RPC list_farmers_with_latest_f100,
-- so flipping it to security_invoker has no functional impact on callers.
-- specialist_dashboard_data has no application callers today.

DROP VIEW IF EXISTS public.v_recent_invitations;

ALTER VIEW public.v_latest_f100 SET (security_invoker = on);

ALTER VIEW public.specialist_dashboard_data SET (security_invoker = on);
