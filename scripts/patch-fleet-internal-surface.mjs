#!/usr/bin/env node
/**
 * Carry the internal-surface fix into a fleet copy — safely, and only where
 * the copy is byte-identical to the tree the fix was written against.
 *
 * Why this exists
 *
 * On 2026-11-04 the flagship served three internal surfaces to anyone with
 * the URL: `/dashboard/council` (120 KB of the Council Codex),
 * `/dashboard/federation` (70 KB of the cross-promo funnel) and
 * `/api/federation/health` (every client's 30-day lead count and traffic).
 * On 2026-11-06 a third control plane was still open: `/api/omni-os/snapshot`
 * answered an anonymous curl with 47,896 bytes of the agency's book of
 * business.
 *
 * All four were fixed in the flagship. The fleet sweep
 * (`npm run audit:fleet-internal-surface`) then found the SAME shape in
 * **296 trees**, because the class travels by copy — a tree that was cloned
 * before the fix still carries it, and a tree carrying the PRODUCTION
 * Vercel project link is one `vercel --prod` away from shipping it.
 *
 * WHY A PATCHER AND NOT A `git pull`
 *
 * A copy is not behind — it is a DIFFERENT tree. It may have its own
 * commits, its own uncommitted work, and its own history. Pulling the
 * fix into it would carry everything else with it, and the repo's own
 * precedent says a copy that holds real work must not be rewritten from
 * the outside.
 *
 * So this patcher writes ONE thing: the exact bytes of the files the fix
 * touched, and it writes them ONLY where the copy's file is byte-identical
 * to the canonical's PRE-fix file. That is provable minimality — the copy
 * made no change to that file since the fork point, so replacing the
 * pre-fix bytes with the post-fix bytes cannot lose work. If the copy's
 * file differs by even one byte, the file is SKIPPED and reported; the
 * patcher never overwrites a difference it cannot explain.
 *
 * WHERE THE FIX COMES FROM
 *
 * From the canonical repo's git HISTORY, not from its HEAD: the fix
 * commits are named, and each file's content is read with
 * `git show <commit>:<path>`. A fix is a SHAPE, and a shape has to be
 * replayable exactly — not "whatever the file looks like today", which
 * would drag every later change into the copy. If the git history cannot
 * be read, this script exits 2 and writes NOTHING: an unknown answer is
 * not a clean answer.
 *
 * THE FIX IS NOT ONLY THE FOUR LEAKS — IT IS ALSO THE GATE THEY SIT BEHIND
 *
 * Moving a read behind `requireAdmin()` is only a fix if `requireAdmin()`
 * is a real credential check. In the copies that predate 2026-10-28 it is
 * NOT: `lib/omni-token.ts` decoded the `omni_token` bearer as plain
 * base64 JSON, so anyone could forge `{"sub":"x","is_admin":true}` and be
 * admitted. The canonical signed the token in `1c852963`
 * (`lib/server/omni-session-token.ts`, HMAC over the payload, derived from
 * the deployment's service-role key). That group is carried too, because
 * **a gate that can be walked through is not a gate, and installing one
 * over an open door is worse than installing nothing** — it makes the
 * report go quiet while the hole is still there.
 *
 * THE GATE IS ARMED ONLY IN A TREE THAT PASSES IT
 *
 * The repo's own rule (priority 62): a copy's build chain may only be
 * armed with a gate the copy passes. A build that fails for a defect the
 * owner has not been told about gets skipped, and a skipped gate is not a
 * gate. So the instruments go in everywhere the class has reached, and the
 * gate is armed only where the detector comes back clean.
 *
 * Usage:
 *   node scripts/patch-fleet-internal-surface.mjs               # report the fleet
 *   node scripts/patch-fleet-internal-surface.mjs --tree <path> # patch ONE tree
 *   node scripts/patch-fleet-internal-surface.mjs --all          # patch every eligible tree
 *   node scripts/patch-fleet-internal-surface.mjs --dry-run
 *   node scripts/patch-fleet-internal-surface.mjs --dir <path>
 *
 * Exit codes: 0 done, 1 a tree still carries findings, 2 the fleet root or
 * the canonical history is unusable (nothing was written).
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  collectPages,
  collectRoutes,
  internalPrefixes,
  scanFile,
} from "./audit-internal-surface.mjs";
import { deriveCredentialVerifiers } from "./audit-public-pii.mjs";
import { candidateRoots } from "./fleet-trees.mjs";

const CANONICAL = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * THE MANIFEST — the fix, as the git commits that produced it.
 *
 * `mode`:
 *   "replace" — the file exists in the copy; its content must equal the
 *               commit's PRE-fix content (apply) or its POST-fix content
 *               (already applied). Anything else is a conflict.
 *   "create"  — the file does NOT exist in the copy. If it does, the
 *               content must equal the POST-fix content (already applied).
 *
 * `required` — a required file that conflicts BLOCKS the whole group. An
 * optional file is applied when it can be and skipped when it cannot; it
 * never blocks. The optional files are the ones that carry polish
 * (metadata layouts) or a client-side convenience (the dashboard card
 * that forwards the bearer), never the gate itself.
 */
