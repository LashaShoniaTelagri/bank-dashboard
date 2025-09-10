-- TelAgri Monitoring: Create System Admin User
-- Email: lasha@telagri.com
-- Usage: Run this in Supabase SQL Editor or via CLI
-- Note: Replace 'YOUR_SECURE_PASSWORD' with your actual password

DO $$
DECLARE
    admin_user_id uuid;
    existing_user_id uuid;
    admin_email text := 'lasha@telagri.com';
    admin_password text := 'YOUR_SECURE_PASSWORD'; -- CHANGE THIS!
BEGIN
    -- Check if user already exists in auth.users
    SELECT id INTO existing_user_id 
    FROM auth.users 
    WHERE email = admin_email;
    
    IF existing_user_id IS NOT NULL THEN
        RAISE NOTICE 'User % already exists with ID: %', admin_email, existing_user_id;
        admin_user_id := existing_user_id;
        
        -- Update password and confirm email for existing user
        UPDATE auth.users 
        SET 
            encrypted_password = crypt(admin_password, gen_salt('bf')),
            updated_at = NOW(),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            confirmation_token = '',
            email_change_token_new = '',
            recovery_token = ''
        WHERE id = existing_user_id;
        
        RAISE NOTICE 'Updated password and confirmed email for existing user';
    ELSE
        -- Create new user
        admin_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            role,
            aud,
            confirmation_token,
            email_change_token_new,
            recovery_token
        ) VALUES (
            admin_user_id,
            '00000000-0000-0000-0000-000000000000',
            admin_email,
            crypt(admin_password, gen_salt('bf')),
            NOW(), -- Email confirmed immediately
            NOW(),
            NOW(),
            'authenticated',
            'authenticated',
            '', -- No confirmation needed
            '',
            ''
        );
        
        RAISE NOTICE 'Created new user % with ID: %', admin_email, admin_user_id;
    END IF;
    
    -- Create or update profile with admin role
    INSERT INTO public.profiles (user_id, role, bank_id, created_at)
    VALUES (admin_user_id, 'admin', NULL, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        role = 'admin',
        bank_id = NULL;
    
    RAISE NOTICE 'Admin profile created/updated for user: %', admin_user_id;
    
    -- Verify the setup
    IF EXISTS (
        SELECT 1 FROM public.profiles p 
        JOIN auth.users u ON p.user_id = u.id 
        WHERE u.email = admin_email AND p.role = 'admin'
    ) THEN
        RAISE NOTICE '✅ SUCCESS: System admin setup completed!';
        RAISE NOTICE 'Email: %', admin_email;
        RAISE NOTICE 'Role: admin';
        RAISE NOTICE 'Bank: NULL (system admin)';
        RAISE NOTICE 'Email Confirmed: YES';
    ELSE
        RAISE EXCEPTION 'Failed to verify admin setup';
    END IF;
END
$$;

-- Display the created admin user details
SELECT 
    u.id as user_id,
    u.email,
    p.role,
    p.bank_id,
    u.created_at,
    u.updated_at,
    u.email_confirmed_at IS NOT NULL as email_confirmed,
    CASE 
        WHEN p.role = 'admin' AND p.bank_id IS NULL THEN 'System Administrator'
        WHEN p.role = 'admin' THEN 'Bank Administrator'
        WHEN p.role = 'bank_viewer' THEN 'Bank Viewer'
        ELSE 'Unknown Role'
    END as role_description
FROM auth.users u
JOIN public.profiles p ON u.id = p.user_id
WHERE u.email = 'lasha@telagri.com';

-- Show admin permissions verification
SELECT 
    'Admin can manage banks' as permission,
    EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = (SELECT id FROM auth.users WHERE email = 'lasha@telagri.com')
        AND p.role = 'admin'
    ) as has_permission
UNION ALL
SELECT 
    'Admin can manage farmers' as permission,
    EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = (SELECT id FROM auth.users WHERE email = 'lasha@telagri.com')
        AND p.role = 'admin'
    ) as has_permission
UNION ALL
SELECT 
    'Admin can manage F-100 reports' as permission,
    EXISTS(
        SELECT 1 FROM public.profiles p 
        WHERE p.user_id = (SELECT id FROM auth.users WHERE email = 'lasha@telagri.com')
        AND p.role = 'admin'
    ) as has_permission;
