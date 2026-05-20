-- Backfill: create specialist_assignments before storage policies reference it.
--
-- Why this exists: the cloud DB has specialist_assignments from history that
-- wasn't captured in 20250916221541_remote_schema.sql. Migrations 20250927114805
-- and 20250927115100 create storage policies that reference this table — they
-- worked on cloud (table already there) but failed on a fresh local DB.
--
-- The same DDL appears later in 20250928180000_restore_specialist_infrastructure.sql
-- with `CREATE TABLE IF NOT EXISTS`, so this migration is a no-op there and on cloud.
-- DDL kept identical to the canonical version in 20250928180000.

BEGIN;

CREATE TABLE IF NOT EXISTS public.specialist_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL CHECK (phase >= 1 AND phase <= 12),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(specialist_id, farmer_id, phase)
);

COMMIT;
