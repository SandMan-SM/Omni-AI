# Omni AI Deployment Source of Truth

## Canonical source

- Shared desktop checkout: `/Users/janahasson/Desktop/Clients/Sitani Mafi/Omni AI/Website`
- Git remote: `https://github.com/SandMan-SM/Omni-AI.git`
- Production branch: `main`
- Vercel project: `omni-ai`
- Vercel project ID: `prj_TRmLRTqEhjJj8ZlV4MQk0zjFGtU4`
- Production domain: `https://omnileadsagi.com`

Codex Desktop, Claude Desktop, and OmniClaw must start by inspecting this checkout and `origin/main`. Do not deploy an older dirty checkout over newer Git history.

## Normal release path

1. Work from the shared checkout above, or create a clean worktree from its current `origin/main` when the shared checkout is already dirty.
2. Read `CLAUDE.md`, inspect `git status --short --branch`, fetch `origin`, and preserve all existing tracked/untracked work.
3. Merge or commit the scoped change into `main`; never reset, clean, or replace the desktop worktree.
4. Run `npm run check` and `npm run build` (or the documented clean-worktree equivalent).
5. Push `main` to GitHub. The linked Vercel project deploys from GitHub `main`.
6. Confirm Vercel reports `READY` and `PROMOTED`, then smoke-test the production domain and the changed routes.
7. Record the production deployment ID, source SHA, checks, live routes, and rollback candidate under the central `deploy-records/` directory.

Direct `vercel --prod` from a dirty or behind checkout is prohibited. If a direct deploy is unavoidable, use the guarded runner and first reconcile every live source file back into GitHub `main`.

## The pre-push gate (why the prohibition is enforced, not just written)

A CLI release from a commit that never reached `main` does not break. It works.
The damage happens on the **next** ordinary `git push origin main`: Vercel
rebuilds production from the pushed tree, that tree does not contain the
released commit, and the live route family disappears — silently, with no
build error and no log line.

That has happened three times on this repo (2026-10-25, 2026-10-29,
2026-11-01). The prohibition above is therefore enforced by a gate at the
moment of the push:

- `scripts/audit-pre-push.mjs` asks one question — **is the commit production
  is running an ancestor of the commit this push would publish?** If not, the
  push is refused.
- It runs as a `pre-push` hook (`.githooks/pre-push`), installed with
  `npm run hooks:install`. `core.hooksPath` is set to an **absolute** path so
  the gate is live in every worktree of this repository, not just the
  canonical checkout — the worktrees are where CLI releases happen.
- It fails closed: if the Vercel API cannot be reached, or the alias holder
  cannot be identified, or the deployed commit is not in the repository, the
  result is UNKNOWN and the push is refused.
- Only the deployment **holding the production alias** is checked. A
  superseded deployment is history, not a live release.
- `npm run audit:deploy` (`scripts/audit-deploy-source-of-truth.mjs`) still
  answers "does git describe what production is running?" — run it after a
  release. The hook answers the different question "will this push delete the
  live release?" — it runs automatically.
- Deliberate skip: `OMNI_SKIP_DEPLOY_TRUTH=1 git push ...` prints what was
  skipped.

**The remedy the hook names is a merge, not a rebase.** A rebase rewrites the
deployed SHA, so the deployment's commit stops being an ancestor of `main`
and the gate keeps refusing — which is correct, because the tree still would
not contain the released content under the new SHA.

## Newsletter artwork invariant

Every published newsletter slug must have its own issue-specific raster asset under `public/newsletter/generated/`, and `components/newsletter-issue-card.tsx` must resolve directly to that asset. Published cards must not rely on `default.webp`, a generic logo/OG image, or the dynamic artwork route as a fallback. Verify visually on both `/newsletter` and `/newsletter/archive` after every release that touches newsletter components, assets, or layout.

## Known rollback history

- Last verified image-fallback build before the regression: Vercel `dpl_5teynRii3XyZss2nq65wWxVvMAbW`, Git SHA `a16f0d8b0899d80d6b91bf0c2440cad19d2d8037`.
- Regression source: Vercel `dpl_4uoJQTyTb45osEaARugnFQRtsmPo`, dirty CLI deployment from old Git SHA `676ec08d0dd03a113d4085757b65939936a3cd36`.
- Reconciled production build: Vercel `dpl_8BDd6C5ufPbD8vtqCvj7YaXgSxcx`, Git SHA `0ba96f8ec4f6aa0a21b7ac6c02919747e4bf6aa0`.

The reconciled build preserves the desktop booking/service work, the newsletter fallback, and the later Meta AI page changes in one Git-tracked source.
