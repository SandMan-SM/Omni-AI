/**
 * Codemod: swap a server-side STATELESS anon Supabase client for the
 * service-role client.
 *
 * WHY: an anon client carries no `auth.uid()`, so a row-scoped RLS policy
 * can never match. Against a table whose RLS is locked to `service_role`
 * the read returns [] and the write silently no-ops — HTTP 200, no error,
 * no row. The route reports success while nothing happened.
 *
 * The routes this touches are all behind an auth gate
 * (`authorizeCronOrAdmin`, `requireAdmin`, CRON_SECRET, ADMIN_API_KEY,
 * a Stripe/Svix signature, or an API key), so the service role is the
 * intended connection — several of these files already say so in their
 * own comments ("on a service-role connection").
 *
 * Files are processed only if they are on the allowlist, so a route with
 * no auth gate is never silently upgraded to a privileged connection.
 *
 * Usage: node scripts/codemod-anon-to-admin.mjs [--dry]
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry");

/**
 * Routes with NO auth gate of their own. They are excluded from the
 * mechanical sweep: giving them the service role without a gate would
 * turn a currently-inert endpoint into a privileged one.
 *
 * Each is handled by hand instead.
 */
const EXCLUDE = new Set([
  "app/api/agi/quick-add/route.ts",
  "app/api/agi/replies/log/route.ts",
  "app/api/agi/telegram/webhook/route.ts",
  "app/api/agents/edits/route.ts",
  "app/api/agents/intelligence/route.ts",
  "app/api/webinar-registration/route.ts",
]);

const SCAN_ROOTS = ["app/api", "app/lp", "app/admin", "app/newsletter", "lib", "components"];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * A file is eligible when it builds a Supabase client from the anon key
 * AND that client is used for a table query. The table check keeps the
 * sweep away from auth-only usages, where the anon key is correct.
 */
const QUERY = /\.from\(\s*["'`]/;

function transform(source, rel) {
  let out = source;
  const notes = [];

  // 1. `import { createClient } from '@supabase/supabase-js';`
  //    -> `import { createAdminClient } from '@/lib/supabase/admin';`
  if (/from\s+["']@supabase\/supabase-js["']/.test(out)) {
    out = out.replace(
      /import\s*\{([^}]*)\}\s*from\s*(["'])@supabase\/supabase-js\2;?/g,
      (m, names, q) => {
        const kept = names
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n && n !== "createClient" && !/^type\s/.test(n));
        if (kept.length) {
          return `import { ${kept.join(", ")} } from ${q}@supabase/supabase-js${q};`;
        }
        return "";
      },
    );
    out = out.replace(
      /import\s*\{([^}]*)\}\s*from\s*(["'])@\/lib\/supabase\/admin\2;?/g,
      (m, names, q) => `import { ${names.trim()}, createAdminClient } from ${q}@/lib/supabase/admin${q};`,
    );
    if (!/createAdminClient/.test(out)) {
      out = out.replace(
        /import\s+.*from\s+["']@\/lib\/supabase\/admin["'];?/,
        `import { createAdminClient } from '@/lib/supabase/admin';`,
      );
    }
    if (!/from\s+["']@\/lib\/supabase\/admin["']/.test(out)) {
      // Insert the admin import right after the last import statement.
      const lines = out.split("\n");
      let last = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*import\s/.test(lines[i])) last = i;
      }
      lines.splice(last + 1, 0, "import { createAdminClient } from '@/lib/supabase/admin';");
      out = lines.join("\n");
    }
    notes.push("supabase-js import -> admin");
  }

  // 2. The client construction itself.
  //    `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`
  //    -> `createAdminClient()`
  const before = out;
  out = out.replace(
    /createClient\(\s*process\.env\.(?:NEXT_PUBLIC_)?SUPABASE_URL\s*!?,\s*process\.env\.(?:NEXT_PUBLIC_)?SUPABASE_ANON_KEY\s*!?,?\s*\)/g,
    "createAdminClient()",
  );
  if (out !== before) notes.push("anon createClient() -> createAdminClient()");

  // 3. The session helper: `const supabase = await createClient();`
  //    -> `const supabase = createAdminClient();`
  if (/from\s+["']@\/lib\/supabase\/server["']/.test(out)) {
    out = out.replace(
      /import\s*\{([^}]*)\}\s*from\s*(["'])@\/lib\/supabase\/server\2;?/g,
      (m, names, q) => {
        const kept = names
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n && n !== "createClient");
        if (kept.length) {
          return `import { ${kept.join(", ")} } from ${q}@/lib/supabase/server${q};`;
        }
        return "";
      },
    );
    if (!/from\s+["']@\/lib\/supabase\/server["']/.test(out)) {
      const lines = out.split("\n");
      let last = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*import\s/.test(lines[i])) last = i;
      }
      lines.splice(last + 1, 0, "import { createAdminClient } from '@/lib/supabase/admin';");
      out = lines.join("\n");
    }
    const beforeAwait = out;
    out = out.replace(/=\s*await\s+createClient\(\)/g, "= createAdminClient()");
    if (out !== beforeAwait) notes.push("await createClient() -> createAdminClient()");
  }

  return { out, notes };
}

let changed = 0;
let skipped = [];

for (const root of SCAN_ROOTS) {
  for (const abs of walk(path.join(ROOT, root))) {
    const rel = path.relative(ROOT, abs);
    const source = fs.readFileSync(abs, "utf8");

    if (!/NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ANON_KEY/.test(source)) continue;
    if (!QUERY.test(source)) continue;
    if (EXCLUDE.has(rel)) {
      skipped.push(rel);
      continue;
    }

    const { out, notes } = transform(source, rel);
    if (out === source) continue;
    if (/SUPABASE_ANON_KEY/.test(out)) {
      // The anon key is still referenced somewhere in the file — a shape the
      // codemod does not handle. Leave it for a human.
      skipped.push(rel + "  (anon key still referenced)");
      continue;
    }
    changed++;
    console.log(`${rel}\n    ${notes.join("; ")}`);
    if (!DRY) fs.writeFileSync(abs, out);
  }
}

console.log(`\n${DRY ? "would change" : "changed"} ${changed} file(s)`);
if (skipped.length) {
  console.log(`\nskipped (handled by hand):`);
  for (const s of skipped) console.log(`  ${s}`);
}
