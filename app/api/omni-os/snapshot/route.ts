import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { buildOmniOSOperatorSnapshot } from '@/lib/omni-os/snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

/**
 * GET /api/omni-os/snapshot — the Omni OS control plane for the operator.
 *
 * WHY THIS ROUTE IS ADMIN-ONLY
 *
 * Verified live before this change: an anonymous `curl` of
 * /api/omni-os/snapshot answered **200 with 47,896 bytes** — for every
 * client in the portfolio, its score and operating status, the loops it
 * has NOT connected, its revenue move, its next action, the internal
 * repository paths where its code lives on the operator's disk, and a
 * 43-item action queue naming what should happen next, per client.
 *
 * That is the agency's book of business: which clients are well wired
 * and which are one data connection away from stalling. "No secrets, no
 * PII" was true and was not the question — a score is not personal data,
 * it is confidential BUSINESS data, and the answer to "is this public?"
 * is a credential check, not a field-name check.
 *
 * The plan that created this endpoint said so itself: *"Read-only
 * endpoint should require existing dashboard auth or admin/cron auth if
 * sensitive data is added."* The auth was never added, and what the
 * endpoint returns grew into the control plane.
 *
 * The response is served `private, no-store`: a cacheable admin
 * response would otherwise be handed to the next anonymous caller.
 *
 * The payload is the OPERATOR projection (`buildOmniOSOperatorSnapshot`)
 * — the fields the operator view renders, and not the internal registry
 * bookkeeping (repository paths, revenue notes, match aliases).
 */
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  return NextResponse.json(buildOmniOSOperatorSnapshot(), {
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
