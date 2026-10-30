#!/usr/bin/env node
/**
 * Audit that the production deployment is actually described by git.
 *
 * Why this exists:
 *
 * Vercel builds a deployment from whatever source it is handed — a commit on
 * the connected branch, OR a CLI upload from any working directory. The
 * deployment records which one it was in `meta.githubCommitSha` (git build)
 * or `meta.gitCommitSha` (CLI build). A CLI deployment has no
 * `githubCommitSha`, which is the tell.
 *
 * The failure this gate catches is silent and total. A CLI deploy of a tree
 * that was never pushed leaves production running code that git does not
 * contain. Nothing breaks at deploy time; the deployment is READY and the
 * site works. The *next* ordinary `git push` triggers a rebuild from the
 * connected branch, and that rebuild does not contain the CLI-only code, so
 * the next build quietly deletes live routes from production. The symptom
 * appears minutes or hours later, on a different surface, with no error in
 * any log.
 *
 * This has already happened on this repo: the AIS portfolio reporting
 * routes, the owned-domain reporting, and the scheduled SEO crawler were
 * live in production for hours while `origin/main` did not contain them.
 *
 * Rules:
 *   - local-unpushed-commits      HEAD is ahead of the connected branch.
 *   - deployed-commit-not-on-branch  the deployed commit is not an ancestor
 *                                    of the connected branch. The next git
 *                                    build will not reproduce production.
 *   - deployed-commit-unverifiable the deployment records no commit at all.
 *   - deployment-without-alias    the newest production deployment does not
 *                                    hold the production alias (a deploy may
 *                                    be in flight; re-run).
 *   - dirty-worktree              uncommitted changes in this checkout.
 *
 * Usage:
 *   node scripts/audit-deploy-source-of-truth.mjs            # gate, exit 1 on findings
 *   node scripts/audit-deploy-source-of-truth.mjs --report   # report, always exit 0
 *
 * Requires: git, a linked Vercel project (`.vercel/project.json`), and a
 * Vercel token (the CLI's own auth file, or `VERCEL_TOKEN`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const reportOnly = process.argv.includes("--report");

/** Run a command and return stdout, or null when it fails. */
function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    }).trim();
  } catch {
    return null;
  }
}

function git(args) {
  return run("git", args);
}

/** The SHA the remote branch currently points at, without touching local refs. */
function lsRemoteSha(branch) {
  const out = git(["ls-remote", "origin", `refs/heads/${branch}`]);
  if (!out) return null;
  const sha = out.split(/\s+/)[0];
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

/** Whether the object store already holds a commit. */
function hasCommit(sha) {
  return git(["cat-file", "-e", `${sha}^{commit}`]) !== null;
}

function linkedProject() {
  const path = join(process.cwd(), ".vercel", "project.json");
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed.projectId && parsed.projectName ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The Vercel token. The CLI keeps one in its own auth file; `VERCEL_TOKEN`
 * wins so the gate can run in CI. The token is never printed.
 */
function vercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const path = join(homedir(), "Library/Application Support/com.vercel.cli/auth.json");
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed.token === "string" ? parsed.token : null;
  } catch {
    return null;
  }
}

async function vercelJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

const findings = [];
function finding(rule, detail, fix) {
  findings.push({ rule, detail, fix });
  console.log(`  ${rule}  ${detail}`);
  if (fix) console.log(`          fix: ${fix}`);
}

