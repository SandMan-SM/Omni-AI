// Local verification only. Does not edit .env files, mint identity, or deploy.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawn } = require('node:child_process');

if (process.argv[2] !== '--local-ais-receiver' || !path.isAbsolute(process.argv[3] || '')) {
  console.error('Usage: node scripts/run-ais-local-receiver.cjs --local-ais-receiver /absolute/frontend/.env.local');
  process.exit(1);
}
const local = parseEnv(fs.readFileSync(process.argv[3], 'utf8'));
const secret = local.AISEMPIRE_INBOUND_SECRET;
if (!secret || secret.length < 32) {
  console.error('Local AIS caller authentication is not configured.');
  process.exit(1);
}
const env = { ...process.env, NODE_ENV: 'development', VERCEL_ENV: 'development', AISEMPIRE_INBOUND_SECRET: secret };
// Never carry a production identity into the loopback-only test process.
delete env.VERCEL_OIDC_TOKEN;
delete env.VERCEL;
const child = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '2030'], {
  cwd: process.cwd(), env, stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => { process.exitCode = code ?? 1; });
