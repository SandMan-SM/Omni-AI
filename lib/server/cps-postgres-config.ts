import type { PoolConfig } from "pg";

type CpsDatabaseEnvironment = {
  NODE_ENV?: string;
  CPS_DATABASE_CA_CERT?: string;
  IX_DATABASE_CA_CERT?: string;
};

/**
 * Build explicit pg options rather than passing connectionString to pg: its URL
 * parser overrides an explicit ssl object with ssl/sslmode/cert query options.
 * URL query options are deliberately ignored. Only the operator's dedicated CA
 * setting can change the trust roots; certificate verification stays enabled.
 */
export function cpsPostgresConfig(
  connectionString: string,
  env: CpsDatabaseEnvironment = process.env,
): PoolConfig {
  try {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
      throw new Error("invalid_database_url");
    }
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const port = Number(url.port || 5432);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid_database_port");
    const developmentLoopback = env.NODE_ENV === "development" &&
      ["127.0.0.1", "localhost", "::1"].includes(host);
    // Both workflows use the same Supabase project. Prefer a dedicated CPS
    // trust root, otherwise reuse the operator-configured shared-project CA.
    // No URL/env sslmode option can disable certificate verification.
    const configuredCa = env.CPS_DATABASE_CA_CERT || env.IX_DATABASE_CA_CERT;
    return {
      host,
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: developmentLoopback ? false : {
        rejectUnauthorized: true,
        ...(configuredCa ? { ca: configuredCa.replace(/\\n/g, "\n") } : {}),
      },
    };
  } catch {
    // Never include the URL or credentials in a parse error.
    throw new Error("invalid_database_configuration");
  }
}

