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
 *   - failed-build                the build of the branch TIP errored or was
 *                                    canceled. Production is healthy and
 *                                    quiet, and the change is not live.
 *   - no-deployment-for-tip       the branch tip has no deployment at all,
 *                                    long after the push — the Git
 *                                    integration never built it.
 *   - production-alias-held-elsewhere  the tip built and is READY, but a
 *                                    different deployment holds production.
 *   - production-behind-branch    production serves an ancestor of the tip
 *                                    and no other rule explains why.
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
import { join } from "node:path";
import { vercelJson } from "./vercel-token.mjs";

const reportOnly = process.argv.includes("--report");

/**
 * How long the branch tip may wait for a build before its absence counts.
 *
 * A push is not a build: the Git integration picks it up in seconds, but the
 * build itself takes minutes, and a build can also be skipped entirely. The
 * window between "pushed" and "built" is normal and must not be reported —
 * a gate that cries wolf on every release is a gate nobody reads.
 */
const TIP_GRACE_MINUTES = 10;

/**
 * The states a deployment can be in.
 *
 * `IN_FLIGHT` is the normal window between a push and a release — the build
 * is running, and the alias has not moved yet. `FAILED` is not: an ERROR or
 * CANCELED deployment will never become READY, so calling it "still building"
 * sends the operator away to wait for a build that is never coming.
 */
const IN_FLIGHT = new Set(["BUILDING", "QUEUED", "INITIALIZING", "PENDING", "UPLOADING", "DEPLOYING"]);
const FAILED = new Set(["ERROR", "CANCELED"]);

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
 * The Vercel API access.
 *
 * `vercelJson` throws when the API cannot be reached with a valid credential
 * and refreshes an expired token first. The old local helper flattened every
 * non-OK response to `null`, so an expired token was reported as "the Vercel
 * API returned no production deployments" — the most misleading message this
 * gate can print, because it says *nothing is running* when the truth is
 * *I could not look*.
 */
