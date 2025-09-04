-- Allow bank viewers to create farmers for their own bank
-- This fixes the RLS policy violation when bank users try to create farmers

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "farmers.write.admin" ON public.farmers;

-- Create separate policies for different operations

-- INSERT: Admin can insert any farmer, bank_viewer can insert farmers for their bank
CREATE POLICY "farmers.insert.admin" 
ON public.farmers FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "farmers.insert.bank_viewer" 
ON public.farmers FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = bank_id
  )
);

-- UPDATE: Admin can update any farmer, bank_viewer can update farmers from their bank
CREATE POLICY "farmers.update.admin" 
ON public.farmers FOR UPDATE 
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

CREATE POLICY "farmers.update.bank_viewer" 
ON public.farmers FOR UPDATE 
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

-- DELETE: Only admin can delete farmers (bank viewers should not delete)
CREATE POLICY "farmers.delete.admin" 
ON public.farmers FOR DELETE 
TO authenticated 
USING (
  EXISTS(
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);
