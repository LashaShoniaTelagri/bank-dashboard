-- Create admin profile for the user
INSERT INTO public.profiles (user_id, role, bank_id)
VALUES ('5581d521-26a8-4cd1-92b8-1369a650c5e9', 'admin', NULL)
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin', bank_id = NULL;

-- Create some sample banks for testing
INSERT INTO public.banks (name, logo_url) VALUES
('First National Agricultural Bank', 'https://via.placeholder.com/150x60/22C55E/FFFFFF?text=FNAB'),
('Rural Development Bank', 'https://via.placeholder.com/150x60/3B82F6/FFFFFF?text=RDB'),
('Cooperative Credit Union', 'https://via.placeholder.com/150x60/F59E0B/FFFFFF?text=CCU')
ON CONFLICT (name) DO NOTHING;