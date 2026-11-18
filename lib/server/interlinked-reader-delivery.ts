import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { interlinkedIssueUrl, renderInterlinkedEditorialEmail, type EditorialEmailIssue } from "./interlinked-editorial-email";
import { editorialUnsubscribeUrl } from "./editorial-unsubscribe";
import { interlinkedDatabase } from "./interlinked-audience";
import { isRetiredFederationContact } from "./federation-contact-retirement";

const sender = "AIS Interlinked <newsletter@omnios.news>";
const omniBusinessId = "146f6f87-6ed7-4c21-a0e3-fac2c91c2748";
const currentConsent = `
  r.consent_at is not null and r.completed_at is not null and r.unsubscribed_at is null
  and exists (
    select 1 from public.newsletter_subscriptions n
    where n.email = r.email and n.subscribed is true and n.subscription_tier <> 'unsubscribed'
  )
  and exists (
    select 1 from public.federation_newsletter_subscribers f
    where f.site = 'omni' and f.email = r.email and f.unsubscribed is false
      and f.subscription_state = 'active'
  )
`;

type Issue = EditorialEmailIssue & { id: string; slug: string; published_at: Date };
type Payload = { from: string; to: [string]; subject: string; html: string; text: string; headers: Record<string, string> };
type Job = { reader_id: string; email: string; payload: string | null };

function emailPayload(issue: Issue, email: string, readerId: string): Payload {
  const unsubscribeUrl = editorialUnsubscribeUrl(readerId);
  return {
    from: sender,
    to: [email],
    ...renderInterlinkedEditorialEmail(issue, unsubscribeUrl),
    headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

async function authorizedForDelivery(email: string) {
  if (isRetiredFederationContact(email)) return false;
  const consent = await interlinkedDatabase().query(`
    select 1 from public.editorial_readers r where r.email = $1 and ${currentConsent}
  `, [email]);
  if (!consent.rowCount) return false;
  const suppression = await interlinkedDatabase().query(`
    select 1 from public.omni_suppressions
    where lower(btrim(email)) = $1 and (business_id is null or business_id = $2)
    limit 1
  `, [email, omniBusinessId]);
  return suppression.rowCount === 0;
}

async function sendEmail(payload: string, day: string, reader: string) {
  if (!process.env.RESEND_API_KEY) throw new Error("Resend is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(7000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json",
      "Idempotency-Key": `interlinked-reader/${day}/${reader}`,
    },
    body: payload,
  });
  if (!response.ok) throw new Error(`resend_${response.status}`);
  const receipt = await response.json() as { id?: unknown };
  if (typeof receipt.id !== "string" || !receipt.id) throw new Error("resend_receipt_missing");
  return receipt.id;
}

