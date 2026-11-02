#!/usr/bin/env node
/**
 * Pre-push gate: refuse a push that would delete the live production release.
 *
 * Why this exists
 *
 * This repo has lost a live release to this defect THREE times:
 *
 *   2026-10-25  the AIS receiver was released with `vercel --prod` from an
 *               isolated worktree; the commit never reached `origin/main`.
 *   2026-10-29  three more commits were released the same way.
 *   2026-11-01  the Lead Franchise calendar commit was released with
 *               `vercel --prod` from a deploy worktree and committed on a
 *               feature branch; production's alias was held by that CLI
 *               deployment while `origin/main` did not contain it.
 *
 * In every case the release itself worked. The failure was discovered later,
 * when the next ordinary `git push origin main` rebuilt production from the
 * connected branch — a tree that did not contain the released commit — and
 * silently deleted a live route family. No build error, no log line, no
 * warning. The routes were simply gone.
 *
 * `scripts/audit-deploy-source-of-truth.mjs` DETECTS this state. It has to be
 * run by hand, and a rule that lives in a prose file is a rule that does not
 * hold — this repo has learned that twice (see the `loading.tsx` soft-404
 * regression, which was written down as item 12 and shipped anyway).
 *
 * So the detection moves into the path where the damage happens: the push
 * itself. This gate runs as a `pre-push` hook and refuses the push while the
 * release that production is actually serving is not reproducible from the
 * commit being pushed.
 *
 * The rule
 *
 *   The commit production is running must be an ancestor of the commit being
 *   pushed to the production branch. If it is not, the next git build is
 *   built from a tree that does not contain the live release, and the release
 *   is deleted without an error.
 *
 * "An ancestor of" is the right test and not "equal to": pushing a descendant
 * of the deployed commit is safe — the new tree still contains the release.
 *
 * Only the deployment that HOLDS the production alias is checked. A
 * superseded deployment whose commit is not on the branch is history, not a
 * live release; blocking on it would make the gate cry wolf forever.
 *
 * Fail closed
 *
 * If the Vercel API cannot be reached, or the alias holder cannot be
 * identified, or the deployed commit is not in this repository, the result is
 * UNKNOWN — and UNKNOWN is not permission. The push is refused. A blocked
 * push is recoverable in seconds (`OMNI_SKIP_DEPLOY_TRUTH=1 git push ...`,
 * which prints what was skipped); a silently deleted route family is not.
 *
 * Usage
 *
 *   node scripts/audit-pre-push.mjs              # read refspecs from stdin (git hook)
 *   node scripts/audit-pre-push.mjs --target=<sha> --branch=main
 *
 * Exit codes
 *   0  the push is safe (or does not touch the production branch)
 *   1  the push would delete a live release — REFUSED
 *   2  the result is UNKNOWN — REFUSED
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { vercelJson } from "./vercel-token.mjs";

const argv = process.argv.slice(2);
const arg = (name) => {
  const prefixed = argv.find((a) => a.startsWith(`${name}=`));
  if (prefixed) return prefixed.slice(name.length + 1);
  const index = argv.indexOf(name);
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith("--")) return argv[index + 1];
  return null;
};

const SKIP = process.env.OMNI_SKIP_DEPLOY_TRUTH === "1";

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

const git = (args) => run("git", args);

/**
 * The repository's canonical checkout root.
 *
 * A worktree's own `.vercel` link may point at a DIFFERENT Vercel project (the
 * fleet's receiver worktrees each hold one). The surface this gate protects is
 * the one the canonical checkout is linked to — so the project is read from
 * there, not from whichever directory the push happens to run in.
 */
function canonicalRoot() {
  const common = git(["rev-parse", "--git-common-dir"]);
  if (!common) return process.cwd();
  const absolute = common.startsWith("/") ? common : join(process.cwd(), common);
  // `<root>/.git` -> `<root>`
  return absolute.endsWith("/.git") ? absolute.slice(0, -5) : absolute;
}

