// Real PostgreSQL regression test. Starts a private, disposable local cluster;
// never uses linked Supabase settings or an externally supplied database URL.
// Requires initdb, pg_ctl and psql on PATH and Git history containing the
// pre-fix dev commit below. Run with Node.js from the repository root.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const migrationPath = new URL('../supabase/migrations/20250928180000_restore_specialist_infrastructure.sql', import.meta.url);
const migration = readFileSync(migrationPath, 'utf8');
const root = mkdtempSync(join(tmpdir(), 'telagri-policy-regression-'));
const data = join(root, 'data');
// A private Unix socket directory permits the same port in concurrent runs.
const port = '55437';
const env = { ...process.env };
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key];
const run = (cmd, args, input) => execFileSync(cmd, args, {
  env, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
});
const sql = (database, input) => run('psql', [
  '-X', '-qAt', '--single-transaction', '-v', 'ON_ERROR_STOP=1',
  '-h', root, '-p', port, '-U', 'postgres', '-d', database,
], `SET client_min_messages = warning;\n${input}`);
const fixture = `
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
CREATE TABLE public.banks (id uuid PRIMARY KEY, name text);
CREATE TABLE public.farmers (id uuid PRIMARY KEY, name text, id_number text);
CREATE TABLE public.profiles (user_id uuid, role text);
CREATE TABLE public.farmer_data_uploads
  (id uuid PRIMARY KEY, farmer_id uuid, data_type text, metadata jsonb, created_at timestamptz);
`;
const legacy = `
CREATE TABLE public.specialist_assignments (
  id uuid PRIMARY KEY, farmer_id uuid, bank_id uuid, specialist_id uuid,
  phase int, status text, assigned_at timestamptz, assigned_by uuid, notes text,
  created_at timestamptz, updated_at timestamptz
);
CREATE TABLE public.analysis_sessions (
  id uuid PRIMARY KEY, farmer_id uuid, bank_id uuid, specialist_id uuid,
  phase int, session_name text, analysis_prompt text, status text,
  created_at timestamptz, updated_at timestamptz
);
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY, farmer_id uuid, bank_id uuid, sender_id uuid,
  sender_role text, message text, session_id uuid, created_at timestamptz
);
CREATE TABLE public.ai_chat_sessions (
  id uuid PRIMARY KEY, farmer_id uuid NOT NULL, specialist_id uuid NOT NULL,
  assignment_id uuid, phase int NOT NULL, status text NOT NULL,
  created_at timestamptz, updated_at timestamptz
);
CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY, session_id uuid, sender_role text, content text,
  metadata jsonb, created_at timestamptz
);
CREATE POLICY "Admins can update specialist assignments" ON public.specialist_assignments
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Specialists can update their own assignment status" ON public.specialist_assignments
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Specialists can manage their own analysis sessions" ON public.analysis_sessions
  FOR ALL TO authenticated USING (false);
INSERT INTO public.ai_chat_sessions (id, farmer_id, specialist_id, phase, status)
VALUES ('00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003', 1, 'active');
`;
const policySnapshot = `SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY tablename, policyname), '[]')
  FROM pg_policies p WHERE schemaname = 'public';`;
let started = false;
try {
  run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale']);
  run('pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o',
    `-h '' -k '${root}' -p ${port}`, '-w', 'start']);
  started = true;
  sql('postgres', 'CREATE ROLE authenticated NOLOGIN;');
  // CREATE DATABASE cannot run in a transaction.
  run('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', root, '-p', port,
    '-U', 'postgres', '-d', 'postgres', '-c', 'CREATE DATABASE legacy;']);
  sql('postgres', fixture);
  sql('postgres', migration);
  const freshPolicies = sql('postgres', policySnapshot);
  assert.equal(JSON.parse(freshPolicies).length, 11);
  sql('postgres', migration);
  assert.equal(sql('postgres', policySnapshot), freshPolicies);
  console.log('PASS: clean fixture applies twice with 11 unchanged policies');

  sql('legacy', fixture + legacy);
  const existing = JSON.parse(sql('legacy', policySnapshot));
  const original = run('git', ['show', '884dba130ddedb47616cfc7a08c217ee392d00d6:supabase/migrations/20250928180000_restore_specialist_infrastructure.sql']);
  assert.throws(() => sql('legacy', original), error =>
    String(error.stderr).includes('policy "Admins can update specialist assignments"') &&
    String(error.stderr).includes('already exists'));
  console.log('PASS: original migration reproduces reported duplicate-policy error');

  sql('legacy', migration);
  const after = JSON.parse(sql('legacy', policySnapshot));
  assert.equal(after.length, 11);
  for (const policy of existing) {
    assert.deepEqual(after.find(p => p.tablename === policy.tablename && p.policyname === policy.policyname), policy);
  }
  const rows = sql('legacy', `SELECT id, farmer_id, specialist_id, phase, status,
    user_id IS NULL, session_name IS NULL FROM public.ai_chat_sessions;`);
  assert.equal(rows.trim(), '00000000-0000-0000-0000-000000000001|00000000-0000-0000-0000-000000000002|00000000-0000-0000-0000-000000000003|1|active|t|t');
  sql('legacy', migration);
  assert.deepEqual(JSON.parse(sql('legacy', policySnapshot)), after);
  console.log('PASS: legacy fixture applies twice, preserves existing policy definitions and owner/data');
  const successor = readFileSync(new URL('../supabase/migrations/20250928183000_fix_ai_chat_sessions_schema.sql', import.meta.url), 'utf8');
  sql('postgres', successor);
  sql('legacy', successor);
  assert.equal(sql('legacy', 'SELECT specialist_id FROM public.ai_chat_sessions;').trim(),
    '00000000-0000-0000-0000-000000000003');
  console.log('PASS: subsequent AI-chat schema migration succeeds on both fixtures');
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  rmSync(root, { recursive: true, force: true });
}
