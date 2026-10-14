import type { PoolConfig } from "pg";

type IxDatabaseEnvironment = {
  NODE_ENV?: string;
  IX_DATABASE_CA_CERT?: string;
};

/**
 * Build explicit pg options rather than passing connectionString to pg: its URL
 * parser overrides an explicit ssl object with ssl/sslmode/cert query options.
 * URL query options are deliberately ignored. Only the operator's dedicated CA
 * setting can change the trust roots; certificate verification stays enabled.
 */
export function ixPostgresConfig(
  connectionString: string,
  env: IxDatabaseEnvironment = process.env,
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
    return {
      host,
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: developmentLoopback ? false : {
        rejectUnauthorized: true,
        ...(env.IX_DATABASE_CA_CERT ? { ca: env.IX_DATABASE_CA_CERT.replace(/\\n/g, "\n") } : {}),
      },
    };
  } catch {
    // Never include the URL or credentials in a parse error.
    throw new Error("invalid_database_configuration");
  }
}
