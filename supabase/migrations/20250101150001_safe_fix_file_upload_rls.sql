-- Safe fix for file upload RLS issues
-- This migration safely handles existing objects and won't break existing data

-- Create farmer_documents table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'farmer_documents') THEN
        CREATE TABLE public.farmer_documents (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
          bank_id uuid NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
          document_type text NOT NULL CHECK (document_type IN ('irrigation_diagram', 'current_analysis', 'other')),
          file_name text NOT NULL,
          file_path text NOT NULL,
          file_mime text,
          file_size_bytes bigint,
          created_at timestamptz NOT NULL DEFAULT now(),
          created_by uuid REFERENCES auth.users(id)
        );

        -- Create indexes
        CREATE INDEX farmer_documents_farmer_idx ON public.farmer_documents(farmer_id);
        CREATE INDEX farmer_documents_bank_idx ON public.farmer_documents(bank_id);
        CREATE INDEX farmer_documents_type_idx ON public.farmer_documents(document_type);

        -- Enable RLS
        ALTER TABLE public.farmer_documents ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Created farmer_documents table with indexes and RLS';
    ELSE
        RAISE NOTICE 'farmer_documents table already exists, skipping creation';
    END IF;
END
$$;

-- Create farmer-documents bucket only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM storage.buckets WHERE id = 'farmer-documents') THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('farmer-documents', 'farmer-documents', false);
        RAISE NOTICE 'Created farmer-documents storage bucket';
    ELSE
        RAISE NOTICE 'farmer-documents bucket already exists, skipping creation';
    END IF;
END
$$;

-- Create farmer_documents table policies safely
DO $$
BEGIN
    -- READ policies
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'farmer_documents' AND policyname = 'farmer_documents.read.admin') THEN
        CREATE POLICY "farmer_documents.read.admin"
        ON public.farmer_documents FOR SELECT
        TO authenticated
        USING (
          EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'farmer_documents' AND policyname = 'farmer_documents.read.bank_viewer') THEN
        CREATE POLICY "farmer_documents.read.bank_viewer"
        ON public.farmer_documents FOR SELECT
        TO authenticated
        USING (
          EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
              AND p.role = 'bank_viewer' 
              AND p.bank_id = bank_id
          )
        );
    END IF;

    -- INSERT policies
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'farmer_documents' AND policyname = 'farmer_documents.insert.admin') THEN
        CREATE POLICY "farmer_documents.insert.admin"
        ON public.farmer_documents FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'farmer_documents' AND policyname = 'farmer_documents.insert.bank_viewer') THEN
        CREATE POLICY "farmer_documents.insert.bank_viewer"
        ON public.farmer_documents FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
              AND p.role = 'bank_viewer' 
              AND p.bank_id = bank_id
          )
        );
    END IF;

    -- UPDATE policies
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'farmer_documents' AND policyname = 'farmer_documents.update.admin') THEN
        CREATE POLICY "farmer_documents.update.admin"
        ON public.farmer_documents FOR UPDATE
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
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'farmer_documents' AND policyname = 'farmer_documents.update.bank_viewer') THEN
        CREATE POLICY "farmer_documents.update.bank_viewer"
        ON public.farmer_documents FOR UPDATE
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
    END IF;

    -- DELETE policy
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'farmer_documents' AND policyname = 'farmer_documents.delete.admin') THEN
        CREATE POLICY "farmer_documents.delete.admin"
        ON public.farmer_documents FOR DELETE
        TO authenticated
        USING (
          EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
          )
        );
    END IF;
END
$$;