async function apiJson(url) {
  return vercelJson(url);
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
  // The connected branch is whatever Vercel auto-deploys to production.
  const projectInfo = await apiJson(
    `https://api.vercel.com/v9/projects/${project.projectId}`,
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

  const deployments = await apiJson(
    `https://api.vercel.com/v6/deployments?projectId=${project.projectId}&target=production&limit=10`,
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

  const aliasInfo = await apiJson(
    `https://api.vercel.com/v9/deployments/${list[0].uid}`,
  );
  const aliases = aliasInfo?.alias ?? [];
  const readyState = aliasInfo?.readyState ?? aliasInfo?.state ?? null;
  let pendingDeployment = null;
  if (aliasInfo && readyState && FAILED.has(readyState)) {
    // A failed deployment never took the alias — production is still served
    // by the previous READY one. Saying "the alias flips when it is READY"
    // here would send the operator away to wait for a build that is never
    // coming.
    console.log(
      `  note  the newest production deployment ${list[0].uid} is ${readyState} — ` +
        `it does not hold production; the failed-build rule below names the failure`,
    );
  } else if (aliasInfo && readyState && readyState !== "READY") {
    // A deployment that is still building has not been given the alias yet.
    // That is a normal state between a push and the build finishing, not a
    // defect — reporting it as a finding would cry wolf on every release.
    pendingDeployment = { uid: list[0].uid, state: readyState };
    console.log(
      `  note  the newest production deployment ${list[0].uid} is ${readyState} — ` +
        `the alias flips when it is READY, so re-run this gate after the build settles`,
    );
  } else if (aliasInfo && aliasInfo.aliasAssigned === false) {
    finding(
      "deployment-without-alias",
      `the newest production deployment ${list[0].uid} is READY but does not hold the production alias`,
      "the deployment did not take production — check its alias assignment in the Vercel dashboard",
    );
  } else if (aliases.length) {
    console.log(`  ok  production alias held by ${list[0].uid}: ${aliases.filter((a) => !a.includes("vercel.app") || a.includes("-git-")).join(", ") || aliases[0]}`);
  }

  // ---------------------------------------------------------------------------
  // Did the tip of the production branch actually reach production?
  // ---------------------------------------------------------------------------
  //
  // The rules above answer ONE question: "is what production is running
  // described by git?" They cannot answer "did my last push ship?" — and the
  // difference is a whole class of silent failure.
  //
  // A deployment of an OLDER commit is still on the branch, so every rule
  // above stays quiet while the pushed tip sits unbuilt, or built and failed.
  // A failed Vercel build produces no error anywhere an operator is looking:
  // the push succeeded, the site is up (it is the previous build), and nothing
  // says the new code is not live. This repo ships through agents that push
  // and then verify by reading the site — so a failed build reads as "the
  // change is live" until somebody diffs a route that was supposed to change.
  //
  // So the question is asked directly, and it is asked of the DEPLOYMENT of
  // the branch tip — not of production. A build that failed or was canceled
  // is a defect even though production is perfectly healthy.
  //
  // The grace period matters: a push has not been picked up by the Git
  // integration in the first seconds, and a build takes minutes. Reporting
  // that window as a finding would cry wolf on every release, and a gate
  // that cries wolf is a gate nobody reads.
  const shaOf = (d) => d?.meta?.githubCommitSha || d?.meta?.gitCommitSha || null;
  const stateOf = (d) => d?.readyState || d?.state || null;

  const tipSha = remoteSha;
  const tipDeployments = list.filter((d) => shaOf(d) === tipSha);
  // The deployment serving production is the newest READY one — a build that
  // is still in flight has not been given the alias yet.
  const serving = list.find((d) => stateOf(d) === "READY");
  const servingSha = serving ? shaOf(serving) : null;

  // How long has the tip been waiting? The commit's own timestamp is a good
  // enough proxy for "how long since the push" and needs no extra API call.
  const tipCommitTime = Number(git(["log", "-1", "--format=%ct", remoteCommit]) ?? "0");
  const tipAgeMinutes = tipCommitTime ? Math.round((Date.now() / 1000 - tipCommitTime) / 60) : null;
  const tipIsOld = tipAgeMinutes !== null && tipAgeMinutes >= TIP_GRACE_MINUTES;

  const tipInFlight = tipDeployments.some((d) => IN_FLIGHT.has(stateOf(d)));
  const tipFailed = tipDeployments.find((d) => FAILED.has(stateOf(d)));
  const tipReady = tipDeployments.find((d) => stateOf(d) === "READY");

  if (tipFailed) {
    finding(
      "failed-build",
      `the build of ${tipSha.slice(0, 8)} ${stateOf(tipFailed) === "ERROR" ? "FAILED" : "was CANCELED"} ` +
        `(deployment ${tipFailed.uid}) — production is still serving ${servingSha ? servingSha.slice(0, 8) : "an older release"}`,
      `read that deployment's build log, fix it, and push again — a failed build is not a release`,
    );
  } else if (!tipDeployments.length) {
    if (tipIsOld) {
      finding(
        "no-deployment-for-tip",
        `origin/${branch} is at ${tipSha.slice(0, 8)} but no production deployment exists for that commit ` +
          `(${tipAgeMinutes} min old) — the push did not produce a build`,
        "check the Vercel project's Git integration for this branch, or deploy that commit explicitly",
      );
    } else {
      console.log(
        `  note  no deployment of ${tipSha.slice(0, 8)} yet (pushed ${tipAgeMinutes} min ago) — ` +
          `the Git integration has not picked it up; re-run this gate in a few minutes`,
      );
    }
  } else if (tipInFlight) {
    console.log(
      `  note  the build of ${tipSha.slice(0, 8)} is still in flight — production flips to it when it is READY`,
    );
  } else if (tipReady && serving && serving.uid === tipReady.uid) {
    console.log(`  ok  the branch tip ${tipSha.slice(0, 8)} built and is serving production`);
  } else if (tipReady && serving) {
    const behindCount = servingSha ? (git(["rev-list", "--count", `${servingSha}..${tipSha}`]) ?? "?") : "?";
    finding(
      "production-alias-held-elsewhere",
      `the build of ${tipSha.slice(0, 8)} is READY but production is served by ${serving.uid}` +
        `${servingSha ? ` (${servingSha.slice(0, 8)}, ${behindCount} commit(s) behind)` : ""} — the alias was taken by another deployment`,
      "check which deployment holds the production alias; a newer CLI deploy can take it from a git build",
    );
  } else {
    console.log(
      `  note  the build of ${tipSha.slice(0, 8)} is ${tipDeployments.map((d) => stateOf(d)).join(", ")} — re-run this gate when it settles`,
    );
  }

  // The umbrella statement: production is serving an ancestor of the branch
  // tip, so the last push did not reach production. The cause-specific rules
  // above already say WHY, so this only fires when nothing else explains it.
  const servingIsOlder =
    servingSha &&
    servingSha !== tipSha &&
    git(["merge-base", "--is-ancestor", servingSha, tipSha]) !== null;
  const explained = Boolean(tipFailed) || tipInFlight || Boolean(tipReady) || (tipDeployments.length === 0 && !tipIsOld);
  if (servingIsOlder && !explained) {
    const behindCount = git(["rev-list", "--count", `${servingSha}..${tipSha}`]) ?? "?";
    finding(
      "production-behind-branch",
      `production is serving ${servingSha.slice(0, 8)} while origin/${branch} is at ${tipSha.slice(0, 8)} ` +
        `(${behindCount} commit(s) behind) — the last push did not reach production`,
      "find out why that commit did not deploy, then deploy it — a commit on the branch is not a release",
    );
  }

  if (!findings.length) {
    if (pendingDeployment) {
      console.log(
        `[deploy-truth] no findings, but deployment ${pendingDeployment.uid} is still ${pendingDeployment.state} — ` +
          `production is serving the previous deployment until it is READY and aliased.`,
      );
    } else {
      console.log(
        "[deploy-truth] no findings — git describes the running production deployment, " +
          "and the branch tip is the release serving production.",
      );
    }
    return 0;
  }
  // The footer names the consequences of the rules that actually fired —
  // a generic sentence would be wrong for half of them.
  const rules = new Set(findings.map((f) => f.rule));
  const consequences = [];
  if (rules.has("deployed-commit-not-on-branch") || rules.has("deployed-commit-unverifiable")) {
    consequences.push(
      "the running deployment is not described by the branch — the next git build removes it, silently",
    );
  }
  if (rules.has("local-unpushed-commits")) {
    consequences.push(
      "commits exist locally but not on the branch — push them before releasing",
    );
  }
  if (rules.has("deployment-without-alias")) {
    consequences.push("the newest deployment is not serving the production alias");
  }
  if (rules.has("dirty-worktree")) {
    consequences.push("a release from a dirty checkout is not reproducible");
  }
  if (rules.has("failed-build") || rules.has("no-deployment-for-tip")) {
    consequences.push(
      "the branch tip was never released — production is serving an older commit than the one you pushed",
    );
  }
  if (rules.has("production-alias-held-elsewhere")) {
    consequences.push("the release built, but another deployment took the production alias");
  }
  if (rules.has("production-behind-branch")) {
    consequences.push("the last push did not reach production");
  }
  console.log(
    `[deploy-truth] ${findings.length} finding(s): ${consequences.join("; ") || "see the rules above"}.`,
  );
  return reportOnly ? 0 : 1;
}

/**
 * A credential problem is not a clean result.
 *
 * The gate exists to stop a release that git cannot reproduce. If it cannot
 * reach the Vercel API, it does not know what production is running, so it
 * must fail — loudly, and with the reason. Reporting "no production
 * deployments" for an expired token sends the operator looking for missing
 * deployments instead of re-authenticating.
 */
try {
  process.exit(await main());
} catch (error) {
  console.error(`[deploy-truth] ${error instanceof Error ? error.message : String(error)}`);
  console.error("[deploy-truth] the result is UNKNOWN — authenticate the CLI (`npx vercel whoami`) and re-run.");
  process.exit(2);
}
