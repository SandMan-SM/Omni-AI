import { Pool } from "pg";

type BookingInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  purpose: string;
  date: string;
  time: string;
  scheduledAt: string;
  raw: Record<string, unknown>;
};

type BookingPersistResult = {
  persisted: boolean;
  leadId: string | null;
  crmStatus: "direct-postgres-crm-created" | "direct-postgres-captured" | "direct-postgres-unavailable";
  error?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __omniPgPool: Pool | undefined;
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

  if (!global.__omniPgPool) {
    global.__omniPgPool = new Pool({
      connectionString: url,
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_500,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return global.__omniPgPool;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

async function ensureBookingSubmissionsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.booking_submissions (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      business_name TEXT,
      purpose TEXT,
      requested_date TEXT,
      requested_time TEXT,
      scheduled_at TIMESTAMPTZ,
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      crm_lead_id UUID,
      crm_status TEXT NOT NULL DEFAULT 'captured',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_booking_submissions_email_created
      ON public.booking_submissions (email, created_at DESC);
  `);
}

async function persistBookingNow(input: BookingInput): Promise<BookingPersistResult> {
  const pool = getPool();
  await ensureBookingSubmissionsTable(pool);

  await pool.query("SET statement_timeout TO '2500ms'");

  await pool.query(
    `
      INSERT INTO public.booking_submissions (
        id, name, email, phone, business_name, purpose,
        requested_date, requested_time, scheduled_at, raw_payload
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        business_name = EXCLUDED.business_name,
        purpose = EXCLUDED.purpose,
        requested_date = EXCLUDED.requested_date,
        requested_time = EXCLUDED.requested_time,
        scheduled_at = EXCLUDED.scheduled_at,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
    `,
    [
      input.id,
      input.name,
      input.email,
      input.phone || null,
      input.businessName || null,
      input.purpose || null,
      input.date,
      input.time,
      input.scheduledAt,
      JSON.stringify(input.raw),
    ],
  );

  try {
    await pool.query("SET statement_timeout TO '1500ms'");
    const business = await pool.query<{ id: string }>(
      "SELECT id FROM public.omni_businesses WHERE name = 'Omni AI' LIMIT 1",
    );
    const businessId = business.rows[0]?.id;
    if (!businessId) {
      return { persisted: true, leadId: null, crmStatus: "direct-postgres-captured" };
    }

    const { firstName, lastName } = splitName(input.name);
    const notes = [
      `Strategy call booked for ${input.date || "TBD"} ${input.time || ""}`.trim(),
      input.purpose ? `Purpose: ${input.purpose}` : null,
      input.businessName ? `Business: ${input.businessName}` : null,
      `Booking submission id: ${input.id}`,
    ].filter(Boolean).join("\n");

    const lead = await pool.query<{ id: string }>(
      `
        INSERT INTO public.omni_leads_generated (
          business_id, source_table, source_record_id,
          first_name, last_name, email, phone, company,
          source, status, score, deal_stage, notes, tags, created_at
        )
        VALUES (
          $1, 'booking_submissions', $2,
          $3, $4, $5, $6, $7,
          'web', 'qualified', 85, 'demo', $8, $9::text[], NOW()
        )
        RETURNING id
      `,
      [
        businessId,
        input.id,
        firstName,
        lastName,
        input.email,
        input.phone || null,
        input.businessName || null,
        notes,
        ["book-now", "strategy-call", "direct-postgres"],
      ],
    );

    const leadId = lead.rows[0]?.id ?? null;
    if (leadId) {
      await pool.query(
        "UPDATE public.booking_submissions SET crm_lead_id = $1, crm_status = 'crm_created', updated_at = NOW() WHERE id = $2",
        [leadId, input.id],
      );
    }

    return { persisted: true, leadId, crmStatus: "direct-postgres-crm-created" };
  } catch (error) {
    console.error("[direct-postgres] CRM mirror failed after capture:", error);
    return { persisted: true, leadId: null, crmStatus: "direct-postgres-captured" };
  }
}

export async function persistBookingSubmission(input: BookingInput): Promise<BookingPersistResult> {
  try {
    return await Promise.race([
      persistBookingNow(input),
      new Promise<BookingPersistResult>((resolve) =>
        setTimeout(() => resolve({
          persisted: false,
          leadId: null,
          crmStatus: "direct-postgres-unavailable",
          error: "direct postgres persistence timed out",
        }), 4_500),
      ),
    ]);
  } catch (error) {
    console.error("[direct-postgres] booking capture failed:", error);
    return {
      persisted: false,
      leadId: null,
      crmStatus: "direct-postgres-unavailable",
      error: error instanceof Error ? error.message : "direct postgres persistence failed",
    };
  }
}
