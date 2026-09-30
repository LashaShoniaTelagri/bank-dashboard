-- Update data_type enum to add 'maps' and 'climate'
-- Note: PostgreSQL requires enum additions to be in separate transactions
-- We'll add the values and update records in a subsequent migration

-- Add new enum values
ALTER TYPE data_type ADD VALUE IF NOT EXISTS 'maps';
ALTER TYPE data_type ADD VALUE IF NOT EXISTS 'climate';

-- Recreate RLS policies
ALTER TABLE farmer_data_uploads ENABLE ROW LEVEL SECURITY;

-- Policy for admins to view all uploads
CREATE POLICY "Admins can view all farmer data uploads" ON farmer_data_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy for bank viewers to view uploads from their bank
CREATE POLICY "Bank viewers can view their bank's farmer data uploads" ON farmer_data_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = farmer_data_uploads.bank_id
    )
  );

-- Policy for specialists to view uploads for farmers they're assigned to
CREATE POLICY "Specialists can view uploads for assigned farmers" ON farmer_data_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM specialist_assignments sa
      JOIN profiles p ON p.user_id = auth.uid()
      WHERE sa.specialist_id = auth.uid()
      AND sa.farmer_id = farmer_data_uploads.farmer_id
      AND p.role = 'specialist'
    )
  );

-- Policy for admins to insert uploads for any bank (via RPC)
CREATE POLICY "Admins can insert farmer data uploads via RPC" ON farmer_data_uploads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy for bank viewers to insert uploads for their bank
CREATE POLICY "Bank viewers can insert uploads for their bank" ON farmer_data_uploads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role = 'bank_viewer' 
      AND p.bank_id = farmer_data_uploads.bank_id
    )
  );

-- Policy for admins to delete uploads
CREATE POLICY "Admins can delete farmer data uploads" ON farmer_data_uploads
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Function already exists and will work with the new enum values

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
