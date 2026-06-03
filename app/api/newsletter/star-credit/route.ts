import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { resolveAccountUser } from "@/lib/server/account-user";
import {
  findNewsletterStarCredit,
  NEWSLETTER_STAR_CREDIT,
  persistNewsletterStarCredit,
  type NewsletterStarCreditRecord,
} from "@/lib/server/newsletter-star-credits";
import {
  isBotSubmission,
  isValidEmail,
  sanitizeText,
} from "@/lib/validation";
import {
  getClientIp,
  rateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Body = {
  newsletterSlug?: unknown;
  newsletterTitle?: unknown;
  pageUrl?: unknown;
  website?: unknown;
  url?: unknown;
  hp?: unknown;
};

function claimResponse(params: {
  claim: NewsletterStarCreditRecord | null;
  newsletterSlug: string;
  newsletterTitle: string;
  alreadyClaimed: boolean;
  creditAwardedNow?: number;
  status?: string;
  message?: string;
}) {
  const creditAwarded = params.claim?.creditAwarded || NEWSLETTER_STAR_CREDIT;
  return {
    ok: true,
    claimed: Boolean(params.claim),
    alreadyClaimed: params.alreadyClaimed,
    claimId: params.claim?.id || null,
    newsletterSlug: params.newsletterSlug,
    newsletterTitle: params.claim?.newsletterTitle || params.newsletterTitle,
    readerEmail: params.claim?.readerEmail || null,
    claimedAt: params.claim?.claimedAt || null,
    creditAwarded,
    creditAwardedNow: params.creditAwardedNow ?? 0,
    status: params.status,
    message: params.message,
  };
}

function resolveNewsletterSlug(value: unknown): string {
  return sanitizeText(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(req: Request) {
  noStore();

  const url = new URL(req.url);
  const newsletterSlug = resolveNewsletterSlug(
    url.searchParams.get("newsletterSlug"),
  );
  const newsletterTitle = sanitizeText(
    url.searchParams.get("newsletterTitle") || newsletterSlug,
    220,
  );

  if (!newsletterSlug) {
    return NextResponse.json(
      { error: "Newsletter slug is required." },
      { status: 400 },
    );
  }

  const user = await resolveAccountUser(req);
  if (!user) {
    return NextResponse.json(
      {
        claimed: false,
        alreadyClaimed: false,
        newsletterSlug,
        newsletterTitle,
        creditAwarded: NEWSLETTER_STAR_CREDIT,
        error: "Sign in before checking this newsletter credit.",
      },
      { status: 401 },
    );
  }

  const claim = await findNewsletterStarCredit(user.id, newsletterSlug);
  return NextResponse.json(
    claimResponse({
      claim,
      newsletterSlug,
      newsletterTitle,
      alreadyClaimed: Boolean(claim),
    }),
  );
}

export async function POST(req: Request) {
  noStore();

  const user = await resolveAccountUser(req);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to claim this newsletter credit." },
      { status: 401 },
    );
  }

  const ip = getClientIp(req.headers);
  const rl = rateLimit(
    `newsletter-star-credit:${user.id}:${ip}`,
    10,
    10 * 60 * 1000,
  );
  if (!rl.ok) return rateLimitResponse(rl.resetMs);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (isBotSubmission(body as Record<string, unknown>)) {
    return NextResponse.json({ ok: true });
  }

  const newsletterSlug = resolveNewsletterSlug(body.newsletterSlug);
  const newsletterTitle =
    sanitizeText(body.newsletterTitle, 220) || newsletterSlug;
  const pageUrl = sanitizeText(body.pageUrl, 500);
  const readerEmail = sanitizeText(user.email, 254).toLowerCase();

  if (!newsletterSlug) {
    return NextResponse.json(
      { error: "Newsletter slug is required." },
      { status: 400 },
    );
  }

  if (!isValidEmail(readerEmail)) {
    return NextResponse.json(
      { error: "Your Omni account needs a valid email before claiming." },
      { status: 400 },
    );
  }

  const existing = await findNewsletterStarCredit(user.id, newsletterSlug);
  if (existing) {
    return NextResponse.json(
      claimResponse({
        claim: existing,
        newsletterSlug,
        newsletterTitle,
        alreadyClaimed: true,
        creditAwardedNow: 0,
        status: "direct-postgres-existing",
        message:
          "This newsletter credit is already claimed on your Omni account.",
      }),
    );
  }

  const result = await persistNewsletterStarCredit({
    id: randomUUID(),
    userId: user.id,
    readerEmail,
    newsletterSlug,
    newsletterTitle,
    pageUrl: pageUrl || null,
    ipAddress: ip === "unknown" ? null : ip,
    userAgent: req.headers.get("user-agent") || null,
    creditAwarded: NEWSLETTER_STAR_CREDIT,
    raw: {
      newsletterSlug,
      newsletterTitle,
      creditAwarded: NEWSLETTER_STAR_CREDIT,
      pageUrl,
    },
  });

  if (!result.persisted || !result.claim) {
    return NextResponse.json(
      {
        error:
          "Newsletter credit capture is temporarily unavailable. Try again in a moment.",
        status: result.status,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    claimResponse({
      claim: result.claim,
      newsletterSlug,
      newsletterTitle,
      alreadyClaimed: result.alreadyClaimed,
      creditAwardedNow: result.creditAwardedNow,
      status: result.status,
      message: result.alreadyClaimed
        ? "This newsletter credit is already claimed on your Omni account."
        : `+${NEWSLETTER_STAR_CREDIT} Omni credits claimed for this issue.`,
    }),
    { status: result.alreadyClaimed ? 200 : 201 },
  );
}