-- Create storage policies for farmer-documents bucket safely
DO $$
BEGIN
    -- READ policies
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' 
        AND policyname = 'storage.farmer_documents.read.admin'
    ) THEN
        CREATE POLICY "storage.farmer_documents.read.admin"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (
          bucket_id = 'farmer-documents'
          AND EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' 
        AND policyname = 'storage.farmer_documents.read.bank_viewer'
    ) THEN
        CREATE POLICY "storage.farmer_documents.read.bank_viewer"
        ON storage.objects FOR SELECT
        TO authenticated
        USING (
          bucket_id = 'farmer-documents'
          AND EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
              AND p.role = 'bank_viewer'
              AND position('/farmer/' in coalesce(name,'')) > 0
              AND EXISTS(
                SELECT 1 FROM public.farmers f
                WHERE f.bank_id = p.bank_id
                  AND position('/farmer/' || f.id::text || '/' in coalesce(name,'')) > 0
              )
          )
        );
    END IF;

    -- WRITE policies
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' 
        AND policyname = 'storage.farmer_documents.write.admin'
    ) THEN
        CREATE POLICY "storage.farmer_documents.write.admin"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'farmer-documents'
          AND EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' 
        AND policyname = 'storage.farmer_documents.write.bank_viewer'
    ) THEN
        CREATE POLICY "storage.farmer_documents.write.bank_viewer"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'farmer-documents'
          AND EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
              AND p.role = 'bank_viewer'
              AND position('/farmer/' in coalesce(name,'')) > 0
              AND EXISTS(
                SELECT 1 FROM public.farmers f
                WHERE f.bank_id = p.bank_id
                  AND position('/farmer/' || f.id::text || '/' in coalesce(name,'')) > 0
              )
          )
        );
    END IF;
END
$$;

-- Update F100 storage policies safely
DO $$
BEGIN
    -- Drop all existing F100 storage policies that might conflict
    DROP POLICY IF EXISTS "storage.f100.write.admin" ON storage.objects;
    DROP POLICY IF EXISTS "storage.f100.update.delete.admin" ON storage.objects;
    DROP POLICY IF EXISTS "storage.f100.insert.admin" ON storage.objects;
    DROP POLICY IF EXISTS "storage.f100.insert.bank_viewer" ON storage.objects;
    DROP POLICY IF EXISTS "storage.f100.update.admin" ON storage.objects;
    DROP POLICY IF EXISTS "storage.f100.update.bank_viewer" ON storage.objects;
    DROP POLICY IF EXISTS "storage.f100.delete.admin" ON storage.objects;
    DROP POLICY IF EXISTS "storage.f100.delete.bank_viewer" ON storage.objects;

    -- Create new F100 storage policies
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

    RAISE NOTICE 'Updated F100 storage policies for bank viewers';
END
$$;

-- Update F100 table policies safely
DO $$
BEGIN
    -- Drop existing restrictive policy if it exists
    DROP POLICY IF EXISTS "f100.write.admin" ON public.f100;

    -- Create new F100 table policies if they don't exist
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'f100' AND policyname = 'f100.insert.admin') THEN
        CREATE POLICY "f100.insert.admin"
        ON public.f100 FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
          )
        );
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'f100' AND policyname = 'f100.insert.bank_viewer') THEN
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
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'f100' AND policyname = 'f100.update.admin') THEN
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
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'f100' AND policyname = 'f100.update.bank_viewer') THEN
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
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'f100' AND policyname = 'f100.delete.admin') THEN
        CREATE POLICY "f100.delete.admin"
        ON public.f100 FOR DELETE
        TO authenticated
        USING (
          EXISTS(
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() AND p.role = 'admin'
          )
        );
    END IF;
END
$$;

-- Create trigger safely
DO $$
BEGIN
    -- Create function if it doesn't exist
    CREATE OR REPLACE FUNCTION public.set_farmer_document_created_by()
    RETURNS trigger AS $func$
    BEGIN
      NEW.created_by = auth.uid();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Drop trigger if it exists and recreate
    DROP TRIGGER IF EXISTS trg_set_farmer_document_created_by ON public.farmer_documents;
    
    -- Only create trigger if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'farmer_documents') THEN
        CREATE TRIGGER trg_set_farmer_document_created_by
        BEFORE INSERT ON public.farmer_documents
        FOR EACH ROW EXECUTE FUNCTION public.set_farmer_document_created_by();
    END IF;
END
$$;
