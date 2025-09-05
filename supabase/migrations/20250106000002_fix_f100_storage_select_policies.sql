-- Fix F100 storage SELECT policies with improved path matching
-- The previous policies might have issues with the position() function

-- Drop the existing SELECT policies to recreate them
DROP POLICY IF EXISTS "storage.f100.select.admin" ON storage.objects;
DROP POLICY IF EXISTS "storage.f100.select.bank_viewer" ON storage.objects;

-- Recreate admin SELECT policy (unchanged)
CREATE POLICY "storage.f100.select.admin"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- Recreate bank_viewer SELECT policy with improved path matching
CREATE POLICY "storage.f100.select.bank_viewer"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
      AND (
        -- Match files in the bank's directory structure
        name LIKE 'bank/' || p.bank_id::text || '/%'
        OR 
        -- Alternative: use starts_with function if available
        starts_with(coalesce(name, ''), 'bank/' || p.bank_id::text || '/')
      )
  )
);

-- Also create a more permissive temporary policy for debugging
-- This can be removed once the issue is resolved
CREATE POLICY "storage.f100.select.bank_viewer_debug"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
  )
);

-- Let's also check if we need to enable RLS on the storage.objects table
-- (This might already be enabled, but let's make sure)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
