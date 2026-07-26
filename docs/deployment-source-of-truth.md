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

## Newsletter artwork invariant

`components/newsletter-issue-card.tsx` must keep an issue-specific image followed by `/newsletter/generated/default.webp`. The default asset must exist at `public/newsletter/generated/default.webp`. Verify visually on both `/newsletter` and `/newsletter/archive` after every release that touches newsletter components, assets, or layout.

## Known rollback history

- Last verified image-fallback build before the regression: Vercel `dpl_5teynRii3XyZss2nq65wWxVvMAbW`, Git SHA `a16f0d8b0899d80d6b91bf0c2440cad19d2d8037`.
- Regression source: Vercel `dpl_4uoJQTyTb45osEaARugnFQRtsmPo`, dirty CLI deployment from old Git SHA `676ec08d0dd03a113d4085757b65939936a3cd36`.
- Reconciled production build: Vercel `dpl_8BDd6C5ufPbD8vtqCvj7YaXgSxcx`, Git SHA `0ba96f8ec4f6aa0a21b7ac6c02919747e4bf6aa0`.

The reconciled build preserves the desktop booking/service work, the newsletter fallback, and the later Meta AI page changes in one Git-tracked source.
