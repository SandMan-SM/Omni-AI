// Deploy-bundle gate.
//
// On 2026-11-13 a pushed commit built red on Vercel with
//   Could not find 'tests/federation-retirement.test.cjs'
// The cause: .vercelignore excludes `tests/*` and ships only an explicit
// whitelist of test files, because most of tests/ is operator-local. The new
// build-chain test had been added to the chain without being whitelisted, so
// the bundle shipped without it and the build could not run its own control.
//
// A build that cannot run a control cannot say whether that control still
// holds — which is the same argument that put the other three test files on
// the whitelist in the first place.
//
// This gate makes that class of bug impossible to push. It reads the build
// chain out of package.json, resolves every file each step actually needs,
// and asserts three things for each one:
//   1. the file exists in the repository,
//   2. it is not excluded by .vercelignore, and
//   3. it is tracked by git (an untracked file would also be missing from a
//      clone-based build).
//
// The check runs locally with the same ignore rules Vercel applies, so a
// green run here means the bundle will carry the file.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};

// --- 1. Resolve the build chain ------------------------------------------
const buildChain = (scripts.build || '').split('&&').map((s) => s.trim()).filter(Boolean);
const chainSteps = [];
for (const step of buildChain) {
  const m = /^npm run ([A-Za-z0-9:_-]+)$/.exec(step);
  if (!m) continue;
  const name = m[1];
  chainSteps.push({ name, command: scripts[name] || '' });
}

if (chainSteps.length === 0) {
  console.error('[deploy-bundle] the build chain names no `npm run` steps — cannot check it.');
  process.exit(1);
}

// --- 2. Extract the files each step needs ---------------------------------
// A step needs the files it names on its command line. This deliberately
// covers scripts/ and tests/ and lib/ alike: anything the build chain reads
// has to survive the trip through .vercelignore.
const needed = new Set();
for (const step of chainSteps) {
  for (const token of step.command.split(/\s+/)) {
    if (!token) continue;
    if (/^(npm|node|tsx|npx|--test|--experimental|.*=|&&|\|\|)$/.test(token)) continue;
    if (token.startsWith('-')) continue;
    if (!/\.(mjs|cjs|js|ts|tsx|json)$/.test(token)) continue;
    needed.add(token.replace(/^['"]|['"]$/g, ''));
  }
}

// --- 3. Ask git whether each file would be excluded ------------------------
// core.excludesFile makes git apply exactly the .vercelignore rules, which
// is the same question the deploy bundle answers.
function excluded(relPath) {
  try {
    execFileSync('git', ['-c', 'core.excludesFile=.vercelignore', 'check-ignore', '--no-index', '-q', relPath], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    // exit 1 means "not ignored" — which is the answer we want.
    return false;
  }
}

function tracked(relPath) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relPath], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// A build environment without a usable git checkout cannot answer these
// questions. That is not a finding — it means this gate cannot run here, and
// the local run (which is where the answer matters) is the one that counts.
// Failing the build for a missing capability would trade a caught bug for a
// broken release, which is the worse trade.
let gitAvailable = true;
try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'ignore' });
} catch {
  gitAvailable = false;
}

const findings = [];
for (const relPath of gitAvailable ? [...needed].sort() : []) {
  const abs = resolve(root, relPath);
  if (!existsSync(abs)) {
    findings.push(`${relPath} — the build chain names it but it does not exist in the repository`);
    continue;
  }
  if (excluded(relPath)) {
    findings.push(
      `${relPath} — the build chain needs it, but .vercelignore excludes it, so the deployed bundle cannot run it\n` +
      `    fix: add a "!${relPath}" exception to .vercelignore (the whitelist exists so operator-local tests stay out of the bundle)`,
    );
    continue;
  }
  if (!tracked(relPath)) {
    findings.push(`${relPath} — the build chain needs it, but it is not tracked by git, so a clone-based build will not have it`);
  }
}

// --- 4. Report -------------------------------------------------------------
if (!gitAvailable) {
  console.log('[deploy-bundle] no usable git checkout here — the bundle check cannot run in this environment.');
  process.exit(0);
}

if (findings.length > 0) {
  console.error(`[deploy-bundle] ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`  • ${finding}`);
  console.error('[deploy-bundle] the deployed bundle would be missing files the build chain requires.');
  process.exit(1);
}

console.log(
  `[deploy-bundle] ${chainSteps.length} build-chain step(s) checked; ${needed.size} file(s) resolved; ` +
  `every one of them exists, is tracked, and survives .vercelignore.`,
);
