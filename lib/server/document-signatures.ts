import { Pool } from "pg";
import { DOCUMENT_SIGNATURE_CREDIT } from "@/lib/document-signatures";

export type DocumentSignatureInput = {
  id: string;
  userId: string;
  signerName: string;
  signerEmail: string;
  documentSlug: string;
  documentTitle: string;
  pageUrl?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  creditAwarded: number;
  raw: Record<string, unknown>;
};

export type DocumentSignatureRecord = {
  id: string;
  userId: string;
  signerName: string;
  signerEmail: string;
  documentSlug: string;
  documentTitle: string;
  signedAt: string;
  creditAwarded: number;
  emailStatus: string;
  emailMessageId: string | null;
  emailError: string | null;
};

export type PersistDocumentSignatureResult = {
  persisted: boolean;
  signature: DocumentSignatureRecord | null;
  status:
    | "direct-postgres-captured"
    | "direct-postgres-existing"
    | "direct-postgres-unavailable";
  alreadySigned: boolean;
  creditAwardedNow: number;
  error?: string;
};

export type DocumentSignatureEmailResult = {
  emailStatus: "sent" | "skipped" | "failed" | "timeout";
  emailMessageId?: string | null;
  emailError?: string | null;
};

export type DocumentSignerProfile = {
  email: string | null;
  username: string | null;
  name: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __documentSignaturePgPool: Pool | undefined;
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

  if (!global.__documentSignaturePgPool) {
    global.__documentSignaturePgPool = new Pool({
      connectionString: parsed.toString(),
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return global.__documentSignaturePgPool;
}

function mapSignatureRow(row: {
  id: string;
  user_id: string;
  signer_name: string;
  signer_email: string;
  document_slug: string;
  document_title: string;
  signed_at: Date | string;
  credit_awarded: number;
  email_status: string;
  email_message_id: string | null;
  email_error: string | null;
}): DocumentSignatureRecord {
  return {
    id: row.id,
    userId: row.user_id,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    documentSlug: row.document_slug,
    documentTitle: row.document_title,
    signedAt:
      row.signed_at instanceof Date
        ? row.signed_at.toISOString()
        : row.signed_at,
    creditAwarded: row.credit_awarded,
    emailStatus: row.email_status,
    emailMessageId: row.email_message_id,
    emailError: row.email_error,
  };
}

async function ensureTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.omni_program_signatures (
      id uuid PRIMARY KEY,
      user_id text NOT NULL,
      signer_name text NOT NULL,
      signer_email text NOT NULL,
      document_slug text NOT NULL DEFAULT 'omni-program',
      document_title text NOT NULL DEFAULT 'The Omni Program',
      page_url text,
      ip_address inet,
      user_agent text,
      docusign_status text NOT NULL DEFAULT 'connector-unavailable',
      docusign_envelope_id text,
      credit_awarded integer NOT NULL DEFAULT ${DOCUMENT_SIGNATURE_CREDIT},
      email_status text NOT NULL DEFAULT 'pending',
      email_message_id text,
      email_error text,
      raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      signed_at timestamptz NOT NULL DEFAULT NOW(),
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE public.omni_program_signatures
      ADD COLUMN IF NOT EXISTS document_slug text NOT NULL DEFAULT 'omni-program',
      ADD COLUMN IF NOT EXISTS document_title text NOT NULL DEFAULT 'The Omni Program',
      ADD COLUMN IF NOT EXISTS credit_awarded integer NOT NULL DEFAULT ${DOCUMENT_SIGNATURE_CREDIT},
      ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS email_message_id text,
      ADD COLUMN IF NOT EXISTS email_error text
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS omni_program_signatures_user_document_unique_idx
    ON public.omni_program_signatures (user_id, document_slug)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS omni_program_signatures_user_signed_idx
    ON public.omni_program_signatures (user_id, signed_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS omni_program_signatures_email_signed_idx
    ON public.omni_program_signatures (lower(signer_email), signed_at DESC)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.omni_program_credit_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      signature_id uuid UNIQUE REFERENCES public.omni_program_signatures(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      signer_email text NOT NULL,
      document_slug text NOT NULL DEFAULT 'omni-program',
      document_title text NOT NULL DEFAULT 'The Omni Program',
      points_awarded integer NOT NULL DEFAULT ${DOCUMENT_SIGNATURE_CREDIT},
      reason text NOT NULL DEFAULT 'omni-program-acknowledgement',
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE public.omni_program_credit_events
      ADD COLUMN IF NOT EXISTS document_slug text NOT NULL DEFAULT 'omni-program',
      ADD COLUMN IF NOT EXISTS document_title text NOT NULL DEFAULT 'The Omni Program'
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS omni_program_credit_events_user_document_unique_idx
    ON public.omni_program_credit_events (user_id, document_slug)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS omni_program_credit_events_user_created_idx
    ON public.omni_program_credit_events (user_id, created_at DESC)
  `);
}

export async function findDocumentSignature(
  userId: string,
  documentSlug: string,
): Promise<DocumentSignatureRecord | null> {
  const pool = getPool();
  await ensureTable(pool);
  const { rows } = await pool.query(
    `
      SELECT
        id, user_id, signer_name, signer_email, document_slug, document_title,
        signed_at, credit_awarded, email_status, email_message_id, email_error
      FROM public.omni_program_signatures
      WHERE user_id = $1 AND document_slug = $2
      LIMIT 1
    `,
    [userId, documentSlug],
  );
  return rows[0] ? mapSignatureRow(rows[0]) : null;
}

export async function resolveDocumentSignerProfile(
  userId: string,
): Promise<DocumentSignerProfile> {
  const pool = getPool();
  await ensureTable(pool);
  const { rows } = await pool.query<{
    email: string | null;
    username: string | null;
    name: string | null;
  }>(
    `
      SELECT email, username, name
      FROM public.profiles
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );
  return rows[0] || { email: null, username: null, name: null };
}

export async function persistDocumentSignature(
  input: DocumentSignatureInput,
): Promise<PersistDocumentSignatureResult> {
  try {
    const pool = getPool();
    await ensureTable(pool);

    const inserted = await pool.query(
      `
        INSERT INTO public.omni_program_signatures (
          id, user_id, signer_name, signer_email, document_slug, document_title,
          page_url, ip_address, user_agent, docusign_status, credit_awarded, raw_payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,NULLIF($8, '')::inet,$9,'connector-unavailable',$10,$11::jsonb)
        ON CONFLICT (user_id, document_slug) DO NOTHING
        RETURNING
          id, user_id, signer_name, signer_email, document_slug, document_title,
          signed_at, credit_awarded, email_status, email_message_id, email_error
      `,
      [
        input.id,
        input.userId,
        input.signerName,
        input.signerEmail,
        input.documentSlug,
        input.documentTitle,
        input.pageUrl || null,
        input.ipAddress || null,
        input.userAgent || null,
        input.creditAwarded,
        JSON.stringify(input.raw),
      ],
    );

    if (!inserted.rows[0]) {
      const existing = await findDocumentSignature(input.userId, input.documentSlug);
      return {
        persisted: true,
        signature: existing,
        status: "direct-postgres-existing",
        alreadySigned: true,
        creditAwardedNow: 0,
      };
    }

    const signature = mapSignatureRow(inserted.rows[0]);
    await pool.query(
      `
        INSERT INTO public.omni_program_credit_events (
          signature_id, user_id, signer_email, document_slug, document_title,
          points_awarded, reason
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (user_id, document_slug) DO NOTHING
      `,
      [
        signature.id,
        input.userId,
        input.signerEmail,
        input.documentSlug,
        input.documentTitle,
        input.creditAwarded,
        `${input.documentSlug}-acknowledgement`,
      ],
    );

    return {
      persisted: true,
      signature,
      status: "direct-postgres-captured",
      alreadySigned: false,
      creditAwardedNow: input.creditAwarded,
    };
  } catch (error) {
    console.error("[document-signatures] capture failed:", error);
    return {
      persisted: false,
      signature: null,
      status: "direct-postgres-unavailable",
      alreadySigned: false,
      creditAwardedNow: 0,
      error:
        error instanceof Error
          ? error.message
          : "signature persistence failed",
    };
  }
}

export async function updateDocumentSignatureEmailResult(
  signatureId: string,
  result: DocumentSignatureEmailResult,
) {
  try {
    const pool = getPool();
    await ensureTable(pool);
    await pool.query(
      `
        UPDATE public.omni_program_signatures
        SET email_status = $2,
            email_message_id = $3,
            email_error = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        signatureId,
        result.emailStatus,
        result.emailMessageId || null,
        result.emailError || null,
      ],
    );
  } catch (error) {
    console.error("[document-signatures] email result update failed:", error);
  }
}
