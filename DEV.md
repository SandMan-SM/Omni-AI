# Dev workflow

## TL;DR — work on the preview server, not local

Push code → Vercel auto-builds → refresh the preview URL.
**No local dev server required.** No freezes, no OOMs, no Tailwind JIT churn.

```bash
# from any branch with your changes:
npm run preview          # force-pushes HEAD → dev branch, prints preview URL
# wait 60-90s, then:
npm run preview:open     # opens the preview URL in your browser
```

**Preview URL** (stable across every push to `dev`):
👉 **<https://omni-ai-git-dev-sandman-sms-projects.vercel.app>**

The branch alias is permanent — every push to `dev` overwrites the build at this URL with the latest commit. Bookmark it.

---

## Why the preview server > local dev

The local dev server was freezing because of three deep problems no per-script flag could fix:

| Problem | Root cause | Fix |
|---|---|---|
| Process freezes mid-edit | Node default 4GB heap + Tailwind JIT scanning the full tree + 800+ files in the dynamic-import graph | Vercel builds run on the production-grade Node 20 LTS containers — never your laptop's RAM. |
| "Module not found" after a rename | webpack stale cache | Vercel does a clean install + clean build every push. |
| Behavior differs from prod | Local has Fast Refresh injecting magic; prod doesn't | Preview IS a real production build. What you see is what ships. |
| Env var drift | `.env.local` slowly diverges from production | Preview deploys auto-pull the production env vars from Vercel. |
| You can't show your phone | localhost only reaches your laptop | Preview URL works from any device, anywhere. |

---

## Local dev (when you actually want it)

The local scripts are still wired up and now Turbopack-powered — use them when you want sub-second HMR.

```bash
npm run dev          # Turbopack + 8GB heap (the new default)
npm run dev:slow     # Webpack fallback
npm run dev:clean    # Wipes .next + .turbo before starting (for HMR confusion)
npm run dev:prod     # Production build, runs locally on :3000 — no Fast Refresh
```

### Prerequisites for local dev

This repo is **pinned to Node 20 LTS**. If you're on a different major:

```bash
# nvm:
nvm use            # auto-reads .nvmrc
# fnm:
fnm use            # same
# asdf:
asdf install nodejs 20 && asdf local nodejs 20
```

`npm install` will refuse to proceed on the wrong Node major (engines-strict in `.npmrc`). That's intentional — Node 25 silently broke several deps in the past, and this guard catches it before it corrupts `node_modules`.

---

## Branch model

```
main  ──── production (omnileadsagi.com)
            ↑ merged via PR or `git push origin main`

dev   ──── preview   (omni-ai-git-dev-…vercel.app)
            ↑ force-pushed via `npm run preview`
```

- **`main`** — production. Every push triggers a real production deploy at `omnileadsagi.com`.
- **`dev`** — preview. `npm run preview` force-pushes whatever you have committed locally (on any branch) to `dev`, which Vercel rebuilds in ~60-90s. Force-push is intentional: `dev` is a scratch branch, not a long-lived feature branch.

### Cron / scheduled jobs

Vercel cron jobs only run on **production deployments** (target=production for the main branch). Preview deployments have crons disabled by default. Don't rely on cron-driven side effects when testing on the preview URL — trigger them manually via `/api/...` if you need to verify.

---

## Files that lock this in

| File | What it does |
|---|---|
| `.nvmrc` | Tells nvm/fnm/asdf to use Node 20 LTS. |
| `.npmrc` | `node-options=--max-old-space-size=8192` (every npm-run script inherits 8GB heap), `engines-strict=true` (block install on wrong Node major). |
| `package.json` `engines` | `node: 20.x, npm: >=10`. The other half of engines-strict. |
| `vercel.json` | Build command, framework, output dir. |
| `DEV.md` | This file. |

---

## When the preview deploy fails

Vercel will email + Slack you. Common causes:

1. **TypeScript error** — run `npm run check` locally first.
2. **Missing untracked file** — happened before with `InboundAnalytics.tsx`. Run `git status` before `npm run preview` to make sure nothing's sitting untracked.
3. **Env var missing** — Vercel's env vars cover production + preview by default. If you added a new var, set the scope to "Preview" too in the Vercel dashboard.

To get the build log:

```bash
# inspector URL is in the Vercel dashboard — or:
vercel logs <deployment-url>
```

---

## When the preview is slow

It shouldn't be — Vercel's edge serves the preview URL just like production. If a page feels slow, check:

1. The page itself isn't `force-dynamic` doing per-request DB hits when it could be ISR.
2. You're not hitting an admin API that requires the `omni_token` you don't have on the preview origin (different cookie scope).

---

## "I want a fresh production-quality local environment"

```bash
npm run dev:prod
```

This runs a real `next build` into a separate `.next-local` dir, then `next start`. No Fast Refresh, no HMR — every change requires a manual rebuild — but **it never freezes** and behaves byte-identical to production.
