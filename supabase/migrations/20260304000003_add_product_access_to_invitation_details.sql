-- SS-249: Extend get_invitation_details with products_enabled + audit table

-- Product access changes audit log
CREATE TABLE IF NOT EXISTS public.product_access_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  product_bit INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('grant', 'revoke')),
  products_before INTEGER NOT NULL,
  products_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.product_access_changes IS 'Audit log tracking product access grant/revoke operations for compliance';

CREATE INDEX idx_pac_target ON public.product_access_changes(target_user_id, created_at DESC);
CREATE INDEX idx_pac_changed_by ON public.product_access_changes(changed_by, created_at DESC);

ALTER TABLE public.product_access_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pac_admin_read"
  ON public.product_access_changes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "pac_admin_insert"
  ON public.product_access_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Recreate get_invitation_details with products_enabled
DROP FUNCTION IF EXISTS public.get_invitation_details();

CREATE OR REPLACE FUNCTION public.get_invitation_details()
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  bank_id uuid,
  bank_name text,
  invited_by text,
  invited_at timestamptz,
  invitation_accepted_at timestamptz,
  invitation_status text,
  created_at timestamptz,
  invitation_id uuid,
  invitation_type text,
  expires_at timestamptz,
  clicks_count integer,
  last_clicked_at timestamptz,
  is_active boolean,
  last_sign_in_at timestamptz,
  products_enabled integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  WITH invitation_users AS (
    SELECT 
      i.user_id,
      i.email,
      COALESCE(i.role, 'Unknown') as role,
      i.bank_id,
      COALESCE(b.name, 'N/A') as bank_name,
      COALESCE(i.invited_by, 'System') as invited_by,
      i.invited_at,
      i.completed_at as invitation_accepted_at,
      CASE 
        WHEN i.status = 'completed' THEN 'accepted'
        WHEN i.status = 'expired' THEN 'expired'
        WHEN i.status = 'cancelled' THEN 'cancelled'
        WHEN i.expires_at < NOW() THEN 'expired'
        ELSE 'pending'
      END as invitation_status,
      i.created_at,
      i.id as invitation_id,
      COALESCE(i.type, 'invitation') as invitation_type,
      i.expires_at,
      i.clicks_count,
      i.last_clicked_at,
      CASE WHEN au.deleted_at IS NULL THEN true ELSE false END as is_active,
      au.last_sign_in_at,
      COALESCE(p.products_enabled, 1) as products_enabled
    FROM public.invitations i
    LEFT JOIN public.banks b ON i.bank_id = b.id
    LEFT JOIN auth.users au ON i.user_id = au.id
    LEFT JOIN public.profiles p ON i.user_id = p.user_id
    WHERE i.type = 'invitation' OR i.type IS NULL
  ),
  profile_users AS (
    SELECT 
      p.user_id,
      COALESCE(au.email, au.raw_user_meta_data->>'email') as email,
      p.role,
      p.bank_id,
      COALESCE(b.name, 'N/A') as bank_name,
      COALESCE(p.invited_by, 'Direct Creation') as invited_by,
      p.invited_at,
      p.invitation_accepted_at,
      CASE 
        WHEN au.deleted_at IS NOT NULL THEN 'deleted'
        WHEN au.email_confirmed_at IS NOT NULL THEN 'accepted'
        WHEN p.invitation_status IS NOT NULL THEN p.invitation_status
        ELSE 'accepted'
      END as invitation_status,
      p.created_at,
      NULL::uuid as invitation_id,
      'profile' as invitation_type,
      NULL::timestamptz as expires_at,
      0 as clicks_count,
      NULL::timestamptz as last_clicked_at,
      CASE WHEN au.deleted_at IS NULL THEN true ELSE false END as is_active,
      au.last_sign_in_at,
      COALESCE(p.products_enabled, 1) as products_enabled
    FROM public.profiles p
    LEFT JOIN public.banks b ON p.bank_id = b.id
    LEFT JOIN auth.users au ON p.user_id = au.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.invitations i2
      WHERE i2.user_id = p.user_id
      AND i2.type = 'invitation'
    )
  )
  SELECT * FROM invitation_users
  UNION ALL
  SELECT * FROM profile_users
  ORDER BY invited_at DESC NULLS LAST, created_at DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_details() TO authenticated;

COMMENT ON FUNCTION public.get_invitation_details() 
IS 'Returns ALL users with invitation status, activity metadata, and products_enabled bitmask for admin dashboard.';
