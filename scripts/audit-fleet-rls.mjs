#!/usr/bin/env node
/**
 * Measure the anon-key / RLS defect across every deployable copy in the fleet.
 *
 * Why this exists
 *
 * The largest defect in this project's history was invisible to every tool in
 * it: the AGI layer read `service_role_all` tables with the anon key, so it
 * returned empty arrays and reported zeros — *as results*. `tsc` was clean,
 * `next build` was clean, and the backend scored 100 for three sessions.
 *
 * The gate that can see it is `scripts/audit-anon-rls.ts`. But that gate
 * carries its own rule set — `scripts/anon-locked-tables.json`, the list of
 * tables the anon key cannot read — and until this session it printed a
 * WARNING and exited **0** when the rule set was missing. Thirty of the
 * thirty-two deployable copies of this repo predate that file, so every one
 * of them reported "0 findings" while checking nothing at all.
 *
 * A gate whose rules did not run has established nothing, so the canonical
 * gate now exits 2 in that case. This script is the other half: it runs the
 * rule set against every deployable copy and reports what each one actually
 * carries.
 *
 * The defect class travels by copy. A copy of this repo that is a hundred
 * commits behind the canonical surface still contains the anon-key reads the
 * canonical surface fixed — and a `vercel --prod` from that folder ships
 * them. The dashboard answers 200 with an empty array, so nobody can tell
 * "no rows" from "not allowed to see rows".
 *
 * What it reports
 *
 * For every deployable copy of a project whose canonical surface has a
 * locked-table list: the number of RLS findings in the copy, and how far the
 * copy is behind the canonical surface. A copy whose canonical surface is
 * clean and which is not is a **divergence** — it carries a defect the
 * canonical surface has already fixed.
 *
 * This is deliberately a separate command from `npm run audit:fleet-auth`.
 * The cron-auth gate runs in seconds and is expected to be green before a
 * release. This one runs the TypeScript analyzer once per copy — about a
 * minute and a half across this fleet — and the population it finds is a
 * decision for the operator, not something an agent can settle: most of
 * these trees carry commits and uncommitted work that canonical does not
 * have, so re-syncing them is not the agent's call.
 *
 * Usage:
 *   node scripts/audit-fleet-rls.mjs                    # sweep ~/Desktop/Clients
 *   node scripts/audit-fleet-rls.mjs --dir <path>       # sweep another root
 *   node scripts/audit-fleet-rls.mjs --report           # always exit 0
 *
 * Exit codes: 0 no divergences, 1 divergences found, 2 the fleet root is
 * unusable.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deployableCheckouts, looksLikeSite } from "./audit-fleet-auth.mjs";

function parseArgs(argv) {
  const options = { reportOnly: false, dir: join(homedir(), "Desktop", "Clients") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--report") options.reportOnly = true;
    else if (argv[i] === "--dir") options.dir = resolve(argv[++i] || "");
  }
  return options;
}

/** The Vercel project a checkout is linked to, or null. */
function vercelProjectId(dir) {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, ".vercel", "project.json"), "utf8"));
    return typeof parsed.projectId === "string" ? parsed.projectId : null;
  } catch {
    return null;
  }
}

/**
 * The canonical surface: this checkout.
 *
 * The copies are compared against the tree this script runs in, which is the
 * canonical surface of the project by definition. Identifying it by "the
 * first checkout that has a locked-table list" was wrong the moment the list
 * was synced into the copies — the first match was then a copy, and the
 * comparison was against itself.
 */
function canonicalSurface() {
  const dir = process.cwd();
  const projectId = vercelProjectId(dir);
  if (!projectId) return null;
  if (!existsSync(join(dir, "scripts", "anon-locked-tables.json"))) return null;
  return { dir, projectId };
}

/**
 * The commit that removed the anon-key reads from the canonical surface.
 *
 * Found from the canonical surface's own history rather than hard-coded, so
 * it stays correct when the fix is re-landed. A copy whose history does not
 * contain this commit predates the fix entirely.
 */
