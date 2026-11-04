#!/usr/bin/env node
/**
 * Fleet sweep: does the FAILED-LOOKUP class exist in the other surfaces?
 *
 * Why this exists
 *
 * On 2026-11-04 the flagship site served HTTP 404 for five published
 * newsletter issues because a database read that FAILED was read as "no
 * row with that slug". The defect was fixed in `lib/server/content-lookup.ts`
 * and gated by `npm run audit:content-lookup` — in the canonical tree.
 *
 * The defect class is a SHAPE, and a fleet is a set of independent
 * Next.js checkouts that share patterns but not code. The same shape —
 * a single-row Supabase read whose result decides a `notFound()` — is
 * written from scratch in every surface, so it reappears wherever a page
 * is written at all. The precedent is the RLS sweep: a gate that cannot
 * see a copy is a gate that has not been applied.
 *
 * The rules are NOT re-implemented here. This sweep imports the detector
 * from `scripts/audit-content-lookup.mjs` and applies it to every page in
 * every fleet checkout, so the fleet answer and the canonical answer can
 * never disagree about what the rule IS.
 *
 * A copy that has already been fixed is quiet: the copy either routes
 * its read through `lookupContent` (the canonical shape) or carries the
 * same `audit:content-lookup-ignore` opt-out.
 *
 * Usage:
 *   node scripts/audit-fleet-content-lookup.mjs             # sweep ~/Desktop/Clients
 *   node scripts/audit-fleet-content-lookup.mjs --dir <path>
 *   node scripts/audit-fleet-content-lookup.mjs --report     # always exit 0
 *
 * Exit codes: 0 no findings, 1 findings, 2 the fleet root is unusable.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { scanFile } from "./audit-content-lookup.mjs";
import { candidateRoots, pageFiles } from "./fleet-trees.mjs";

function parseArgs(argv) {
  const options = {
    reportOnly: false,
    dir: join(homedir(), "Desktop", "Clients"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--report") options.reportOnly = true;
    else if (a === "--dir") options.dir = resolve(argv[++i]);
  }
  return options;
}

function main() {
  const { reportOnly, dir } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-content-lookup] the fleet root ${dir} does not exist.`);
    return 2;
  }

  const roots = candidateRoots(dir);
  console.log(
    `[fleet-content-lookup] ${roots.length} canonical site checkout(s) under ${dir}\n`,
  );

  let pages = 0;
  const findings = [];
  for (const root of roots) {
    const files = pageFiles(root);
    pages += files.length;
    const siteFindings = [];
    for (const file of files) {
      try {
        siteFindings.push(...scanFile(file, root));
      } catch {
        // An unreadable file is not a clean file. Say so rather than
        // letting "found nothing" and "looked at nothing" print alike.
        console.error(`[fleet-content-lookup] could not read ${file}`);
        siteFindings.push({
          rule: "page-unreadable",
          file: relative(root, file),
          line: 0,
          detail: "the file could not be read, so it was not checked",
        });
      }
    }
    if (siteFindings.length) {
      console.error(`\n${root}`);
      for (const f of siteFindings) {
        console.error(
          `  ${f.rule}  ${f.file}${f.line ? `:${f.line}` : ""} — ${f.detail}`,
        );
      }
    }
    findings.push(...siteFindings);
  }

  if (!findings.length) {
    console.log(
      `[fleet-content-lookup] ${pages} page(s) checked across ${roots.length} checkout(s), ` +
        `no findings — no page answers HTTP 404 because a database read failed.`,
    );
    return 0;
  }

  console.error(
    `\n[fleet-content-lookup] ${findings.length} finding(s) in ${pages} page(s) across ` +
      `${roots.length} checkout(s).`,
  );
  console.error(
    "[fleet-content-lookup] a failed read is not a missing row. Copy " +
      "lib/server/content-lookup.ts into the surface and route the read through " +
      "requireLookup(await lookupContent(() => …)).",
  );
  return reportOnly ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
