import { Pool } from "pg";

export const NEWSLETTER_STAR_CREDIT = 5;

export type NewsletterStarCreditInput = {
  id: string;
  userId: string;
  readerEmail: string;
  newsletterSlug: string;
  newsletterTitle: string;
  pageUrl?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  raw: Record<string, unknown>;
  creditAwarded: number;
};

export type NewsletterStarCreditRecord = {
  id: string;
  userId: string;
  readerEmail: string;
  newsletterSlug: string;
  newsletterTitle: string;
  claimedAt: string;
  creditAwarded: number;
};

export type PersistNewsletterStarCreditResult = {
  persisted: boolean;
  claim: NewsletterStarCreditRecord | null;
  status:
    | "direct-postgres-captured"
    | "direct-postgres-existing"
    | "direct-postgres-unavailable";
  alreadyClaimed: boolean;
  creditAwardedNow: number;
  error?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __newsletterStarCreditPgPool: Pool | undefined;
}

function databaseUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
}

function shouldUseSsl(url: string) {
  return Boolean(url) && !url.includes("localhost") && !url.includes("127.0.0.1");
}

function getPool() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not configured");
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");

  if (!global.__newsletterStarCreditPgPool) {
    global.__newsletterStarCreditPgPool = new Pool({
      connectionString: parsed.toString(),
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return global.__newsletterStarCreditPgPool;
}

function mapClaimRow(row: {
  id: string;
  user_id: string;
  reader_email: string;
  newsletter_slug: string;
  newsletter_title: string;
  claimed_at: Date | string;
  credit_awarded: number;
}): NewsletterStarCreditRecord {
  return {
    id: row.id,
    userId: row.user_id,
    readerEmail: row.reader_email,
    newsletterSlug: row.newsletter_slug,
    newsletterTitle: row.newsletter_title,
    claimedAt:
      row.claimed_at instanceof Date
        ? row.claimed_at.toISOString()
        : row.claimed_at,
    creditAwarded: row.credit_awarded,
  };
}

async function ensureTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.newsletter_star_credit_claims (
      id uuid PRIMARY KEY,
      user_id text NOT NULL,
      reader_email text NOT NULL,
      newsletter_slug text NOT NULL,
      newsletter_title text NOT NULL,
      page_url text,
      ip_address inet,
      user_agent text,
      credit_awarded integer NOT NULL DEFAULT ${NEWSLETTER_STAR_CREDIT},
      raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      claimed_at timestamptz NOT NULL DEFAULT NOW(),
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS newsletter_star_credit_claims_user_slug_unique_idx
    ON public.newsletter_star_credit_claims (user_id, newsletter_slug)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS newsletter_star_credit_claims_user_claimed_idx
    ON public.newsletter_star_credit_claims (user_id, claimed_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS newsletter_star_credit_claims_email_claimed_idx
    ON public.newsletter_star_credit_claims (lower(reader_email), claimed_at DESC)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.newsletter_star_credit_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id uuid UNIQUE REFERENCES public.newsletter_star_credit_claims(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      reader_email text NOT NULL,
      newsletter_slug text NOT NULL,
      newsletter_title text NOT NULL,
      points_awarded integer NOT NULL DEFAULT ${NEWSLETTER_STAR_CREDIT},
      reason text NOT NULL DEFAULT 'newsletter-star-credit',
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS newsletter_star_credit_events_user_slug_unique_idx
    ON public.newsletter_star_credit_events (user_id, newsletter_slug)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS newsletter_star_credit_events_user_created_idx
    ON public.newsletter_star_credit_events (user_id, created_at DESC)
  `);
}

export async function findNewsletterStarCredit(
  userId: string,
  newsletterSlug: string,
): Promise<NewsletterStarCreditRecord | null> {
  const pool = getPool();
  await ensureTable(pool);
  const { rows } = await pool.query(
    `
      SELECT
        id, user_id, reader_email, newsletter_slug, newsletter_title,
        claimed_at, credit_awarded
      FROM public.newsletter_star_credit_claims
      WHERE user_id = $1 AND newsletter_slug = $2
      LIMIT 1
    `,
    [userId, newsletterSlug],
  );
  return rows[0] ? mapClaimRow(rows[0]) : null;
}

export async function persistNewsletterStarCredit(
  input: NewsletterStarCreditInput,
): Promise<PersistNewsletterStarCreditResult> {
  try {
    const pool = getPool();
    await ensureTable(pool);

    const inserted = await pool.query(
      `
        INSERT INTO public.newsletter_star_credit_claims (
          id, user_id, reader_email, newsletter_slug, newsletter_title,
          page_url, ip_address, user_agent, credit_awarded, raw_payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7, '')::inet,$8,$9,$10::jsonb)
        ON CONFLICT (user_id, newsletter_slug) DO NOTHING
        RETURNING
          id, user_id, reader_email, newsletter_slug, newsletter_title,
          claimed_at, credit_awarded
      `,
      [
        input.id,
        input.userId,
        input.readerEmail,
        input.newsletterSlug,
        input.newsletterTitle,
        input.pageUrl || null,
        input.ipAddress || null,
        input.userAgent || null,
        input.creditAwarded,
        JSON.stringify(input.raw),
      ],
    );

    if (!inserted.rows[0]) {
      const existing = await findNewsletterStarCredit(
        input.userId,
        input.newsletterSlug,
      );
      return {
        persisted: true,
        claim: existing,
        status: "direct-postgres-existing",
        alreadyClaimed: true,
        creditAwardedNow: 0,
      };
    }

    const claim = mapClaimRow(inserted.rows[0]);
    await pool.query(
      `
        INSERT INTO public.newsletter_star_credit_events (
          claim_id, user_id, reader_email, newsletter_slug, newsletter_title,
          points_awarded, reason
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (user_id, newsletter_slug) DO NOTHING
      `,
      [
        claim.id,
        input.userId,
        input.readerEmail,
        input.newsletterSlug,
        input.newsletterTitle,
        input.creditAwarded,
        "newsletter-star-credit",
      ],
    );

    return {
      persisted: true,
      claim,
      status: "direct-postgres-captured",
      alreadyClaimed: false,
      creditAwardedNow: input.creditAwarded,
    };
  } catch (error) {
    console.error("[newsletter-star-credits] capture failed:", error);
    return {
      persisted: false,
      claim: null,
      status: "direct-postgres-unavailable",
      alreadyClaimed: false,
      creditAwardedNow: 0,
      error:
        error instanceof Error
          ? error.message
          : "newsletter star credit persistence failed",
    };
  }
}