export async function deliverInterlinkedToReaders(now = new Date()) {
  const currentDay = now.toISOString().slice(0, 10);
  const previousDay = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  if (process.env.VERCEL_ENV !== "production") throw new Error("Reader delivery is disabled outside production");
  if (!process.env.RESEND_API_KEY) throw new Error("Resend is not configured");
  const db = interlinkedDatabase();
  const { rows: [issue] } = await db.query<Issue>(`
    select premium.id, premium.slug, premium.subject, premium.intro, premium.insights,
           premium.power_move, premium.published_at, free.slug as free_slug
    from public.newsletter_posts premium
    join public.newsletter_posts free
      on free.slug = replace(premium.slug, 'interlinked-premium-', 'interlinked-free-')
      and free.status = 'published' and free.published_at is not null
    where premium.slug = any($1::text[]) and premium.status = 'published'
      and premium.published_at between $2::timestamptz - interval '23 hours' and $2::timestamptz
      and premium.keywords @> '["AIS Interlinked"]'::jsonb
    order by premium.published_at desc limit 1
  `, [[currentDay, previousDay].map(day => `interlinked-premium-${day}`), now.toISOString()]);
  if (!issue) return { day: currentDay, accepted: 0, skipped: 0, retry: 0, pending: 0, noIssue: true };
  const day = issue.slug.slice(-10);
  const publicPage = await fetch(interlinkedIssueUrl(issue.free_slug), {
    method: "HEAD", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
  });
  if (!publicPage.ok) throw new Error("Interlinked issue is not reachable");

  await db.query(`
    insert into public.interlinked_reader_deliveries(issue_day, reader_id, post_id)
    select $1, r.id, $2 from public.editorial_readers r
    where r.completed_at <= $3 and ${currentConsent}
    on conflict (issue_day, reader_id) do nothing
  `, [day, issue.id, issue.published_at]);
  // Resend's replay protection lasts 24 hours. Never retry an uncertain request beyond that window.
  await db.query(`
    update public.interlinked_reader_deliveries
      set status = 'review', reason = 'expired_provider_window', lease_id = null, payload = null
    where first_attempt_at < now() - interval '23 hours' and status in ('sending', 'retry')
  `);
  const leaseId = randomUUID();
  const { rows: jobs } = await db.query<Job>(`
    with queue as (
      select d.reader_id from public.interlinked_reader_deliveries d
      where d.issue_day = $1 and d.post_id = $2 and d.status in ('pending', 'sending', 'retry')
        and (d.attempted_at is null or d.attempted_at < now() - interval '10 minutes')
      order by d.attempted_at nulls first, d.reader_id
      limit 24 for update skip locked
    )
    update public.interlinked_reader_deliveries d
    set status = 'sending', first_attempt_at = coalesce(d.first_attempt_at, now()),
        attempted_at = now(), lease_id = $3, reason = null
    from queue, public.editorial_readers r
    where d.issue_day = $1 and d.reader_id = queue.reader_id and d.reader_id = r.id
    returning d.reader_id, r.email, d.payload
  `, [day, issue.id, leaseId]);

  let accepted = 0;
  let skipped = 0;
  let retry = 0;
  for (const job of jobs) {
    const key = [day, job.reader_id, leaseId];
    try {
      if (!await authorizedForDelivery(job.email)) {
        await db.query(`
          update public.interlinked_reader_deliveries set status = 'skipped', reason = 'consent_or_suppression',
            lease_id = null, payload = null where issue_day = $1 and reader_id = $2 and lease_id = $3
        `, key);
        skipped++;
        continue;
      }
      const payload = job.payload ?? JSON.stringify(emailPayload(issue, job.email, job.reader_id));
      if (!job.payload) {
        const stored = await db.query(`
          update public.interlinked_reader_deliveries set payload = $4
          where issue_day = $1 and reader_id = $2 and lease_id = $3
        `, [...key, payload]);
        if (!stored.rowCount) throw new Error("delivery_lease_expired");
      }
      const receipt = await sendEmail(payload, day, job.reader_id).finally(() => delay(350));
      const settled = await db.query(`
        update public.interlinked_reader_deliveries set status = 'accepted', provider_id = $4, accepted_at = now(),
          lease_id = null, payload = null where issue_day = $1 and reader_id = $2 and lease_id = $3
      `, [...key, receipt]);
      if (!settled.rowCount) throw new Error("delivery_receipt_unrecorded");
      accepted++;
    } catch (error) {
      const reason = error instanceof Error && /^resend_(?:\d{3}|receipt_missing)$/.test(error.message)
        ? error.message : "read_or_transport_failed";
      await db.query(`
        update public.interlinked_reader_deliveries set status = 'retry', reason = $4, lease_id = null
        where issue_day = $1 and reader_id = $2 and lease_id = $3
      `, [...key, reason]);
      retry++;
    }
  }

  // Report accepted provider receipts only. Failed or leased rows remain repairable.
  const { rows: [queue] } = await db.query<{ pending: number }>(`
    select count(*)::int as pending from public.interlinked_reader_deliveries
    where issue_day = $1 and status in ('pending', 'sending', 'retry')
  `, [day]);
  return { day, accepted, skipped, retry, pending: queue.pending, noIssue: false };
}