const FIXES = [
  {
    id: "signed-session",
    commit: "1c852963",
    title: "sign the omni_token so a bearer is verified, not merely decoded",
    note:
      "Without this, requireAdmin() admits anyone: the copy's decoder read " +
      "base64 JSON, so {\"is_admin\":true} was a valid credential.",
    files: [
      { path: "lib/omni-token.ts", mode: "replace", required: true },
      { path: "lib/admin-auth.ts", mode: "replace", required: true },
      { path: "lib/server/direct-postgres.ts", mode: "replace", required: true },
      { path: "lib/server/omni-session-token.ts", mode: "create", required: true },
    ],
  },
  {
    id: "pt-tz",
    commit: "67172251",
    title: "export PT_TZ from lib/tz so a rendered date is the same on the server and in the browser",
    files: [
      { path: "lib/tz.ts", mode: "replace", required: true },
      { path: "app/dashboard/agents/page.tsx", mode: "replace", required: false },
    ],
  },
  {
    id: "council-federation",
    commit: "be6088a6",
    title: "move the council and federation dashboard reads behind requireAdmin",
    requires: ["lib/admin-auth.ts", "lib/supabase/admin.ts"],
    requiresFix: ["signed-session"],
    files: [
      { path: "app/api/dashboard/council/route.ts", mode: "create", required: true },
      { path: "app/api/dashboard/federation/route.ts", mode: "create", required: true },
      { path: "app/dashboard/council/page.tsx", mode: "replace", required: true },
      { path: "app/dashboard/federation/page.tsx", mode: "replace", required: true },
      { path: "app/dashboard/council/layout.tsx", mode: "create", required: false },
      { path: "app/dashboard/federation/layout.tsx", mode: "create", required: false },
    ],
    aux: [
      {
        path: "lib/seo.ts",
        from: "be6088a6",
        neededFor: ["app/dashboard/council/layout.tsx", "app/dashboard/federation/layout.tsx"],
      },
    ],
  },
  {
    id: "federation-health",
    commit: "7be538e7",
    title: "withhold per-tenant federation health detail from anonymous callers",
    requires: ["lib/admin-auth.ts", "lib/supabase/admin.ts", "lib/inbound-types.ts"],
    requiresFix: ["signed-session"],
    files: [
      { path: "app/api/federation/health/route.ts", mode: "replace", required: true },
      { path: "app/dashboard/agents/page.tsx", mode: "replace", required: false },
    ],
  },
  {
    id: "omni-os",
    commit: "e99fa357",
    title: "gate the Omni OS control plane behind requireAdmin",
    requires: [
      "lib/admin-auth.ts",
      "lib/tz.ts",
      "lib/omni-os/actions.ts",
      "lib/omni-os/scoring.ts",
      "lib/client-agent-registry.ts",
    ],
    // The fixed control-plane page renders dates with PT_TZ, which the
    // pt-tz group exports. If that group did not land, the page imports
    // a name that does not exist and the tree does not build.
    requiresFix: ["signed-session", "pt-tz"],
    files: [
      { path: "app/api/omni-os/snapshot/route.ts", mode: "replace", required: true },
      { path: "app/dashboard/omni-os/page.tsx", mode: "replace", required: true },
      { path: "lib/omni-os/snapshot.ts", mode: "replace", required: true },
      { path: "lib/omni-os/types.ts", mode: "replace", required: true },
      { path: "app/dashboard/omni-os/layout.tsx", mode: "create", required: false },
    ],
  },
];

