// Host-only, read-only receiver checks. No .env writes, auth-session minting,
// production configuration changes, schema writes, queue writes or deployment.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {parseEnv} = require('node:util');
const {spawn} = require('node:child_process');
const net = require('node:net');
const ROOT = '/Users/janahasson/Desktop/Clients/_deploy-worktrees/omni-review-stories-20261102';
const EXISTING = '/Users/janahasson/Desktop/Clients/_deploy-worktrees/seo-metrics-receiver-20261014/.env.local';
const CALLER = '/Users/janahasson/Desktop/Clients/AIS Empire/Website/.env.local';
const CANONICAL = '/Users/janahasson/Desktop/Clients/Sitani Mafi/Omni AI/Website/.env.local';
const POOLER = '/Users/janahasson/Desktop/Clients/Sitani Mafi/Mafi Empire/Creative/Social/2026-10-30-daily-mix/ops/with-approved-pooler.cjs';
const OWNER = '9de99ed9-e7ec-4a85-824e-c812944dff9c';
let stage = 'mode';

function environment() {
  const original = parseEnv(fs.readFileSync(EXISTING, 'utf8'));
  const caller = parseEnv(fs.readFileSync(CALLER, 'utf8'));
  assert.equal(original.NEXT_PUBLIC_SUPABASE_URL, 'https://odvxtychuxxsudfpcqqs.supabase.co');
  assert.equal(original.NEXT_PUBLIC_SUPABASE_URL, caller.NEXT_PUBLIC_SUPABASE_URL);
  assert.ok(original.AISEMPIRE_REPORTING_OWNER_AUTH_IDS.split(',').map(id => id.trim()).includes(OWNER));
  assert.ok(original.AISEMPIRE_INBOUND_SECRET.length >= 32);
  assert.equal(original.AISEMPIRE_INBOUND_SECRET, caller.AISEMPIRE_INBOUND_SECRET);
  const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'AISEMPIRE_INBOUND_SECRET', 'AISEMPIRE_REPORTING_OWNER_AUTH_IDS'];
  const env = {...process.env, ...Object.fromEntries(keys.filter(key => original[key]).map(key => [key, original[key]])),
    ...require(POOLER).loadConnection(value => {stage = value;}), NODE_ENV: 'development', AISEMPIRE_CONTENT_STUDIO_LOCAL_INTAKE: 'loopback', NEXT_DIST_DIR: '.next-content-studio-local'};
  for (const key of Object.keys(env)) if (key === 'VERCEL' || key.startsWith('VERCEL_')) delete env[key];
  return env;
}
function listening() {
  return new Promise(resolve => {
    const socket = net.connect({host: '127.0.0.1', port: 3002});
    socket.once('connect', () => {socket.destroy(); resolve(true);});
    socket.once('error', () => resolve(false));
  });
}
async function databaseCheck(env) {
  require('tsx/cjs');
  const {Pool} = require('pg');
  const {ixPostgresConfig} = require('../lib/server/ix-postgres-config.ts');
  const pool = new Pool({...ixPostgresConfig(env.POSTGRES_URL, env), max: 1, connectionTimeoutMillis: 8000, query_timeout: 10000});
  try {
    const result = await pool.query("select current_database() as database, current_setting('ssl') as ssl, to_regclass('public.lead_franchise_social_connections') is not null as lf_connections_exist, to_regclass('public.lead_franchise_social_posts') is not null as lf_posts_exist, to_regclass('public.review_story_posts') is not null as story_posts_exist");
    assert.equal(pool.options.ssl.rejectUnauthorized, true);
    assert.ok(pool.options.ssl.ca);
    return {database: result.rows[0].database, strictTls: true, caVerified: true, serverSsl: result.rows[0].ssl,
      leadFranchiseTablesPresent: result.rows[0].lf_connections_exist && result.rows[0].lf_posts_exist,
      reviewStoryTablePresent: result.rows[0].story_posts_exist};
  } finally {await pool.end();}
}
async function main() {
  assert.equal(process.cwd(), ROOT);
  const mode = process.argv[2];
  assert.ok(['--probe-db', '--serve', '--check-http', '--build'].includes(mode), 'Choose --probe-db, --serve, --check-http or --build.');
  stage = 'approved_configuration';
  const env = environment();
  stage = 'strict_tls_database_read';
  const database = await databaseCheck(env);
  if (mode === '--probe-db') {console.log(JSON.stringify({ok: true, readOnly: true, ...database, writes: 0})); return;}
  if (mode === '--build') {
    stage = 'production_build';
    const canonical = parseEnv(fs.readFileSync(CANONICAL, 'utf8'));
    assert.equal(canonical.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL);
    for (const key of ['STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
      assert.ok(canonical[key]); env[key] = canonical[key];
    }
    // Next imports the existing Stripe route during collection. Supply its
    // existing configured key in memory only; do not invoke the webhook.
    env.NODE_ENV = 'production'; env.NEXT_DIST_DIR = '.next-prod';
    const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'build'], {cwd: ROOT, env, stdio: 'inherit'});
    child.on('exit', code => {process.exitCode = code ?? 1;});
    return;
  }
  if (mode === '--check-http') {
    stage = 'real_local_http_auth_checks';
    const endpoint = 'http://127.0.0.1:3002/api/reporting/ais-empire/content-studio?month=2026-11';
    const missing = await fetch(endpoint, {redirect: 'error', signal: AbortSignal.timeout(45000)});
    const invalid = await fetch(endpoint, {headers: {'x-aisempire-token': env.AISEMPIRE_INBOUND_SECRET, Authorization: 'Bearer invalid-local-check-token'}, redirect: 'error', signal: AbortSignal.timeout(45000)});
    assert.equal(missing.status, 401); assert.equal(invalid.status, 401);
    assert.equal((await missing.json()).code, 'service_auth_required');
    assert.equal((await invalid.json()).code, 'valid_session_required');
    console.log(JSON.stringify({ok: true, readOnly: true, ...database, actualReceiverHttp: true, missingService: missing.status, invalidSession: invalid.status, ownerSessionTested: false, writes: 0}));
    return;
  }
  stage = 'loopback_server';
  assert.equal(await listening(), false, 'Port 3002 is already in use; preserve the existing server.');
  console.log(JSON.stringify({starting: true, readOnlyChecks: database, receiver: 'http://127.0.0.1:3002', ownerSessionCreated: false, envFilesWritten: 0}));
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3002'], {cwd: ROOT, env, stdio: 'inherit'});
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => {process.exitCode = code ?? 1;});
}
main().catch(error => {
  console.error(JSON.stringify({ok: false, stage, code: /^[A-Z0-9_]{1,50}$/.test(error?.code || '') ? error.code : 'LOCAL_CHECK_FAILED', writes: 0}));
  process.exitCode = 1;
});
