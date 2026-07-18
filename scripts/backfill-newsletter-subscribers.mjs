#!/usr/bin/env node
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');
const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!url) throw new Error('POSTGRES_URL or DATABASE_URL is required');

const parsed = new URL(url);
parsed.searchParams.delete('sslmode');
const pool = new Pool({
  connectionString: parsed.toString(),
  max: 1,
  connectionTimeoutMillis: 8_000,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
});

const siteAliases = {
  omni: 'omnileads',
  mythos: 'mythosais',
  mythosais: 'mythosais',
  'utah-main-street': 'mainst',
  utahmainstreet: 'mainst',
  theixnetwork: 'theixnetwork',
  obsidiancasino: 'obsidiancasino',
};

const keyFor = (slug, email) => `${slug}\u0000${email.trim().toLowerCase()}`;
const rows = new Map();
const add = ({ slug, email, name, source, createdAt, props = {} }) => {
  if (!slug || typeof email !== 'string') return;
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return;
  const key = keyFor(slug, normalized);
  if (!rows.has(key)) rows.set(key, { slug, email: normalized, name: name || normalized.split('@')[0], source: source || 'subscribe', createdAt: createdAt || new Date(), props });
};

const client = await pool.connect();
try {
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'inbound\\_%\\_leads' ESCAPE '\\'
    ORDER BY table_name
  `);

  for (const { table_name: table } of tables.rows) {
    if (!/^inbound_[a-z0-9_]+_leads$/.test(table)) continue;
    const columns = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
      [table],
    );
    const names = new Set(columns.rows.map((r) => r.column_name));
    if (!names.has('email')) continue;
    const slug = table.slice('inbound_'.length, -'_leads'.length);
    const nameExpr = names.has('full_name') ? 'full_name' : names.has('name') ? 'name' : 'NULL::text';
    const sourceExpr = names.has('source') ? 'source' : 'NULL::text';
    const pageExpr = names.has('page_path') ? 'page_path' : names.has('path') ? 'path' : 'NULL::text';
    const createdExpr = names.has('created_at') ? 'created_at' : 'NOW()';
    const result = await client.query(`
      SELECT email, ${nameExpr} AS name, ${sourceExpr} AS source, ${pageExpr} AS page_path, ${createdExpr} AS created_at
      FROM public."${table}"
      WHERE email IS NOT NULL
        AND (
          lower(coalesce(${sourceExpr}, '')) LIKE '%sub%'
          OR lower(coalesce(${sourceExpr}, '')) LIKE '%newsletter%'
          OR coalesce(${pageExpr}, '') = '/subscribe'
        )
    `);
    for (const row of result.rows) add({ slug, email: row.email, name: row.name, source: row.source, createdAt: row.created_at, props: { backfill: true, source_table: table } });
  }

  const federation = await client.query(`
    SELECT site, email, first_name, source, created_at
    FROM public.federation_newsletter_subscribers
    WHERE coalesce(unsubscribed, false) = false
  `);
  for (const row of federation.rows) add({
    slug: siteAliases[row.site] || row.site,
    email: row.email,
    name: row.first_name,
    source: row.source,
    createdAt: row.created_at,
    props: { backfill: true, source_table: 'federation_newsletter_subscribers', publication_site: row.site },
  });

  const existing = await client.query(`
    SELECT DISTINCT ON (tenant_slug, lower(email)) tenant_slug, email, created_at, props
    FROM analytics.newsletter_events
    WHERE action = 'subscribe' AND email IS NOT NULL
    ORDER BY tenant_slug, lower(email), created_at
  `);
  for (const row of existing.rows) add({ slug: row.tenant_slug, email: row.email, createdAt: row.created_at, props: row.props || {} });

  const candidates = [...rows.values()];
  const byTenant = candidates.reduce((acc, row) => ({ ...acc, [row.slug]: (acc[row.slug] || 0) + 1 }), {});
  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', candidates: candidates.length, byTenant }, null, 2));

  if (!APPLY) process.exitCode = 0;
  else {
    await client.query('BEGIN');
    let newsletterInserted = 0;
    let leadsInserted = 0;
    for (const row of candidates) {
      const newsletter = await client.query(`
        INSERT INTO analytics.newsletter_events (tenant_slug, email, action, props, created_at)
        SELECT $1, $2, 'subscribe', $3::jsonb, $4
        WHERE NOT EXISTS (
          SELECT 1 FROM analytics.newsletter_events
          WHERE tenant_slug = $1 AND lower(email) = lower($2) AND action = 'subscribe'
        )
        RETURNING 1
      `, [row.slug, row.email, JSON.stringify(row.props), row.createdAt]);
      newsletterInserted += newsletter.rowCount || 0;

      const lead = await client.query(`
        INSERT INTO analytics.leads
          (tenant_slug, name, email, source, dedup_key, props, created_at)
        VALUES ($1, $2, $3, 'subscribe', $4, $5::jsonb, $6)
        ON CONFLICT (tenant_slug, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
        RETURNING 1
      `, [row.slug, row.name, row.email, `sub:${row.email}`, JSON.stringify(row.props), row.createdAt]);
      leadsInserted += lead.rowCount || 0;
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ newsletterInserted, leadsInserted }, null, 2));
  }
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  throw error;
} finally {
  client.release();
  await pool.end();
}