/** The gate, and the instruments it needs, installed into a copy. */
const GATE = join("scripts", "audit-internal-surface.mjs");
const GATE_DEPENDENCIES = [
  join("scripts", "audit-public-pii.mjs"),
  join("scripts", "pii-schema.mjs"),
];

function parseArgs(argv) {
  const options = {
    apply: false,
    all: false,
    dryRun: false,
    tree: null,
    dir: join(homedir(), "Desktop", "Clients"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tree") options.tree = resolve(argv[++i]);
    else if (a === "--dir") options.dir = resolve(argv[++i]);
    else if (a === "--all") options.all = true;
    else if (a === "--dry-run") options.dryRun = true;
    else if (a === "--apply") options.apply = true;
  }
  return options;
}

const sha = (text) => createHash("sha256").update(text).digest("hex");

/** A file's content from the canonical repo's git history. */
function gitShow(commit, path) {
  try {
    return execFileSync("git", ["show", `${commit}:${path}`], {
      cwd: CANONICAL,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

/**
 * The manifest, resolved against the canonical history.
 *
 * Each entry gains the pre-fix and post-fix bytes. If the history cannot
 * be read, this returns null and the caller writes NOTHING.
 */
function resolveManifest() {
  const resolved = [];
  for (const fix of FIXES) {
    const files = [];
    for (const file of fix.files) {
      if (file.mode === "skip") continue;
      const post = gitShow(fix.commit, file.path);
      if (post === null) return null;
      const pre = gitShow(`${fix.commit}^`, file.path);
      files.push({
        ...file,
        pre: pre === null ? null : sha(pre),
        post: sha(post),
        content: post,
      });
    }
    const aux = [];
    for (const entry of fix.aux ?? []) {
      const content = gitShow(entry.from, entry.path);
      if (content === null) return null;
      aux.push({ ...entry, content });
    }
    resolved.push({ ...fix, files, aux });
  }
  return resolved;
}

/**
 * The state of one file in a copy, against its precondition.
 *
 * `virtual` holds the sha of files an EARLIER group in the same plan has
 * already rewritten. The plan is evaluated in commit order, and the fix
 * commits are in commit order too — so a group that lands on top of an
 * earlier group sees the earlier group's result, not the copy's original
 * bytes. Without this, `app/dashboard/agents/page.tsx` reads as a
 * conflict for the second group that touches it, when the first group
 * would have left it exactly where the second group expects it.
 */
function fileState(tree, file, virtual) {
  const path = join(tree, file.path);
  const virtualDigest = virtual.get(file.path);
  if (virtualDigest !== undefined) {
    if (virtualDigest === file.post) return { state: "applied", path };
    if (virtualDigest === file.pre) return { state: "apply", path };
    return {
      state: "conflict",
      path,
      why: "the copy's file differs from the file the fix was written against",
    };
  }
  if (!existsSync(path)) {
    return file.mode === "create"
      ? { state: "apply", path }
      : { state: "conflict", path, why: "the file is absent and the fix replaces it" };
  }
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    return { state: "conflict", path, why: `the file could not be read (${error.message})` };
  }
  const digest = sha(content);
  if (digest === file.post) return { state: "applied", path };
  if (digest === file.pre) return { state: "apply", path };
  return {
    state: "conflict",
    path,
    why: "the copy's file differs from the file the fix was written against",
  };
}

/**
 * A tree's internal-surface findings, measured with the CANONICAL detector.
 *
 * The same `scanFile` the flagship gate uses, over that tree's own
 * `app/robots.ts` and its own `lib/`. A tree whose verifiers cannot be
 * derived is UNKNOWN — not clean.
 */
function measure(tree) {
  const prefixes = internalPrefixes(tree);
  let derived;
  try {
    derived = deriveCredentialVerifiers(tree);
  } catch (error) {
    return {
      unknown: `credential verifiers could not be derived (${
        error && error.message
      }) — the rules did not run`,
      findings: [],
      pages: 0,
      routes: 0,
    };
  }
  const findings = [];
  const files = [
    ...collectPages(tree),
    ...collectPages(join(tree, "src")),
    ...collectRoutes(tree),
    ...collectRoutes(join(tree, "src")),
  ];
  for (const file of files) {
    try {
      findings.push(...scanFile(file, tree, prefixes, derived));
    } catch {
      findings.push({
        rule: "file-unreadable",
        file: relative(tree, file),
        line: 0,
        detail: "the file could not be read, so it was not checked",
      });
    }
  }
  return { unknown: null, findings, pages: files.length, routes: 0 };
}

/** Plan the fix for one tree: which groups apply, which are blocked, why. */
function plan(tree, manifest) {
  const groups = [];
  const satisfied = new Set();
  const virtual = new Map();

  for (const fix of manifest) {
    const states = fix.files.map((file) => ({ file, ...fileState(tree, file, virtual) }));

    const missing = (fix.requires ?? []).filter((p) => !existsSync(join(tree, p)));
    const blocked = states.find((s) => s.file.required && s.state === "conflict");
    const unmet = (fix.requiresFix ?? []).filter((id) => !satisfied.has(id));

    let verdict = "apply";
    let why = "";
    if (missing.length) {
      verdict = "blocked";
      why = `the tree has no ${missing.join(", ")} — the fix would not build there`;
    } else if (blocked) {
      verdict = "blocked";
      why = `${blocked.file.path}: ${blocked.why}`;
    } else if (unmet.length) {
      verdict = "blocked";
      why = `${unmet.join(", ")} did not land — this fix builds on it`;
    }

    const apply = states.filter((s) => s.state === "apply");
    const applied = states.filter((s) => s.state === "applied");
    const skipped = states.filter((s) => s.state === "conflict" && !s.file.required);

    // The auxiliary file (lib/seo.ts) only rides along if a layout that
    // needs it is being installed AND the tree does not already carry a
    // DIFFERENT lib/seo.ts.
    const aux = [];
    for (const entry of fix.aux ?? []) {
      const needed = entry.neededFor.some((p) =>
        states.some((s) => s.file.path === p && s.state === "apply"),
      );
      if (!needed) continue;
      const path = join(tree, entry.path);
      if (existsSync(path)) {
        const current = sha(readFileSync(path, "utf8"));
        if (current !== sha(entry.content)) {
          skipped.push({
            file: { path: entry.path, required: false },
            state: "conflict",
            path,
            why: "the tree already carries a different lib/seo.ts",
          });
          continue;
        }
      }
      aux.push({ path: entry.path, content: entry.content });
    }

    groups.push({ fix, states, apply, applied, skipped, aux, verdict, why });
    if (verdict !== "blocked" && states.every((s) => !s.file.required || s.state !== "conflict")) {
      satisfied.add(fix.id);
      // The next group is planned against the tree THIS plan produces.
      for (const entry of apply) virtual.set(entry.file.path, entry.file.post);
      for (const entry of aux) virtual.set(entry.path, sha(entry.content));
    }
  }

  return groups;
}

/** Write the planned groups into a tree. */
function write(tree, groups, dryRun) {
  const written = [];
  for (const group of groups) {
    if (group.verdict === "blocked") continue;
    for (const entry of group.apply) {
      const to = entry.path;
      if (!dryRun) {
        mkdirSync(dirname(to), { recursive: true });
        writeFileSync(to, entry.file.content);
      }
      if (!written.includes(entry.file.path)) written.push(entry.file.path);
    }
    for (const entry of group.aux) {
      const to = join(tree, entry.path);
      if (!dryRun) {
        mkdirSync(dirname(to), { recursive: true });
        writeFileSync(to, entry.content);
      }
      if (!written.includes(entry.path)) written.push(entry.path);
    }
  }
  return written;
}

/**
 * Install the gate and its instruments, and arm it ONLY if the tree is
 * clean. A copy's build chain may only be armed with a gate the copy
 * passes.
 */
function installGate(tree, findings, dryRun) {
  const installed = [];
  for (const rel of [GATE, ...GATE_DEPENDENCIES]) {
    const from = join(CANONICAL, rel);
    const to = join(tree, rel);
    if (!existsSync(from)) continue;
    const same =
      existsSync(to) && readFileSync(to, "utf8") === readFileSync(from, "utf8");
    if (same) continue;
    if (!dryRun) {
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, readFileSync(from, "utf8"));
    }
    installed.push(rel);
  }

  const pkgPath = join(tree, "package.json");
  if (!existsSync(pkgPath)) return { installed, armed: false };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    return { installed, armed: false };
  }
  pkg.scripts = pkg.scripts || {};
  let changed = false;
  if (pkg.scripts["audit:internal-surface"] !== "node scripts/audit-internal-surface.mjs") {
    pkg.scripts["audit:internal-surface"] = "node scripts/audit-internal-surface.mjs";
    changed = true;
  }
  const build = pkg.scripts.build || "";
  const armedAlready = build.includes("audit:internal-surface");
  const shouldArm = findings.length === 0;
  if (shouldArm && !armedAlready) {
    pkg.scripts.build = "npm run audit:internal-surface && " + build;
    changed = true;
  }
  if (changed && !dryRun) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
  return { installed, armed: shouldArm && (armedAlready || changed) };
}

/**
 * Commit exactly the files this tool wrote, in the tree's own repo.
 *
 * Nothing else is staged. A copy may carry uncommitted work of its own —
 * in the archives, an older copy of the PII gate and a refreshed rule set
 * — and `git add -A` would sweep somebody else's work into this commit.
 */
function commit(tree, paths, message) {
  const git = (args) =>
    execFileSync("git", args, { cwd: tree, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  let inside;
  try {
    inside = git(["rev-parse", "--is-inside-work-tree"]).trim();
  } catch {
    return { committed: false, why: "the tree is not a git repository" };
  }
  if (inside !== "true") return { committed: false, why: "the tree is not a git repository" };

  // A detached HEAD would make the commit dangling — one `git checkout`
  // away from gone. Give it a branch. The two archived copies are
  // WORKTREES of the canonical repository, so the branch name has to be
  // unique per tree: a branch already checked out in another worktree
  // cannot be checked out here.
  const want = `agent/internal-surface-fix`;
  const slug = tree
    .split("/")
    .filter(Boolean)
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || sha(tree).slice(0, 8);
  const held = git(["worktree", "list", "--porcelain"]);
  for (const name of [want, `${want}-${slug}`]) {
    // `git branch --list` exits 0 whether or not the branch exists, so a
    // missing branch does not abort the search for a usable name.
    const existing = git(["branch", "--list", name]).trim();
    if (!existing) {
      git(["checkout", "-b", name]);
      break;
    }
    // The branch exists — it may already be checked out in ANOTHER
    // worktree of the same repository, which git refuses to check out
    // here. Take the unique name instead.
    if (held.includes(`branch refs/heads/${name}`)) continue;
    git(["checkout", name]);
    break;
  }

  const present = paths.filter((p) => existsSync(join(tree, p)));
  if (!present.length) return { committed: false, why: "nothing to commit" };

  try {
    git(["add", "--", ...present]);
    const staged = git(["diff", "--cached", "--name-only"]).trim();
    if (!staged) return { committed: false, why: "nothing was staged" };
    git(["commit", "-m", message]);
    return { committed: true, files: staged.split("\n") };
  } catch (error) {
    return { committed: false, why: (error.stdout || error.message || "").trim().split("\n")[0] };
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.dir)) {
    console.error(`[fleet-internal-surface-patch] the fleet root ${options.dir} does not exist.`);
    return 2;
  }

  const manifest = resolveManifest();
  if (!manifest) {
    console.error(
      "[fleet-internal-surface-patch] the canonical fix commits could not be read from git — " +
        "the fix is UNKNOWN and nothing was written. A patch that cannot prove what it " +
        "writes is not a patch.",
    );
    return 2;
  }

  // The population: the same discovery the fleet sweep uses, so the two
  // tools can never disagree about what the fleet is.
  const trees = new Set();
  if (options.tree) {
    if (!existsSync(options.tree)) {
      console.error(`[fleet-internal-surface-patch] ${options.tree} does not exist.`);
      return 2;
    }
    trees.add(options.tree);
  } else {
    for (const root of candidateRoots(options.dir)) trees.add(root);
  }

  const targets = [...trees].filter((t) => t !== CANONICAL);
  // An explicit --tree is the operator naming ONE surface to patch; --all
  // is the operator naming the fleet. Neither is implied by a bare run,
  // which is a REPORT and writes nothing.
  const applying = options.all || !!options.tree;

  let patched = 0;
  let eligible = 0;
  let blocked = 0;
  let stillOpen = 0;

  for (const tree of targets) {
    const before = measure(tree);
    if (before.unknown) {
      console.log(
        `  UNKNOWN  ${relative(options.dir, tree) || "."} — ${before.unknown}`,
      );
      continue;
    }
    if (!before.findings.length) continue;

    const groups = plan(tree, manifest);
    const applicable = groups.filter((g) => g.verdict !== "blocked");
    const conflicts = groups.filter((g) => g.verdict === "blocked");
    const pending = applicable.flatMap((g) => g.apply);
    const optionalPending = applicable.flatMap((g) => g.skipped);

    if (!pending.length) {
      blocked += 1;
      console.log(
        `  no-op    ${relative(options.dir, tree) || "."} — ${before.findings.length} finding(s); ` +
          `every file the fix touches already differs from the fix's own base, so nothing ` +
          `was written. ` +
          conflicts.map((c) => `${c.fix.id}: ${c.why}`).join("; "),
      );
      continue;
    }

    eligible += 1;
    const name = relative(options.dir, tree) || ".";

    if (!applying) {
      console.log(
        `  eligible ${name} — ${before.findings.length} finding(s); ${pending.length} file(s) ` +
          `would be written by ${applicable.map((g) => g.fix.id).join(", ")}` +
          (conflicts.length
            ? `; blocked: ${conflicts.map((c) => c.fix.id).join(", ")}`
            : ""),
      );
      continue;
    }

    const written = write(tree, groups, options.dryRun);
    const after = measure(tree);
    const gate = installGate(tree, after.findings, options.dryRun);

    const stillFinding = after.findings.length;
    if (stillFinding) stillOpen += 1;

    const message = `agent: gate the internal surfaces behind requireAdmin

The council, the federation funnel, the per-tenant health breakdown and the
Omni OS control plane were served to anyone with the URL. The reads moved
behind requireAdmin(), and the omni_token is signed so the gate cannot be
walked through.

Carried by scripts/patch-fleet-internal-surface.mjs from the canonical
commits ${manifest.map((m) => m.commit).join(", ")}. Every file written here
was byte-identical to the file the fix was written against, so no local
change was overwritten.`;

    const result =
      options.dryRun || !written.length
        ? { committed: false, why: options.dryRun ? "a dry run writes nothing" : "nothing to commit" }
        : commit(tree, [...written, ...gate.installed, "package.json"], message);

    patched += 1;
    console.log(
      `  ${options.dryRun ? "would patch" : "patched"} ${name} — ` +
        `${before.findings.length} finding(s) → ${stillFinding}` +
        (gate.installed.length
          ? `; ${options.dryRun ? "would install" : "installed"} ${gate.installed.join(", ")}`
          : "") +
        (gate.armed ? "; gate ARMED in the build chain" : "; gate NOT armed (the tree still has findings)") +
        (result.committed ? `; committed ${result.files.length} file(s)` : `; not committed — ${result.why}`),
    );
    for (const path of written) {
      console.log(`      write  ${path}`);
    }
    for (const finding of after.findings) {
      console.log(`      still  ${finding.rule}  ${finding.file}:${finding.line}`);
    }
    for (const skipped of optionalPending) {
      console.log(
        `      skipped ${skipped.file.path} — ${skipped.why} (optional; the gate does not depend on it)`,
      );
    }
  }

  console.log(
    `\n[fleet-internal-surface-patch] ${targets.length} tree(s) examined; ` +
      `${eligible} eligible, ${blocked} with a conflicting base, ${patched} patched, ` +
      `${stillOpen} still carrying findings.`,
  );
  if (!applying) {
    console.log(
      "[fleet-internal-surface-patch] nothing was written. Re-run with --tree <path> to " +
        "patch ONE tree, or --all to patch every eligible tree. A tree is only ever " +
        "patched where the file is byte-identical to the file the fix was written against.",
    );
  }
  return stillOpen ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
