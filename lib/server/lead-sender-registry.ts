import { Pool } from 'pg';
import { leadSenderFor } from '@/lib/lead-sender';

/**
 * Reads the federation's lead sending identity from the database.
 *
 * `federation.lead_senders` is THE authority for the From address on any
 * "someone filled out a form" alert. Before it existed, that identity was
 * scattered across ~20 files in six repositories with no way to ask what
 * correct looked like — which is how two senders ended up left on
 * omnileadsagi.com after that domain was removed from Resend, and how SFD
 * Empire's fail-closed intake went on rejecting real submissions for a week
 * without anyone seeing it.
 *
 * The table joins `federation.mail_domains`, so a sender whose domain has been
 * removed at the provider resolves to NULL here rather than to a value that
 * would be rejected on send.
 *
 * DEGRADED-DB RULE, and it is the important one: a slow or unreachable database
 * must NEVER stop a lead alert. Several intake routes are fail-closed on the
 * owner receipt, so returning nothing would turn a database blip into a 503 on
 * a real visitor's form — the exact failure this registry exists to prevent.
 * Every path below falls back to the derived address from lib/lead-sender.ts,
 * which is the same value the table holds.
 */

declare global {
  // eslint-disable-next-line no-var
  var __omniLeadSenderPool: Pool | undefined;
}

function pool(): Pool | null {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
  if (!url) return null;
  if (!global.__omniLeadSenderPool) {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    global.__omniLeadSenderPool = new Pool({
      connectionString: parsed.toString(),
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 4_000,
      ssl:
        url.includes('localhost') || url.includes('127.0.0.1')
          ? undefined
          : { rejectUnauthorized: false },
    });
  }
  return global.__omniLeadSenderPool;
}

type Row = { tenant_slug: string; from_address: string };

let cache: { at: number; rows: Map<string, string> } | null = null;
const TTL_MS = 60_000;

async function load(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const p = pool();
  if (p) {
    try {
      const res = await Promise.race([
        p.query<Row>(
          `select s.tenant_slug, s.from_address
             from federation.lead_senders s
             join federation.mail_domains d on d.domain = s.domain
            where s.active and d.status = 'verified'`,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('lead-sender registry timed out')), 3_000),
        ),
      ]);
      if (res.rows.length) {
        const rows = new Map(res.rows.map((r) => [r.tenant_slug, r.from_address]));
        cache = { at: Date.now(), rows };
        return rows;
      }
    } catch (e) {
      console.error(
        '[lead-sender-registry] load failed, using derived senders:',
        e instanceof Error ? e.message : e,
      );
    }
  }
  // Last-known good beats a derived guess; a derived guess beats sending nothing.
  return cache?.rows ?? new Map();
}

/**
 * The From address for a tenant's lead alert.
 *
 * Registry first, derived value second. Never throws and never returns empty —
 * a caller on a fail-closed route can use the result unconditionally.
 */
export async function resolveLeadSender(slug: string): Promise<string> {
  const rows = await load();
  return rows.get(slug) || leadSenderFor(slug);
}
