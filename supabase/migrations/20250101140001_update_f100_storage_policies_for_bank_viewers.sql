-- Update F100 storage policies to allow bank viewers to upload F100 files
-- This fixes the issue where bank viewers cannot upload F100 reports

-- Drop existing restrictive write policies for F100 storage
DROP POLICY IF EXISTS "storage.f100.write.admin" ON storage.objects;
DROP POLICY IF EXISTS "storage.f100.update.delete.admin" ON storage.objects;

-- Create new policies that allow bank viewers to upload F100 files for their bank

-- INSERT: Admin can insert anywhere, bank_viewer can insert to their bank's path
DROP POLICY IF EXISTS "storage.f100.insert.admin" ON storage.objects;
CREATE POLICY "storage.f100.insert.admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "storage.f100.insert.bank_viewer" ON storage.objects;
CREATE POLICY "storage.f100.insert.bank_viewer"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
      AND position('/bank/' || p.bank_id::text || '/' in coalesce(name,'')) > 0
  )
);

-- UPDATE: Admin can update any file, bank_viewer can update their bank's files
DROP POLICY IF EXISTS "storage.f100.update.admin" ON storage.objects;
CREATE POLICY "storage.f100.update.admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "storage.f100.update.bank_viewer" ON storage.objects;
CREATE POLICY "storage.f100.update.bank_viewer"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
      AND position('/bank/' || p.bank_id::text || '/' in coalesce(name,'')) > 0
  )
)
WITH CHECK (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
      AND position('/bank/' || p.bank_id::text || '/' in coalesce(name,'')) > 0
  )
);

-- DELETE: Admin can delete any file, bank_viewer can delete their bank's files
DROP POLICY IF EXISTS "storage.f100.delete.admin" ON storage.objects;
CREATE POLICY "storage.f100.delete.admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "storage.f100.delete.bank_viewer" ON storage.objects;
CREATE POLICY "storage.f100.delete.bank_viewer"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'f100'
  AND EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer'
      AND position('/bank/' || p.bank_id::text || '/' in coalesce(name,'')) > 0
  )
);

-- Also update the F100 table policies to allow bank viewers to create F100 records
-- Drop existing restrictive policy
DROP POLICY IF EXISTS "f100.write.admin" ON public.f100;

-- Create separate policies for F100 table operations

-- INSERT: Admin can insert any F100, bank_viewer can insert for their bank
DROP POLICY IF EXISTS "f100.insert.admin" ON public.f100;
CREATE POLICY "f100.insert.admin"
ON public.f100 FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "f100.insert.bank_viewer" ON public.f100;
CREATE POLICY "f100.insert.bank_viewer"
ON public.f100 FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = bank_id
  )
);

-- UPDATE: Admin can update any F100, bank_viewer can update their bank's F100
DROP POLICY IF EXISTS "f100.update.admin" ON public.f100;
CREATE POLICY "f100.update.admin"
ON public.f100 FOR UPDATE
TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "f100.update.bank_viewer" ON public.f100;
CREATE POLICY "f100.update.bank_viewer"
ON public.f100 FOR UPDATE
TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = bank_id
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = bank_id
  )
);

-- DELETE: Only admin can delete F100 records
DROP POLICY IF EXISTS "f100.delete.admin" ON public.f100;
CREATE POLICY "f100.delete.admin"
ON public.f100 FOR DELETE
TO authenticated
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);
