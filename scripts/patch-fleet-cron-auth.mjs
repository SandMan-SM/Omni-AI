#!/usr/bin/env node
/**
 * Close the cron-auth defect in every deployable copy across the fleet.
 *
 * Why this exists
 *
 * `npm run audit:fleet-auth` reports a *divergence*: a checkout that carries a
 * `.vercel` project link and still holds a defect the canonical surface has
 * already fixed. Session 55 found 33 of them — 30 copies of this repo and 3
 * copies of the Imperium site, all still carrying the session-54 bypasses
 * (a `User-Agent: vercel-cron/1.0` path into `lib/cron.ts`, and the
 * `x-vercel-cron: 1` fallback into the federation-newsletter generator).
 *
 * A copy with a `.vercel` link is a tree that `vercel --prod` will ship to
 * production with one command. The bypass is therefore one command away from
 * being live again, and nobody has to edit anything to do it.
 *
 * What it does
 *
 * It rewrites the two known pre-fix files in each divergent copy, applying
 * the *minimal* security change rather than copying the canonical file
 * wholesale — a stale copy may carry other work (an AIS receiver, a payments
 * launch) that a wholesale overwrite would destroy. Every replacement is an
 * exact-match substitution, and a file is only rewritten when **all** of its
 * replacements match. A file that matches only some of them is reported and
 * left alone, because a partial rewrite is how a subtle bug gets shipped.
 *
 * The result is verified by the gate itself: re-run `npm run audit:fleet-auth`
 * and the divergences must be gone.
 *
 * Usage:
 *   node scripts/patch-fleet-cron-auth.mjs                  # patch every copy
 *   node scripts/patch-fleet-cron-auth.mjs --dir <path>     # patch another root
 *   node scripts/patch-fleet-cron-auth.mjs --dry-run        # report only
 *
 * Exit codes: 0 nothing left to patch, 1 something was skipped, 2 bad root.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { deployableCheckouts, looksLikeSite } from "./audit-fleet-auth.mjs";

/**
 * The known pre-fix shapes, and the minimal fix for each.
 *
 * `from` strings must appear verbatim, and every `from` in a patch must be
 * present for the patch to apply. `to` may be the empty string (removal).
 */
const PATCHES = [
  {
    id: "omni-ai-cron-gate",
    file: "lib/cron.ts",
    replacements: [
      {
        from: [
          ' * var (or the user-agent "vercel-cron/1.0" on legacy projects). Manual',
          " * triggers from a developer machine pass the same Bearer.",
        ].join("\n"),
        to: [
          " * var. Manual triggers from a developer machine pass the same Bearer.",
          " * That bearer is the ONLY accepted credential.",
        ].join("\n"),
      },
      {
        from: '  | { ok: true; reason: "secret" | "vercel-cron" }',
        to: '  | { ok: true; reason: "secret" }',
      },
      {
        from: [
          '  const auth = request.headers.get("authorization") || "";',
          '  const ua = request.headers.get("user-agent") || "";',
          '  const secret = process.env.CRON_SECRET || "";',
        ].join("\n"),
        to: [
          '  const auth = request.headers.get("authorization") || "";',
          '  const secret = process.env.CRON_SECRET || "";',
          "",
          "  if (!secret) {",
          "    // No shared secret means there is nothing to authenticate against.",
          "    // Failing closed here is what keeps an unset env var from turning",
          "    // into an open door.",
          "    return {",
          "      ok: false,",
          "      response: NextResponse.json(",
          '        { error: "Cron authentication is not configured" },',
          "        { status: 503 },",
          "      ),",
          "    };",
          "  }",
        ].join("\n"),
      },
      {
        from: "  if (secret && constantTimeEqual(presented, secret)) {",
        to: "  if (constantTimeEqual(presented, secret)) {",
      },
      {
        from: [
          '  if (ua.startsWith("vercel-cron/")) {',
          "    // Older Vercel cron behaviour. Pro plan now also injects the bearer",
          "    // automatically, but we accept either path so manual reschedules in",
          "    // the Vercel UI still work.",
          '    return { ok: true, reason: "vercel-cron" };',
          "  }",
        ].join("\n"),
        to: "",
      },
    ],
  },
  {
    id: "omni-ai-federation-newsletter",
    file: "app/api/federation-newsletter/generate-daily/route.ts",
    replacements: [
      {
        from: "const CRON_SECRET = process.env.OMNI_FEDERATION_CRON_SECRET || '';",
        to:
          "const CRON_SECRET = process.env.OMNI_FEDERATION_CRON_SECRET || process.env.CRON_SECRET || '';",
      },
      {
        from: [
          "  // Allow Vercel's internal cron header as an alternative auth path.",
          "  // Vercel sets `x-vercel-cron: 1` on cron-triggered invocations and the",
          "  // Authorization header carries the project's CRON_SECRET when configured.",
          "  const isVercelCron = req.headers.get('x-vercel-cron') === '1';",
          "  const secretOk = CRON_SECRET",
          "    ? providedSecret === CRON_SECRET",
          "    : isVercelCron;",
        ].join("\n"),
        to: [
          "  // The shared secret is the ONLY accepted credential. A request header is",
          "  // chosen by the caller, so `x-vercel-cron: 1` proves nothing.",
          "  if (!CRON_SECRET) {",
          "    return NextResponse.json(",
          "      { ok: false, error: 'federation cron secret not configured' },",
          "      { status: 503 },",
          "    );",
          "  }",
          "  const secretOk = providedSecret === CRON_SECRET;",
        ].join("\n"),
      },
    ],
  },
  {
    id: "imperium-newsletter-cron",
    file: "src/app/api/newsletter/cron/route.ts",
    replacements: [
      {
        from: [
          "    const expectedSecret = process.env.CRON_SECRET;",
          "    ",
          "    if (expectedSecret && cronSecret !== expectedSecret) {",
        ].join("\n"),
        to: [
          "    const expectedSecret = process.env.CRON_SECRET;",
          "",
          "    if (!expectedSecret) {",
          "        return NextResponse.json(",
          "            { error: 'Cron authentication is not configured' },",
          "            { status: 503 },",
          "        );",
          "    }",
          "",
          "    if (cronSecret !== expectedSecret) {",
        ].join("\n"),
      },
    ],
  },
  {
    id: "imperium-market-cron",
    file: "src/app/api/market/cron/route.ts",
    replacements: [
      {
        from: [
          "  const expectedSecret = process.env.CRON_SECRET;",
          "",
          "  if (expectedSecret && cronSecret !== expectedSecret && bearerSecret !== expectedSecret) {",
        ].join("\n"),
        to: [
          "  const expectedSecret = process.env.CRON_SECRET;",
          "",
          "  if (!expectedSecret) {",
          "    return NextResponse.json(",
          '      { error: "Cron authentication is not configured" },',
          "      { status: 503 },",
          "    );",
          "  }",
          "",
          "  if (cronSecret !== expectedSecret && bearerSecret !== expectedSecret) {",
        ].join("\n"),
      },
    ],
  },
];