function linkedProject() {
  const candidates = [
    join(canonicalRoot(), ".vercel", "project.json"),
    join(process.cwd(), ".vercel", "project.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      if (parsed && parsed.projectId && parsed.projectName) return parsed;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/** Read the refspecs git hands to a pre-push hook: "<local ref> <sha> <remote ref> <sha>". */
function readRefspecs() {
  let text = "";
  try {
    // fd 0 is the pipe git writes the refspecs to. Reading it as a file
    // descriptor is the only way to do this synchronously; a TTY throws.
    text = readFileSync(0, "utf8");
  } catch {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 4)
    .map(([localRef, localSha, remoteRef]) => ({ localRef, localSha, remoteRef }));
}

async function main() {
  const project = linkedProject();
  if (!project) {
    console.log("[pre-push] this checkout is not linked to a Vercel project — nothing to protect.");
    return 0;
  }

  const projectInfo = await vercelJson(`https://api.vercel.com/v9/projects/${project.projectId}`);
  const productionBranch = projectInfo?.link?.productionBranch || "main";

  // Which commit is this push going to publish?
  let targetSha = arg("--target");
  let targetBranch = arg("--branch") || productionBranch;
  if (!targetSha) {
    const refspecs = readRefspecs();
    // Match on the REMOTE ref, not the local one. A push of `HEAD:main`
    // carries the local ref "HEAD", so a local-ref match would skip exactly
    // the push that updates production.
    const match = refspecs.find((r) => r.remoteRef === `refs/heads/${targetBranch}`);
    if (!match) {
      console.log(
        `[pre-push] no ref update for refs/heads/${targetBranch} in this push — the production branch is not being touched.`,
      );
      return 0;
    }
    targetSha = match.localSha;
  }
  if (!/^[0-9a-f]{40}$/.test(targetSha)) {
    console.error(`[pre-push] could not resolve the commit this push would publish (got "${targetSha}").`);
    console.error("[pre-push] the result is UNKNOWN — refusing the push.");
    return 2;
  }

  const deployments = await vercelJson(
    `https://api.vercel.com/v6/deployments?projectId=${project.projectId}&target=production&limit=5`,
  );
  const list = deployments?.deployments ?? [];
  if (!list.length) {
    console.error("[pre-push] the Vercel API returned no production deployments.");
    console.error("[pre-push] the result is UNKNOWN — refusing the push.");
    return 2;
  }

  // Find the deployment that actually holds the production alias. A superseded
  // deployment is history; only the alias holder is a live release.
  let holder = null;
  for (const deployment of list) {
    const info = await vercelJson(`https://api.vercel.com/v9/deployments/${deployment.uid}`);
    const alias = Array.isArray(info?.alias) ? info.alias : [];
    const production = alias.filter((a) => !a.includes("vercel.app"));
    if (production.length) {
      holder = { uid: deployment.uid, source: deployment.source, alias: production, info };
      break;
    }
  }
  if (!holder) {
    console.error("[pre-push] no production deployment holds the production alias.");
    console.error("[pre-push] the result is UNKNOWN — refusing the push.");
    return 2;
  }

  const sha = holder.info?.meta?.githubCommitSha || holder.info?.meta?.gitCommitSha || null;
  const holderLabel = `${holder.uid} (${holder.source}) holds ${holder.alias.join(", ")}`;

  if (!sha) {
    console.error(`[pre-push] ${holderLabel}, but the deployment records no commit at all.`);
    console.error("[pre-push] the live release cannot be reproduced from git — refusing the push.");
    console.error("[pre-push] fix: redeploy production from a pushed commit, then push again.");
    return 2;
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    console.error(`[pre-push] ${holderLabel}, but its commit id is not a SHA (got "${sha}").`);
    console.error("[pre-push] the result is UNKNOWN — refusing the push.");
    return 2;
  }

  // The deployed commit has to be present locally for the ancestry test.
  if (git(["cat-file", "-e", `${sha}^{commit}`]) === null) {
    console.error(`[pre-push] ${holderLabel} runs commit ${sha.slice(0, 8)}, which is not in this repository.`);
    console.error("[pre-push] the live release exists nowhere in git — refusing the push.");
    console.error("[pre-push] fix: fetch that commit, merge it into the branch, then push again.");
    return 2;
  }

  const ancestor = git(["merge-base", "--is-ancestor", sha, targetSha]);
  if (ancestor === null) {
    console.error("");
    console.error(`[pre-push] REFUSED — this push would delete a live production release.`);
    console.error(`[pre-push]   production is served by ${holderLabel}`);
    console.error(`[pre-push]   that deployment runs commit ${sha.slice(0, 8)}, which is NOT an ancestor of`);
    console.error(`[pre-push]   ${targetSha.slice(0, 8)} (the commit this push would publish).`);
    console.error("[pre-push]   the next git build is made from a tree without that commit, so the routes");
    console.error("[pre-push]   it added disappear from production — silently, with no build error.");
    console.error("[pre-push] fix: merge that commit into the branch first —");
    console.error(`[pre-push]   git merge ${sha.slice(0, 8)}   (merge, do not rebase: the deployed SHA must stay an ancestor)`);
    console.error("[pre-push] then push again.");
    console.error(`[pre-push] override: OMNI_SKIP_DEPLOY_TRUTH=1 git push ... (records that you chose to skip this check)`);
    console.error("");
    return 1;
  }

  console.log(
    `[pre-push] ok — production (${holder.uid}, commit ${sha.slice(0, 8)}) is contained in ${targetSha.slice(0, 8)}.`,
  );
  return 0;
}

if (SKIP) {
  console.warn("[pre-push] SKIPPED by OMNI_SKIP_DEPLOY_TRUTH=1 — the deploy source-of-truth check did not run.");
  process.exit(0);
}

try {
  process.exit(await main());
} catch (error) {
  console.error(`[pre-push] ${error instanceof Error ? error.message : String(error)}`);
  console.error("[pre-push] the result is UNKNOWN — refusing the push.");
  process.exit(2);
}
