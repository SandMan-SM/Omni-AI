#!/usr/bin/env node
/**
 * Read a production secret from Vercel without touching the local env files.
 *
 * Why this exists:
 *
 * An operator script that probes PRODUCTION has to authenticate with the
 * PRODUCTION secret. The local `.env.local` copy of `CRON_SECRET` has
 * drifted from production (see `npm run audit:env-drift`), and the drift is
 * invisible in the response: the endpoint answers 401 for a wrong secret
 * exactly as it answers 401 for a revoked bot token. The operator is left
 * unable to tell "my credential is stale" from "the thing is broken".
 *
 * Vercel stores a variable in one of two ways:
 *   - `encrypted` — the API returns the value, and `vercel env pull` writes
 *     it out. `CRON_SECRET` is one of these.
 *   - `sensitive` — the API returns an EMPTY value to everyone, including the
 *     account owner, and `env pull` writes `KEY=""`. There is nothing to
 *     read, and this helper reports that honestly instead of returning "".
 *
 * The pulled file lives in a temp directory and is deleted before the helper
 * returns. The value is never printed.
 *
 * Usage:
 *   import { productionSecret } from "./production-secret.mjs";
 *   const secret = await productionSecret("CRON_SECRET");
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Parse a `KEY=value` env file. */
function parseEnvFile(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * The production value of a Vercel environment variable.
 *
 * Returns null when the variable is not set in production, when Vercel
 * refuses to return it (`sensitive`), or when the CLI cannot be reached.
 * Never throws and never prints the value.
 */
export function productionSecret(name, options = {}) {
  const environment = options.environment || "production";
  const dir = mkdtempSync(join(tmpdir(), "omni-prod-secret-"));
  const file = join(dir, "production.env");
  try {
    execFileSync("npx", ["vercel", "env", "pull", file, `--environment=${environment}`, "--yes"], {
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
      timeout: options.timeoutMs || 120_000,
    });
    const value = parseEnvFile(file)[name];
    return value && value.length ? value : null;
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