function findFixCommit(canonicalDir) {
  try {
    const out = execFileSync(
      "git",
      ["-C", canonicalDir, "log", "-1", "--format=%H", "-S", "SUPABASE_ANON_KEY", "--", "lib/auth.ts"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
    return /^[0-9a-f]{40}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

/**
 * A copy's rule set, as the schema snapshot it carries.
 *
 * The rule set is a MEASUREMENT of the live schema, so it can go stale: a
 * table added to the database after the snapshot was taken is invisible to
 * every gate that reads it, in this copy and everywhere else that carries
 * it. The canonical surface's own drift gate catches that for the canonical
 * tree; this is the same check for the copies, which is the population the
 * defect actually travels through.
 */
function ruleSetSnapshot(dir) {
  try {
    const parsed = JSON.parse(
      readFileSync(join(dir, "scripts", "anon-locked-tables.json"), "utf8"),
    );
    const tables = parsed.schemaTables;
    if (!Array.isArray(tables) || !tables.length) return { tables: null, generatedAt: null };
    return { tables: new Set(tables), generatedAt: parsed.generatedAt || null };
  } catch {
    return { tables: null, generatedAt: null };
  }
}

/**
 * Whether a copy's history contains the fix commit.
 *
 * "behind by N commits" is meaningless across clones whose histories have
 * diverged — one copy reported itself two commits behind while its history
 * did not contain the fix at all. The ancestor test asks the question that
 * matters: does this tree descend from the fix?
 */
function containsCommit(copyDir, sha) {
  if (!sha) return null;
  try {
    execFileSync("git", ["-C", copyDir, "merge-base", "--is-ancestor", sha, "HEAD"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    return true;
  } catch (error) {
    // A non-zero exit means "not an ancestor". A missing object means the
    // clone does not have that commit at all, which is also "not contained".
    return false;
  }
}

/**
 * Run the RLS rule set against a tree.
 *
 * The analyzer resolves its root from the working directory, so running it
 * with `cwd` set to the copy scans the copy and reads the copy's own
 * locked-table list.
 */
function runRlsAudit(root) {
  const script = join(process.cwd(), "scripts", "audit-anon-rls.ts");
  try {
    const out = execFileSync("npx", ["tsx", script, "--quiet"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
    const match = out.match(/—\s*(\d+)\s+finding\(s\)\s+across\s+(\d+)\s+rules/);
    return { findings: match ? Number(match[1]) : null, rules: match ? Number(match[2]) : null };
  } catch (error) {
    // A non-zero exit is how the gate reports findings, so the summary line
    // has to be read from the error's stdout as well.
    const stdout = error?.stdout ?? "";
    const match = String(stdout).match(/—\s*(\d+)\s+finding\(s\)\s+across\s+(\d+)\s+rules/);
    if (match) return { findings: Number(match[1]), rules: Number(match[2]) };
    const stderr = String(error?.stderr ?? "");
    if (/did NOT run/.test(stderr)) {
      // Carry the gate's own reason through. "Could not be checked" is not
      // one condition — a tree with no rule set, a tree with a rule set in
      // the old format, and a tree with an empty rule set are three
      // different problems, and collapsing them into one sentence
      // ("the copy has no scripts/anon-locked-tables.json") tells the
      // reader something false about the fleet.
      const reason = (stderr.match(/\[anon-rls\]\s*(.+?),\s*so the locked-table rules did NOT run/s) ||
        [])[1];
      return { findings: null, rules: null, rulesDidNotRun: true, reason: reason || null };
    }
    return { findings: null, rules: null, failed: true };
  }
}

/**
 * Is this error a filesystem error (the path is not readable) rather than a
 * bug in this script?
 *
 * The distinction matters, because the walk used to catch EVERYTHING. A
 * `ReferenceError` from an unimported `readdirSync` was indistinguishable
 * from an unreadable directory, so every walk threw, the catch ate it, and
 * the phase reported an empty population — which reads exactly like a clean
 * sweep. It is the same failure shape this repo keeps paying for: a phase
 * that did not run, reported as a phase that found nothing.
 */
function isFilesystemError(error) {
  const code = error && error.code;
  return [
    "ENOENT",
    "ENOTDIR",
    "EACCES",
    "EPERM",
    "ELOOP",
    "EMFILE",
    "ENFILE",
  ].includes(code);
}

/**
 * Every tree in the fleet that carries the RLS rule set.
 *
 * The rule set file is the marker of an omni-ai-family tree: it was synced
 * into the copies so their own gates tell the truth, and a tree without it
 * cannot run the locked-table rules at all.
 *
 * The linked phase walks `.vercel` links, which means it only ever sees a
 * tree that can be deployed *right now*. The defect travels by copy, and a
 * tree with no link is one `vercel --prod` away from having one — so the
 * family is wider than the linked population.
 */
function ruleSetTrees(dir) {
  const found = [];
  const walk = (current, depth) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(current);
    } catch (error) {
      if (!isFilesystemError(error)) throw error;
      return;
    }
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".git") continue;
      const path = join(current, entry);
      let stats;
      try {
        stats = statSync(path);
      } catch (error) {
        if (!isFilesystemError(error)) throw error;
        continue;
      }
      if (!stats.isDirectory()) continue;
      if (existsSync(join(path, "scripts", "anon-locked-tables.json"))) {
        found.push(path);
        continue; // do not descend — a nested tree is a copy of a copy
      }
      walk(path, depth + 1);
    }
  };
  walk(dir, 0);
  return found.sort();
}

function main() {
  const { reportOnly, dir } = parseArgs(process.argv.slice(2));
  if (!existsSync(dir)) {
    console.error(`[fleet-rls] fleet root not found: ${dir}`);
    return 2;
  }

  const canonical = canonicalSurface();
  if (!canonical) {
    console.error(
      "[fleet-rls] this checkout is not the canonical surface with a locked-table list " +
        "(.vercel/project.json and scripts/anon-locked-tables.json are both required).",
    );
    return 2;
  }
  console.log(`[fleet-rls] canonical surface ${canonical.dir} — sweeping ${dir}\n`);

  const divergences = [];
  const skipped = [];
  const staleRuleSets = [];
  const fixSha = findFixCommit(canonical.dir);
  const canonicalSnapshot = ruleSetSnapshot(canonical.dir);
  const covered = new Set();

  /**
   * Record a copy whose rule set no longer describes the same schema the
   * canonical surface does.
   */
  const checkRuleSetFreshness = (tree) => {
    if (!canonicalSnapshot.tables) return;
    const snapshot = ruleSetSnapshot(tree);
    if (!snapshot.tables) {
      staleRuleSets.push({
        dir: tree,
        detail: "its rule set carries no schema table list, so it cannot be compared",
      });
      return;
    }
    const unknown = [...snapshot.tables].filter((t) => !canonicalSnapshot.tables.has(t));
    const missing = [...canonicalSnapshot.tables].filter((t) => !snapshot.tables.has(t));
    if (unknown.length || missing.length) {
      staleRuleSets.push({
        dir: tree,
        detail:
          `its rule set describes ${snapshot.tables.size} table(s) against the canonical ` +
          `${canonicalSnapshot.tables.size} — ${unknown.length} it has that the canonical does not, ` +
          `${missing.length} it is missing`,
      });
    }
  };

  for (const checkout of deployableCheckouts(dir)) {
    if (!looksLikeSite(checkout.dir)) continue;
    if (checkout.projectId !== canonical.projectId) continue;
    if (checkout.dir === canonical.dir) continue;
    covered.add(checkout.dir);
    checkRuleSetFreshness(checkout.dir);

    const result = runRlsAudit(checkout.dir);
    if (result.rulesDidNotRun) {
      skipped.push({
        dir: checkout.dir,
        reason:
          (result.reason || "its rule set could not be used") +
          ", so its rule set cannot run — sync it with: node scripts/patch-fleet-rls-ruleset.mjs",
      });
      continue;
    }
    if (result.findings === null) {
      skipped.push({ dir: checkout.dir, reason: "the analyzer did not produce a result" });
      continue;
    }
    if (!result.findings) continue;
    divergences.push({
      dir: checkout.dir,
      findings: result.findings,
      hasFix: containsCommit(checkout.dir, fixSha),
      fixSha,
    });
  }

  // The rest of the family.
  //
  // The phase above only walked trees carrying a Vercel link. A tree with
  // the rule set and NO link is not a deployable surface today, and it is
  // one `vercel --prod` away from being one — the same blind spot the
  // cron-auth sweep had. These trees are reported the same way, because a
  // defect that answers 200 with an empty array is just as wrong in a tree
  // that is not linked yet.
  const family = [];
  const familyTrees = ruleSetTrees(dir);
  let familyExamined = 0;
  for (const tree of familyTrees) {
    if (tree === canonical.dir) continue;
    if (covered.has(tree)) continue;
    familyExamined++;
    checkRuleSetFreshness(tree);
    const result = runRlsAudit(tree);
    if (result.rulesDidNotRun) {
      skipped.push({
        dir: tree,
        reason:
          (result.reason || "its rule set could not be used") +
          ", so its rule set cannot run — sync it with: node scripts/patch-fleet-rls-ruleset.mjs",
      });
      continue;
    }
    if (!result.findings) continue;
    family.push({ dir: tree, findings: result.findings, hasFix: containsCommit(tree, fixSha) });
  }

  for (const divergence of divergences) {
    const history =
      divergence.hasFix === null
        ? ""
        : divergence.hasFix
          ? `, but its history contains the fix (${divergence.fixSha.slice(0, 8)}) — the working tree has diverged`
          : `, and its history does not contain the fix (${divergence.fixSha.slice(0, 8)})`;
    console.log(
      `  DIVERGE  ${relative(dir, divergence.dir)} — ${divergence.findings} anon-key RLS finding(s)${history}`,
    );
  }
  for (const entry of family) {
    console.log(
      `  FAMILY   ${relative(dir, entry.dir)} — ${entry.findings} anon-key RLS finding(s), ` +
        "and this tree carries no Vercel link, so it cannot be deployed today — " +
        "but it is one `vercel --prod` away from being able to",
    );
  }
  for (const skip of skipped) {
    console.log(`  note     ${relative(dir, skip.dir)} — ${skip.reason}`);
  }
  for (const stale of staleRuleSets) {
    console.log(
      `  STALE    ${relative(dir, stale.dir)} — ${stale.detail}. ` +
        "A table this rule set has never heard of is invisible to the gate, in this copy and " +
        "everywhere else that carries it — sync it with: node scripts/patch-fleet-rls-ruleset.mjs",
    );
  }

  // Say how many trees each phase EXAMINED, not only how many it found. A
  // phase that found nothing and a phase that never ran produce the same
  // output otherwise, and that ambiguity is what let the unlinked-tree
  // phase sit broken without anyone noticing.
  console.log(
    `\n[fleet-rls] examined ${covered.size} deployable copy/copies ` +
      `and ${familyExamined} unlinked tree(s) carrying the rule set; ` +
      `${staleRuleSets.length} carried a rule set that no longer matches the canonical schema.`,
  );

  if (!divergences.length && !family.length && !skipped.length && !staleRuleSets.length) {
    console.log("[fleet-rls] no divergences — no tree in the fleet carries the anon-key RLS defect.");
    return 0;
  }
  console.error(
    `\n[fleet-rls] ${divergences.length} deployable copy/copies carry ${divergences.length ? "the anon-key RLS defect the canonical surface has fixed" : ""}` +
      `${family.length ? `, ${family.length} tree(s) with no Vercel link carry it too` : ""}` +
      `${skipped.length ? `, ${skipped.length} copy/copies could not be checked` : ""}` +
      `${staleRuleSets.length ? `, ${staleRuleSets.length} carry a rule set that no longer describes the live schema` : ""}. ` +
      "A copy that reads a locked table with the anon key answers 200 with an empty array, so the " +
      "dashboard shows no rows and nobody can tell why. These trees must not be deployed as-is; " +
      "most carry commits and uncommitted work that the canonical surface does not have, so " +
      "re-syncing them is an operator decision, not an agent's.",
  );
  return reportOnly ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
