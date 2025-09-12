-- TelAgri Monitoring: Simple Admin Creation
-- Run this in Supabase SQL Editor after basic schema is working
-- https://supabase.com/dashboard/project/jhelkawgkjohvzsusrnw/sql

-- This creates an admin user directly in the profiles table
-- The user_id should match the actual auth.users.id after they sign up

DO $$
DECLARE
    admin_user_id uuid;
    admin_email text := 'lasha@telagri.com';
    test_bank_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Generate a UUID for the admin user
    -- In production, this should match the actual auth.users.id
    admin_user_id := gen_random_uuid();
    
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Creating admin user profile...';
    RAISE NOTICE 'Email: %', admin_email;
    RAISE NOTICE 'User ID: %', admin_user_id;
    RAISE NOTICE '';
    
    -- Insert admin profile
    INSERT INTO public.profiles (user_id, role, bank_id, created_at)
    VALUES (admin_user_id, 'admin', NULL, now())
    ON CONFLICT (user_id) DO UPDATE SET
        role = 'admin',
        bank_id = NULL,
        created_at = COALESCE(profiles.created_at, now());
    
    RAISE NOTICE '✅ Admin profile created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT NOTES:';
    RAISE NOTICE '';
    RAISE NOTICE '1. This creates a profile entry, but you still need to:';
    RAISE NOTICE '   • Sign up with email: %', admin_email;
    RAISE NOTICE '   • Use any password you want';
    RAISE NOTICE '   • The system will recognize you as admin';
    RAISE NOTICE '';
    RAISE NOTICE '2. If auth integration is working, update the user_id:';
    RAISE NOTICE '   • After signing up, find your real auth.users.id';
    RAISE NOTICE '   • Update: UPDATE profiles SET user_id = ''real-uuid'' WHERE user_id = ''%'';', admin_user_id;
    RAISE NOTICE '';
    RAISE NOTICE '3. For now, you can test with this temporary profile';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Profile Details:';
    RAISE NOTICE '   • User ID: %', admin_user_id;
    RAISE NOTICE '   • Role: admin';
    RAISE NOTICE '   • Bank ID: NULL (system admin)';
    RAISE NOTICE '';
    
END
$$;

-- Verify the profile was created
SELECT 
    user_id,
    role,
    bank_id,
    created_at
FROM public.profiles 
WHERE role = 'admin'
ORDER BY created_at DESC
LIMIT 5;
