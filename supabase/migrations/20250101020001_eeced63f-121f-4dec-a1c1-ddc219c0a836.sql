-- Note: Admin profile creation is handled by the application
-- This migration only sets up the schema and sample data
-- Admin users should be created through the application's user management system

-- Create some sample banks for testing
INSERT INTO public.banks (name, logo_url) VALUES
('First National Agricultural Bank', 'https://via.placeholder.com/150x60/22C55E/FFFFFF?text=FNAB'),
('Rural Development Bank', 'https://via.placeholder.com/150x60/3B82F6/FFFFFF?text=RDB'),
('Cooperative Credit Union', 'https://via.placeholder.com/150x60/F59E0B/FFFFFF?text=CCU')
ON CONFLICT (name) DO NOTHING;