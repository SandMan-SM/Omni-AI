/**
 * Codemod (pass 2): swap the cookie-bound SESSION client for the
 * service-role client in routes that are already auth-gated.
 *
 * WHY: the session client resolves `auth.uid()`, so it can read a user's
 * OWN rows — but it cannot read operator tables whose RLS policy is
 * `service_role` only. Against those it returns [] on read and silently
 * no-ops on write, exactly like the stateless anon client.
 *
 * Every file on this list is behind an auth gate, and every table it
 * touches is operator data (a subscriber list, a deployment log, an agent
 * command bus) rather than a user's own rows. `profiles` — the canonical
 * user-scoped table — is NOT here.
 *
 * Usage: node scripts/codemod-session-to-admin.mjs [--dry]
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry");

/** Files whose session client must become the service role, and why. */
const ALLOWLIST = {
  "app/api/newsletter/route.ts":
    "admin subscriber list + event log; newsletter_subscriptions is service-role-only",
  "app/api/newsletter/import/route.ts":
    "admin subscriber import; newsletter_subscriptions is service-role-only",
  "app/api/newsletter/export/route.ts":
    "admin subscriber export; newsletter_subscriptions is service-role-only",
  "app/api/demo-booking/route.ts":
    "admin demo-booking list; demo_bookings is service-role-only",
  "app/api/agents/commands/route.ts":
    "admin command bus; agent_commands is service-role-only",
  "app/api/agents/deployments/route.ts":
    "admin deployment log; website_deployments is service-role-only",
  "app/api/agents/visual-errors/route.ts":
    "admin visual-error log; visual_errors is service-role-only",
  "app/api/webinar-registration/route.ts":
    "webinar_registrations is service-role-only (registration inserts were silently lost)",
};

let changed = 0;
for (const [rel, why] of Object.entries(ALLOWLIST)) {
  const abs = path.join(ROOT, rel);
  let source = fs.readFileSync(abs, "utf8");
  const before = source;

  // Drop the session-client import; add the admin one.
  source = source.replace(
    /import\s*\{\s*createClient\s*\}\s*from\s*(["'])@\/lib\/supabase\/server\1;?\n?/,
    "",
  );
  source = source.replace(
    /import\s*\{\s*createAdminClient\s*\}\s*from\s*(["'])@\/lib\/supabase\/admin\1;?/,
    `import { createAdminClient } from $1@/lib/supabase/admin$1;`,
  );

  // `const supabase = await createClient();` -> `const supabase = createAdminClient();`
  source = source.replace(/=\s*await\s+createClient\(\)/g, "= createAdminClient()");

  if (source === before) {
    console.log(`NO CHANGE  ${rel}`);
    continue;
  }
  if (/await\s+createClient\(\)/.test(source)) {
    console.log(`INCOMPLETE ${rel} — an await createClient() remains`);
    continue;
  }
  changed++;
  console.log(`${rel}\n    ${why}`);
  if (!DRY) fs.writeFileSync(abs, source);
}

console.log(`\n${DRY ? "would change" : "changed"} ${changed} file(s)`);
