import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { scanFile } from '../scripts/audit-internal-surface.mjs';

/**
 * The internal-surface gate, pinned to the shapes it must fire on and
 * the shapes it must NOT fire on.
 *
 * The gate exists because the control plane shipped: a route that
 * returned the whole portfolio answered an anonymous `curl` with 200 and
 * 47 KB of the agency's book of business, and the dashboard page that
 * rendered it was a SERVER component, so the HTML carried it too.
 *
 * The first version of the collection rule asked "can this route REACH
 * a module that declares a tenant collection?" and answered yes twelve
 * times on routes that leak nothing — an ingestion route that returns
 * `{ ok, persisted }`, six payment routes that reach a MEMBERSHIP-TIER
 * table whose `slug` is a tier, and three reporting routes that
 * authenticate with a helper the gate had never heard of. A gate that
 * cries wolf gets ignored, so the rule was rewritten to follow the
 * RETURNED VALUE, and the auth markers were shared with the public-PII
 * gate instead of being typed a second time.
 *
 * These tests are the proof discipline the brief asks for: each rule is
 * seen to fire against the real defect, and to go quiet once the defect
 * is gone — and to stay quiet on the look-alikes that made the first
 * version unusable.
 */

type Tree = { root: string; write: (rel: string, src: string) => string };

function tree(): Tree {
  const root = mkdtempSync(join(tmpdir(), 'omni-internal-surface-'));
  const write = (rel: string, src: string) => {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, src);
    return path;
  };
  return { root, write };
}

/** A portfolio registry: one entry per client, in the agency's shape. */
const REGISTRY = `
export type RegistryEntry = { slug: string; businessName: string; tier: string };
export const CLIENT_REGISTRY: RegistryEntry[] = [
  { slug: 'cps', businessName: 'Clinical and Professional Solutions', tier: 'tier_1' },
  { slug: 'ltb', businessName: 'Love Thy Barber', tier: 'tier_2' },
];
`;

/** A membership tier table: it has a `slug`, and it is NOT a tenant. */
const TIERS = `
export type Tier = { slug: string; kind: string; tier: string; amount: number };
export const MEMBER_TIERS: Tier[] = [
  { slug: 'supporter', kind: 'membership', tier: 'supporter', amount: 500 },
  { slug: 'patron', kind: 'membership', tier: 'patron', amount: 2500 },
];
`;

/** The builder the control plane used: it maps the registry. */
const BUILDER = `
import { CLIENT_REGISTRY } from './registry';
export function buildSnapshot() {
  const businesses = CLIENT_REGISTRY.map((entry) => ({
    slug: entry.slug,
    businessName: entry.businessName,
    score: 90,
  }));
  return { generatedAt: 'now', summary: { total: businesses.length }, businesses };
}
`;

function routeFindings(t: Tree, src: string) {
  const path = t.write('app/api/portfolio/route.ts', src);
  return scanFile(path, t.root, ['/dashboard'], new Set());
}

function pageFindings(t: Tree, src: string) {
  const path = t.write('app/dashboard/control/page.tsx', src);
  return scanFile(path, t.root, ['/dashboard'], new Set());
}

test('a route that returns the portfolio with no credential check is a finding', () => {
  const t = tree();
  t.write('lib/registry.ts', REGISTRY);
  t.write('lib/builder.ts', BUILDER);

  const findings = routeFindings(
    t,
    `import { NextResponse } from 'next/server';
import { buildSnapshot } from '@/lib/builder';
export async function GET() {
  return NextResponse.json(buildSnapshot());
}
`,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'unauthenticated-tenant-collection');
  assert.match(findings[0].detail, /lib\/registry\.ts/);
});

test('the same route behind requireAdmin() is not a finding', () => {
  const t = tree();
  t.write('lib/registry.ts', REGISTRY);
  t.write('lib/builder.ts', BUILDER);

  const findings = routeFindings(
    t,
    `import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { buildSnapshot } from '@/lib/builder';
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;
  return NextResponse.json(buildSnapshot(), { headers: { 'Cache-Control': 'private, no-store' } });
}
`,
  );

  assert.deepEqual(findings, []);
});

test('a route that merely REACHES a registry without returning it is not a finding', () => {
  const t = tree();
  t.write('lib/registry.ts', REGISTRY);

  const findings = routeFindings(
    t,
    `import { NextResponse } from 'next/server';
import { CLIENT_REGISTRY } from '@/lib/registry';
export async function POST(request: Request) {
  const body = await request.json();
  const known = CLIENT_REGISTRY.some((entry) => entry.slug === body.slug);
  return NextResponse.json({ ok: true, persisted: known });
}
`,
  );

  assert.deepEqual(findings, []);
});

test('a membership-tier table is not a portfolio of clients', () => {
  const t = tree();
  t.write('lib/tiers.ts', TIERS);

  const findings = routeFindings(
    t,
    `import { NextResponse } from 'next/server';
import { MEMBER_TIERS } from '@/lib/tiers';
export async function GET() {
  return NextResponse.json(MEMBER_TIERS);
}
`,
  );

  assert.deepEqual(findings, []);
});

test('a route that authenticates with the shared helpers is not a finding', () => {
  const t = tree();
  t.write('lib/registry.ts', REGISTRY);
  t.write('lib/builder.ts', BUILDER);

  const findings = routeFindings(
    t,
    `import { NextResponse } from 'next/server';
import { serviceAuthorized, verifiedActor } from '@/lib/reporting-portfolio';
import { buildSnapshot } from '@/lib/builder';
export async function GET(request: Request) {
  if (!serviceAuthorized(request.headers.get('x-token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const actor = await verifiedActor('token');
  return NextResponse.json(buildSnapshot(), { headers: { 'Cache-Control': 'private, no-store' } });
}
`,
  );

  assert.deepEqual(findings, []);
});

test('an internal server component that renders the portfolio is a finding', () => {
  const t = tree();

  const findings = pageFindings(
    t,
    `import { buildSnapshot } from '@/lib/builder';
export default function ControlPage() {
  const snapshot = buildSnapshot();
  return <main>{snapshot.businesses.map((b) => <div key={b.slug}>{b.businessName}</div>)}</main>;
}
`,
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'internal-page-tenant-collection');
});

test('a client component that renders the portfolio is not a finding', () => {
  const t = tree();

  const findings = pageFindings(
    t,
    `'use client';
export default function ControlPage() {
  const snapshot = { businesses: [] as { slug: string }[] };
  return <main>{snapshot.businesses.map((b) => <div key={b.slug}>{b.slug}</div>)}</main>;
}
`,
  );

  assert.deepEqual(findings, []);
});
