-- Add missing created_by column to farmer_documents table
-- The trigger function set_farmer_document_created_by() expects this column to exist

-- Add the created_by column
ALTER TABLE public.farmer_documents 
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Set default value for existing records (if any)
UPDATE public.farmer_documents 
SET created_by = (
  SELECT user_id FROM profiles 
  WHERE role = 'admin' 
  LIMIT 1
) 
WHERE created_by IS NULL;
