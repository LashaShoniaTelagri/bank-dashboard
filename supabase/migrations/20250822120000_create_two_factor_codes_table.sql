-- Create table for storing 2FA codes
CREATE TABLE IF NOT EXISTS public.two_factor_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts integer DEFAULT 0,
    user_role text,
    created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_two_factor_codes_email ON public.two_factor_codes(email);
CREATE INDEX IF NOT EXISTS idx_two_factor_codes_expires_at ON public.two_factor_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_two_factor_codes_created_at ON public.two_factor_codes(created_at);

-- Enable RLS
ALTER TABLE public.two_factor_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (only Edge Functions with service role can access)
CREATE POLICY "Enable read access for service role only" ON public.two_factor_codes
    FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Enable insert access for service role only" ON public.two_factor_codes
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Enable update access for service role only" ON public.two_factor_codes
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Enable delete access for service role only" ON public.two_factor_codes
    FOR DELETE USING (auth.role() = 'service_role');

-- Create a function to clean up expired codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_2fa_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM public.two_factor_codes 
    WHERE expires_at < now() - interval '1 hour';
END;
$$;

-- Add comment for documentation
COMMENT ON TABLE public.two_factor_codes IS 'Stores hashed 2FA verification codes with expiration and attempt tracking'; 