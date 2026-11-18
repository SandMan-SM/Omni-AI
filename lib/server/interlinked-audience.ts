import { Pool } from "pg";
import { ixPostgresConfig } from "./ix-postgres-config";

let pool: Pool | undefined;

export function interlinkedDatabase() {
  pool ??= new Pool({
    ...ixPostgresConfig(process.env.POSTGRES_URL || process.env.DATABASE_URL || ""),
    max: 3, connectionTimeoutMillis: 6000, statement_timeout: 12000,
  });
  return pool;
}

export async function recipientsForLegacyNewsletter(recipientEmails: string[]) {
  if (!recipientEmails.length) return [];
  const { rows } = await interlinkedDatabase().query<{ email: string }>(`
    select email from public.editorial_readers
    where completed_at is not null and consent_at is not null and email = any($1::text[])
  `, [recipientEmails.map(email => email.trim().toLowerCase())]);
  const editorial = new Set(rows.map(row => row.email));
  return recipientEmails.filter(email => !editorial.has(email.trim().toLowerCase()));
}