async function main() {
  const project = linkedProject();
  if (!project) {
    console.error("[deploy-truth] this checkout is not linked to a Vercel project (.vercel/project.json missing).");
    console.error("[deploy-truth] run `npx vercel link` in this checkout first.");
    return 2;
  }
  const token = vercelToken();
  if (!token) {
    console.error("[deploy-truth] no Vercel token. Authenticate the CLI (`npx vercel whoami`) or set VERCEL_TOKEN.");
    return 2;
  }

  // The connected branch is whatever Vercel auto-deploys to production.
  const projectInfo = await vercelJson(
    `https://api.vercel.com/v9/projects/${project.projectId}`,
    token,
  );
  const branch = projectInfo?.link?.productionBranch || "main";

  // The connected branch is read with `ls-remote` rather than by fetching
  // into `origin/<branch>`: a fetch would overwrite the local remote-tracking
  // ref, and the whole point of this gate is to compare the branch as the
  // remote actually holds it against what production is running. Reading it
  // without mutating the checkout also keeps the gate safe to run from a
  // dirty working tree.
  const remoteSha = lsRemoteSha(branch);
  if (!remoteSha) {
    console.error(`[deploy-truth] could not read origin/${branch}.`);
    return 2;
  }
  // The remote commit has to be present locally for the ancestry test. Fetch
  // it by SHA if it is not — GitHub serves a reachable SHA on request.
  let remoteCommit = remoteSha;
  if (!hasCommit(remoteSha)) {
    const fetched = git(["fetch", "--quiet", "origin", remoteSha]);
    if (fetched === null) {
      console.error(`[deploy-truth] origin/${branch} is at ${remoteSha.slice(0, 8)}, which is not in this repository.`);
      console.error("[deploy-truth] fetch it before judging reachability.");
      return 2;
    }
    remoteCommit = "FETCH_HEAD";
  }
  const remoteRef = `origin/${branch}@${remoteSha.slice(0, 8)}`;

  const head = git(["rev-parse", "HEAD"]);
  if (!head) {
    console.error("[deploy-truth] could not resolve HEAD.");
    return 2;
  }

  const ahead = Number(git(["rev-list", "--count", `${remoteCommit}..HEAD`]) ?? "0");
  const behind = Number(git(["rev-list", "--count", `HEAD..${remoteCommit}`]) ?? "0");

  console.log(`[deploy-truth] project ${project.projectName} (${project.projectId}), branch ${branch}`);
  console.log(`[deploy-truth] HEAD ${head.slice(0, 8)} — ${ahead} commit(s) ahead of ${remoteRef}, ${behind} behind`);

  const dirty = git(["status", "--porcelain"]);
  if (dirty) {
    finding(
      "dirty-worktree",
      "this checkout has uncommitted changes",
      "commit or stash them — never release from a dirty checkout",
    );
  }

  if (ahead > 0) {
    finding(
      "local-unpushed-commits",
      `${ahead} commit(s) exist locally but are not on ${remoteRef}`,
      `git push origin ${branch} — until they are pushed, git does not describe what will be built`,
    );
  }

  const deployments = await vercelJson(
    `https://api.vercel.com/v6/deployments?projectId=${project.projectId}&target=production&limit=5`,
    token,
  );
  const list = deployments?.deployments ?? [];
  if (!list.length) {
    console.error("[deploy-truth] the Vercel API returned no production deployments.");
    return 2;
  }

  for (const deployment of list.slice(0, 3)) {
    const sha = deployment?.meta?.githubCommitSha || deployment?.meta?.gitCommitSha || null;
    const label = `${deployment.uid} (${deployment.source})`;
    if (!sha) {
      finding(
        "deployed-commit-unverifiable",
        `deployment ${label} records no commit at all`,
        "redeploy from a pushed commit so production is reproducible from git",
      );
      continue;
    }
    const known = git(["cat-file", "-e", `${sha}^{commit}`]);
    if (known === null) {
      finding(
        "deployed-commit-unverifiable",
        `deployment ${label} runs commit ${sha.slice(0, 8)}, which is not in this repository`,
        "the deployed source exists nowhere in git — fetch it and commit it before the next push",
      );
      continue;
    }
    const ancestor = git(["merge-base", "--is-ancestor", sha, remoteCommit]);
    if (ancestor === null) {
      finding(
        "deployed-commit-not-on-branch",
        `deployment ${label} runs commit ${sha.slice(0, 8)}, which is NOT on ${remoteRef}`,
        `git push the commit (or cherry-pick it) — the next git build will delete whatever that commit added`,
      );
    } else {
      console.log(`  ok  ${label} runs ${sha.slice(0, 8)}, which is on ${remoteRef}`);
    }
  }

  const aliasInfo = await vercelJson(
    `https://api.vercel.com/v9/deployments/${list[0].uid}`,
    token,
  );
  const aliases = aliasInfo?.alias ?? [];
  if (aliasInfo && aliasInfo.aliasAssigned === false) {
    finding(
      "deployment-without-alias",
      `the newest production deployment ${list[0].uid} does not hold the production alias`,
      "a deploy may be in flight — re-run once it settles",
    );
  } else if (aliases.length) {
    console.log(`  ok  production alias held by ${list[0].uid}: ${aliases.filter((a) => !a.includes("vercel.app") || a.includes("-git-")).join(", ") || aliases[0]}`);
  }

  if (!findings.length) {
    console.log("[deploy-truth] no findings — git describes the running production deployment.");
    return 0;
  }
  console.log(
    `[deploy-truth] ${findings.length} finding(s). A production deployment that git cannot reproduce is ` +
      `removed by the next ordinary push, silently.`,
  );
  return reportOnly ? 0 : 1;
}

process.exit(await main());
