import { pathToFileURL } from 'node:url';

export const DEV_PROJECT = 'aeqdbsusteikftldabzk';
const DEV_URL = `https://${DEV_PROJECT}.supabase.co`;

// Only validate public target identifiers; never log environment values.
export function validateTarget(stage, environment, values) {
  if (!['dev', 'staging', 'prod'].includes(environment)) throw new Error('Unknown deployment environment');
  if (!['frontend', 'migrations', 'backend'].includes(stage)) throw new Error('Unknown target validation stage');
  if (environment !== 'dev') return;
  const expected = stage === 'frontend'
    ? { VITE_SUPABASE_URL: DEV_URL }
    : stage === 'migrations'
      ? { SUPABASE_PROJECT_ID: DEV_PROJECT }
      : { SUPABASE_PROJECT_ID: DEV_PROJECT, PROJECT_URL: DEV_URL };
  for (const [name, value] of Object.entries(expected)) {
    if (values[name] !== value) throw new Error(`Dev target mismatch: ${name}; deployment stopped`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const stage = process.argv[2];
    let values = process.env;
    if (stage === 'frontend' && process.env.ENVIRONMENT === 'dev') {
      // Match `vite build`: production mode, dotenv overrides and process env.
      const { loadEnv } = await import('vite');
      values = loadEnv('production', process.cwd(), 'VITE_');
    }
    validateTarget(stage, process.env.ENVIRONMENT, values);
    console.log('Supabase deployment target check passed');
  } catch {
    console.error('Supabase target check failed. Check environment/project bindings; values are not logged.');
    process.exitCode = 1;
  }
}
