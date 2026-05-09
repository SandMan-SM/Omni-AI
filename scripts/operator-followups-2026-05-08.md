# Operator follow-ups — 2026-05-08

Compiled from the autonomous audit pass. Each item is a thing the
federation needs from a human (Mafi / Benji / Fred) — code is shipped,
ops is what's left.

## 1. Leifson + Phoenix — paste federation embed snippet (5 min each)

**Why:** their public sites are on **Squarespace** (Leifson) and
**Cloudflare/WordPress** (Phoenix). The Vercel scaffolds I've been
deploying for them never serve their visitors, so federation analytics
+ cross-promo on those domains read 0-2 events (just my smoke tests).

**Fix:** copy-paste verbatim from the pre-filled snippets:

| Site | Pre-filled snippet | Paste destination |
|---|---|---|
| **Leifson** | `scripts/leifson-squarespace-embed.html` | Squarespace → Settings → Advanced → Code Injection → **Footer** |
| **Phoenix** | `scripts/phoenix-wordpress-embed.html` | WordPress → Appearance → Customize → Custom HTML widget in footer, OR install "Insert Headers and Footers" plugin |

Both files are committed in `Omni AI Website/scripts/`. Generic template
for any future client lives at `scripts/federation-embed-snippet.html`.

After paste, real visitor traffic flows into `inbound_<slug>_events`
within seconds. No site migration needed — the universal tracker at
`https://omnileadsagi.com/embed/inbound-tracker.js` works on any
platform.

### Round-2 finding (post-deploy): cross-tenant visitor identity
Each federation tracker stores its own `<slug>_visitor_id` in
localStorage. So a person visiting Phoenix.com then leifsonbuilt.com
gets a different visitor_id per site (verified: 0/57 cross-tenant
visitors in 30d). Federation network-effect is currently measurable
ONLY through `cross_brand_referrals` (UTM `?ref=` attribution). To
enable visitor-level traversal across federation domains, would need
either email-based identity stitching at form-submit time OR a
fingerprint/identity-graph layer. Adding to product backlog, not a
defect.

## 2. omnileadsllc.com — Option A or B for DNS

**Status:** scaffold deployed at
`omnileadsllc-26mc777f7-sandman-sms-projects.vercel.app` (preview returns
401 due to default Vercel deployment-protection — production alias is
public once DNS lands).

**Decision needed:**

| | Option A — keep Namecheap DNS, add A-record only | Option B — full NS swap to Vercel |
|---|---|---|
| Email impact | None (MX + SPF preserved) | Breaks until rebuilt on Vercel DNS |
| Action | Edit 2 records in Namecheap dashboard (or whitelist current egress IP `24.10.137.93` in Namecheap API and I do via CLI) | Operator picks email-migration plan first |
| Time to live | ~5 min | 30-60 min |
| Risk | Zero | High |

**Records for Option A** (paste in Namecheap dashboard):
- `A @ → 76.76.21.21 TTL 300`
- `CNAME www → cname.vercel-dns.com. TTL 300`
- Leave MX + SPF alone

## 3. omnileadsllc.com — disable Vercel deployment-protection

**Status:** project `sandman-sms-projects/omnileadsllc` has default
"Vercel Authentication" enabled, which 401s the preview URL.

**Fix:** Vercel dashboard → Project `omnileadsllc` → Settings →
Deployment Protection → set "Vercel Authentication" to **Disabled** for
production. One click.

## 4. LTB cherry-pick — `lovethybarber.shop` working tree has WIP

**Status:** I never auto-deployed LTB because its working tree carries
unrelated WIP changes (cart/checkout/booking files). Federation patches
(tracker referral capture + footer cross-promo mount) are committed
locally but not on production.

**Decision needed:** ship the WIP alongside the federation patches, OR
let me cherry-pick only the federation files and deploy that subset.

## 5. omnileads.shop/merch — Stripe products

**Status:** 6 product cards on `app/merch/page.tsx` use placeholder
Stripe URLs (`STRIPE_PLACEHOLDER`). Buy buttons currently dead-end.

**Fix:** configure 6 products in Stripe dashboard (Imperium hoodie + cap,
Pantheon mug, Oracle print + notebook, Federation tee), grab the
payment-link URLs, paste into `PRODUCTS` array.

## 6. CRON_SECRET on Vercel

**Status:** crons disabled per directive ("they don't fucking work"), so
this is **not blocking**. But if you ever want to re-enable the nightly
Pantheon rebalance cron, the route needs `CRON_SECRET` env var set on
the Vercel project (I'd run via Supabase pg_cron or GitHub Actions
instead — both more reliable than Vercel crons).

**Workaround already in place:** I just executed the Pantheon rebalance
manually via SQL. Three weights drifted (imperium 1.0→1.16, leifson +
rene each +0.04 from Athena fairness). Logged to pantheon_proposals.

## 7. Telegram cross-conversion pings (Interlinked)

**Status:** module `app/core/federation_pings.py` shipped to
`/Users/janahasson/Desktop/Assets/Interlinked/` (separate repo). Needs:
- `FEDERATION_SLUG_CHAT_IDS` env var as JSON map of slug → chat_id
- Wired into the Interlinked scheduler (APScheduler / docker-compose
  service / cron — not Vercel)

## 8. RLS advisory on 75 Supabase tables

**Status:** Supabase reports critical RLS-disabled advisory on 75
tables (council_agents, omni_businesses, hades_*, leadership_runs,
pantheon_*, several inbound_*, prime_iv tables, etc.). Auto-applying
ALTER TABLE … ENABLE ROW LEVEL SECURITY without policies would lock
out legitimate access.

**Decision needed:** scope a policy migration (per-tenant access via
profiles.id, service-role bypass) or accept the current
service-role-only write convention.

## 9. Namecheap API IP whitelist

**Status:** Current worktree egress IP `24.10.137.93` is NOT
whitelisted on Namecheap API. Two prior NAT IPs are
(`107.191.2.7` + `107.191.2.25`). When working from this network, the
Namecheap CLI (`scripts/namecheap.ts`) returns
`1011150 Invalid request IP`.

**Fix:** Namecheap → Profile → Tools → API Access → Whitelisted IPs —
add `24.10.137.93`. Three IPs total covers home + both NAT pools.
