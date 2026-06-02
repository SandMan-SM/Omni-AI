import { Pool } from "pg";

export type OmniProgramSignatureInput = {
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

export type OmniProgramSignatureResult = {
  persisted: boolean;
  signatureId: string;
  status: "direct-postgres-captured" | "direct-postgres-queued" | "direct-postgres-unavailable";
  docusignStatus: "connector-unavailable";
  creditAwarded: number;
  error?: string;
};

export type OmniProgramSignatureEmailResult = {
  emailStatus: "sent" | "skipped" | "failed" | "timeout";
  emailMessageId?: string | null;
  emailError?: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __omniProgramSignaturePgPool: Pool | undefined;
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

  if (!global.__omniProgramSignaturePgPool) {
    global.__omniProgramSignaturePgPool = new Pool({
      connectionString: parsed.toString(),
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return global.__omniProgramSignaturePgPool;
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
      credit_awarded integer NOT NULL DEFAULT 10,
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
      ADD COLUMN IF NOT EXISTS credit_awarded integer NOT NULL DEFAULT 10,
      ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS email_message_id text,
      ADD COLUMN IF NOT EXISTS email_error text
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.omni_program_credit_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      signature_id uuid UNIQUE REFERENCES public.omni_program_signatures(id) ON DELETE CASCADE,
      user_id text NOT NULL,
      signer_email text NOT NULL,
      points_awarded integer NOT NULL DEFAULT 10,
      reason text NOT NULL DEFAULT 'omni-program-acknowledgement',
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
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
    CREATE INDEX IF NOT EXISTS omni_program_credit_events_user_created_idx
    ON public.omni_program_credit_events (user_id, created_at DESC)
  `);
}

async function persistNow(
  input: OmniProgramSignatureInput,
): Promise<OmniProgramSignatureResult> {
  const pool = getPool();
  await ensureTable(pool);
  await pool.query(
    `
      INSERT INTO public.omni_program_signatures (
        id, user_id, signer_name, signer_email, document_slug, document_title,
        page_url, ip_address, user_agent, docusign_status, credit_awarded, raw_payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NULLIF($8, '')::inet,$9,'connector-unavailable',$10,$11::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        signer_name = EXCLUDED.signer_name,
        signer_email = EXCLUDED.signer_email,
        document_slug = EXCLUDED.document_slug,
        document_title = EXCLUDED.document_title,
        page_url = EXCLUDED.page_url,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        credit_awarded = EXCLUDED.credit_awarded,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
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
  await pool.query(
    `
      INSERT INTO public.omni_program_credit_events (
        signature_id, user_id, signer_email, points_awarded, reason
      )
      VALUES ($1,$2,$3,$4,'omni-program-acknowledgement')
      ON CONFLICT (signature_id) DO UPDATE SET
        signer_email = EXCLUDED.signer_email,
        points_awarded = EXCLUDED.points_awarded
    `,
    [input.id, input.userId, input.signerEmail, input.creditAwarded],
  );

  return {
    persisted: true,
    signatureId: input.id,
    status: "direct-postgres-captured",
    docusignStatus: "connector-unavailable",
    creditAwarded: input.creditAwarded,
  };
}

export async function persistOmniProgramSignature(
  input: OmniProgramSignatureInput,
): Promise<OmniProgramSignatureResult> {
  try {
    return await Promise.race([
      persistNow(input),
      new Promise<OmniProgramSignatureResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              persisted: false,
              signatureId: input.id,
              status: "direct-postgres-queued",
              docusignStatus: "connector-unavailable",
              creditAwarded: input.creditAwarded,
              error: "direct postgres signature persistence still running",
            }),
          1_000,
        ),
      ),
    ]);
  } catch (error) {
    console.error("[omni-program-signatures] capture failed:", error);
    return {
      persisted: false,
      signatureId: input.id,
      status: "direct-postgres-unavailable",
      docusignStatus: "connector-unavailable",
      creditAwarded: input.creditAwarded,
      error: error instanceof Error ? error.message : "signature persistence failed",
    };
  }
}

export async function updateOmniProgramSignatureEmailResult(
  signatureId: string,
  result: OmniProgramSignatureEmailResult,
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
    console.error("[omni-program-signatures] email result update failed:", error);
  }
}