function parseArgs(argv) {
  const options = {
    dir: join(homedir(), "Desktop", "Clients"),
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") options.dir = resolve(argv[++i] || "");
    else if (argv[i] === "--dry-run") options.dryRun = true;
  }
  return options;
}

/** Apply one patch to a file. Returns "patched", "already" or "skipped". */
function applyPatch(dir, patch, dryRun) {
  const path = join(dir, patch.file);
  if (!existsSync(path)) return "absent";

  const original = readFileSync(path, "utf8");
  const matched = patch.replacements.filter((replacement) => original.includes(replacement.from));
  if (!matched.length) return "already";
  if (matched.length !== patch.replacements.length) {
    return `skipped: ${matched.length}/${patch.replacements.length} patterns matched`;
  }

  let next = original;
  for (const replacement of patch.replacements) {
    next = next.replace(replacement.from, replacement.to);
  }
  if (next === original) return "already";
  if (!dryRun) writeFileSync(path, next, "utf8");
  return "patched";
}

function main() {
  const { dir, dryRun } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[patch-fleet-cron-auth] fleet root not found: ${dir}`);
    return 2;
  }

  const checkouts = deployableCheckouts(dir).filter((checkout) => looksLikeSite(checkout.dir));
  console.log(
    `[patch-fleet-cron-auth] ${checkouts.length} linked checkout(s) under ${dir}` +
      `${dryRun ? " (dry run)" : ""}\n`,
  );

  let patched = 0;
  let skipped = 0;
  for (const checkout of checkouts) {
    for (const patch of PATCHES) {
      const result = applyPatch(checkout.dir, patch, dryRun);
      if (result === "absent" || result === "already") continue;
      const label = relative(dir, checkout.dir) || ".";
      if (result === "patched") {
        patched++;
        console.log(`  patched  ${label} — ${patch.id} (${patch.file})`);
      } else {
        skipped++;
        console.log(`  SKIPPED  ${label} — ${patch.id} (${patch.file}) — ${result}`);
      }
    }
  }

  console.log(
    `\n[patch-fleet-cron-auth] ${patched} file(s) patched, ${skipped} skipped. ` +
      "Re-run `npm run audit:fleet-auth` to confirm the divergences are gone.",
  );
  return skipped ? 1 : 0;
}

process.exit(main());
