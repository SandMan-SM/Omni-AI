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
  crmStatus: "direct-postgres-crm-created" | "direct-postgres-captured" | "direct-postgres-queued" | "direct-postgres-unavailable";
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
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");

  if (!global.__omniPgPool) {
    global.__omniPgPool = new Pool({
      connectionString: parsed.toString(),
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 2_500,
      ssl: shouldUseSsl(url) ? { rejectUnauthorized: false } : undefined,
    });
  }

  return global.__omniPgPool;
}

async function persistBookingNow(input: BookingInput): Promise<BookingPersistResult> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(
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

    return { persisted: true, leadId: null, crmStatus: "direct-postgres-captured" };
  } finally {
    client.release();
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
          crmStatus: "direct-postgres-queued",
          error: "direct postgres persistence still running",
        }), 1_000),
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
