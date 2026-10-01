import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEV_PROJECT, validateTarget } from './check-dev-supabase-target.mjs';

const valid = {
  VITE_SUPABASE_URL: `https://${DEV_PROJECT}.supabase.co`,
  SUPABASE_PROJECT_ID: DEV_PROJECT,
  PROJECT_URL: `https://${DEV_PROJECT}.supabase.co`,
};
for (const stage of ['frontend', 'migrations', 'backend']) {
  test(`${stage}: replacement dev accepted`, () => validateTarget(stage, 'dev', valid));
  test(`${stage}: missing config rejected`, () => assert.throws(() => validateTarget(stage, 'dev', {})));
  test(`${stage}: other project rejected`, () => assert.throws(() => validateTarget(stage, 'dev', {
    VITE_SUPABASE_URL: 'https://wrong.supabase.co', SUPABASE_PROJECT_ID: 'wrong', PROJECT_URL: 'https://wrong.supabase.co',
  })));
  test(`${stage}: prod/staging bindings untouched`, () => {
    validateTarget(stage, 'prod', {});
    validateTarget(stage, 'staging', {});
  });
}
test('backend requires matching URL as well as project', () => {
  assert.throws(() => validateTarget('backend', 'dev', { ...valid, PROJECT_URL: 'https://wrong.supabase.co' }));
});
test('unknown environment/stage fail closed', () => {
  assert.throws(() => validateTarget('backend', undefined, valid));
  assert.throws(() => validateTarget('typo', 'dev', valid));
});
