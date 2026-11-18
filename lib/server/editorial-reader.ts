import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { ixPostgresConfig } from "./ix-postgres-config";
import { isRetiredFederationContact } from "./federation-contact-retirement";
import { FEDERATION_OPERATOR_EMAIL } from "@/lib/federation-newsletter-briefs";
import { editorialUnsubscribeUrl } from "./editorial-unsubscribe";

let pool: Pool | undefined;
const connection = () =>
  (pool ??= new Pool({
    ...ixPostgresConfig(
      process.env.POSTGRES_URL || process.env.DATABASE_URL || "",
    ),
    max: 3,
    connectionTimeoutMillis: 6000,
    statement_timeout: 10000,
  }));
const businessId = "146f6f87-6ed7-4c21-a0e3-fac2c91c2748";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class ReaderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function transaction<T>(work: (db: PoolClient) => Promise<T>) {
  const db = await connection().connect();
  try {
    await db.query("begin");
    const result = await work(db);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
}
async function available(email: string, transactional = false) {
  if (isRetiredFederationContact(email))
    throw new ReaderError(
      "Email delivery is unavailable for this address.",
      422,
    );
  const suppressed = await connection().query(
    "select 1 from public.omni_suppressions where lower(trim(email))=$1 and (business_id is null or business_id=$2) and (not $3::boolean or coalesce(reason,'') <> 'unsubscribe') limit 1",
    [email, businessId, transactional],
  );
  if (suppressed.rowCount)
    throw new ReaderError(
      "Email delivery is unavailable for this address.",
      422,
    );
}
async function mail(to: string, subject: string, text: string, key: string) {
  await available(to, key.startsWith("reader-code-"));
  const localInbox =
    process.env.NODE_ENV === "development" &&
    process.env.EDITORIAL_LOCAL_MAIL === "loopback";
  const endpoint = localInbox
    ? "http://127.0.0.1:14326/emails"
    : "https://api.resend.com/emails";
  const result = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: localInbox
        ? "Bearer local-test"
        : "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from: "Interlinked <newsletter@omnios.news>",
      to: [to],
      subject,
      text,
    }),
  });
  if (!result.ok)
    throw new ReaderError(
      "Email delivery is temporarily unavailable. Please try again.",
      503,
    );
  const data = await result.json();
  if (typeof data.id !== "string" || !data.id)
    throw new ReaderError("Email delivery could not be confirmed.", 503);
  return data.id as string;
}
function codeHash(id: string, code: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Reader verification unavailable");
  return hash(["editorial-code", secret, id, code].join("|"));
}
export async function requestCode(email: string, ip: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new ReaderError("Enter a valid email address.", 400);
  await available(email, true);
  const challenge = randomUUID(),
    code = String(randomInt(1000000)).padStart(6, "0"),
    ipHash = hash(ip);
  await transaction(async (db) => {
    await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "reader-ip:" + ipHash,
    ]);
    await db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "reader-email:" + email,
    ]);
    await db.query(
      "delete from public.editorial_reader_codes where issued_at < now()-interval '1 day'",
    );
    await db.query(
      "delete from public.editorial_reader_sessions where expires_at <= now()",
    );
    const prior = await db.query(
      "select 1 from public.editorial_reader_codes where email=$1 and issued_at>now()-interval '60 seconds'",
      [email],
    );
    const byIp = await db.query(
      "select count(*)::int as n from public.editorial_reader_codes where ip_hash=$1 and issued_at>now()-interval '10 minutes'",
      [ipHash],
    );
    if (prior.rowCount || byIp.rows[0].n >= 10)
      throw new ReaderError(
        "Wait a minute before asking for another code.",
        429,
      );
    await db.query(
      "insert into public.editorial_reader_codes (email,challenge,code_hash,ip_hash) values($1,$2,$3,$4) on conflict(email) do update set challenge=excluded.challenge,code_hash=excluded.code_hash,ip_hash=excluded.ip_hash,attempts=0,accepted=false,issued_at=now()",
      [email, challenge, codeHash(challenge, code), ipHash],
    );
  });
  await mail(
    email,
    "Your Interlinked sign-in code",
    code +
      " is your sign-in code. It expires in 10 minutes. If you did not request this code, you can ignore this email.",
    "reader-code-" + challenge,
  );
  await connection().query(
    "update public.editorial_reader_codes set accepted=true where challenge=$1",
    [challenge],
  );
  return challenge;
}
export async function verifyCode(challenge: string, code: string) {
  if (
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(challenge) ||
    !/^\d{6}$/.test(code)
  )
    throw new ReaderError("Enter the six digits from your latest email.", 400);
  const token = randomBytes(32).toString("hex");
  const success = await transaction(async (db) => {
    const row = (
      await db.query(
        "update public.editorial_reader_codes set attempts=attempts+1 where challenge=$1 and accepted and attempts<5 and issued_at>now()-interval '10 minutes' returning email,code_hash",
        [challenge],
      )
    ).rows[0];
    if (!row || row.code_hash !== codeHash(challenge, code)) return false;
    await db.query(
      "delete from public.editorial_reader_codes where challenge=$1",
      [challenge],
    );
    await db.query(
      "insert into public.editorial_reader_sessions values ($1,$2,now()+interval '30 days')",
      [hash(token), row.email],
    );
    return true;
  });
  if (!success)
    throw new ReaderError(
      "That code is incorrect or expired. Request a new code if needed.",
      400,
    );
  return token;
}
export async function reader(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await connection().query(
    "select s.email,r.completed_at is not null as complete, coalesce(n.subscription_tier='premium',false) as premium from public.editorial_reader_sessions s left join public.editorial_readers r using(email) left join public.newsletter_subscriptions n on n.email=s.email where s.token_hash=$1 and s.expires_at>now()",
    [hash(token)],
  );
  return rows[0] as
    | { email: string; complete: boolean; premium: boolean }
    | undefined;
}
export async function signOut(token: string) {
  await connection().query(
    "delete from public.editorial_reader_sessions where token_hash=$1",
    [hash(token)],
  );
}
async function enrollmentMessage(
  readerId: string,
  stage: "welcome" | "owner",
  recipient: string,
  subject: string,
  content: string,
) {
  // Column names are selected exclusively from the two internal stages.
  const started = stage + "_started_at";
  const receipt = stage + "_receipt";
  const {
    rows: [attempt],
  } = await connection().query(
    `update public.editorial_readers set ${started}=coalesce(${started},now()) where id=$1 and ${receipt} is null returning ${started} > now() - interval '23 hours' as replayable`,
    [readerId],
  );
  if (!attempt) return;
  if (!attempt.replayable)
    throw new ReaderError(
      "Your request is saved. Delivery needs to be reconciled before another email can be sent.",
      503,
    );
  try {
    const id = await mail(
      recipient,
      subject,
      content,
      "reader-" + stage + "-" + readerId,
    );
    await connection().query(
      `update public.editorial_readers set ${receipt}=$2,delivery_error=null where id=$1`,
      [readerId, id],
    );
  } catch (error) {
    await connection().query(
      "update public.editorial_readers set delivery_error=$2 where id=$1 and completed_at is null",
      [readerId, stage + "_unconfirmed"],
    );
    throw error;
  }
}
export async function enroll(
  email: string,
  fullName: string,
  phone: string,
  source: string,
) {
  if (
    fullName.length < 2 ||
    fullName.length > 120 ||
    !/^\+?[0-9 ()\.\-]{7,25}$/.test(phone) ||
    !/^\d{7,15}$/.test(phone.replace(/\D/g, ""))
  )
    throw new ReaderError("Check your full name and phone number.", 400);
  await available(email);
  const {
    rows: [profile],
  } = await connection().query(
    "insert into public.editorial_readers(email,full_name,phone,source) values($1,$2,$3,$4) on conflict(email) do update set email=excluded.email returning *",
    [email, fullName, phone, source],
  );
  if (profile.completed_at) return;
  await enrollmentMessage(
    profile.id,
    "welcome",
    email,
    "Welcome to Interlinked",
    "Thanks for requesting the daily Interlinked newsletter. Read the latest AI briefing at https://omnileadsagi.com/newsletter. Unsubscribe anytime: " +
      editorialUnsubscribeUrl(profile.id),
  );
  await enrollmentMessage(
    profile.id,
    "owner",
    FEDERATION_OPERATOR_EMAIL,
    "New Interlinked reader",
    "A verified reader requested enrollment through " +
      profile.source +
      ". Reader reference " +
      profile.id +
      ".",
  );
  await transaction(async (db) => {
    const locked = (
      await db.query(
        "select * from public.editorial_readers where email=$1 for update",
        [email],
      )
    ).rows[0];
    if (locked.completed_at) return;
    if (locked.unsubscribed_at)
      throw new ReaderError(
        "Your email preference is set to unsubscribed.",
        409,
      );
    if (!locked.welcome_receipt || !locked.owner_receipt)
      throw new Error("Pending notification");
    await db.query(
      "insert into public.newsletter_subscriptions(email,first_name,subscribed,subscription_tier) values($1,$2,true,'subscribed') on conflict(email) do update set subscribed=true,first_name=excluded.first_name,subscription_tier=case when newsletter_subscriptions.subscription_tier='premium' then 'premium' else 'subscribed' end",
      [email, locked.full_name.split(" ")[0]],
    );
    await db.query(
      "insert into public.federation_newsletter_subscribers(site,email,first_name,phone,source) values('omni',$1,$2,$3,$4) on conflict(site,email) do update set first_name=excluded.first_name,phone=excluded.phone,source=excluded.source,unsubscribed=false,unsubscribed_at=null,subscription_state='active',last_subscribed_at=now()",
      [email, locked.full_name.split(" ")[0], locked.phone, locked.source],
    );
    const [first, ...rest] = locked.full_name.split(/\s+/);
    const identity = [
      businessId,
      email,
      first,
      rest.join(" "),
      locked.phone,
      locked.id,
    ];
    const findContact = () =>
      db.query(
        "select id from public.omni_leads_generated where business_id=$1 and (lower(btrim(email))=$2 or (source_table='editorial_readers' and source_record_id=$3)) order by (source_table='editorial_readers' and source_record_id=$3) desc nulls last limit 1 for update",
        [businessId, email, locked.id],
      );
    let contact = (await findContact()).rows[0];
    if (!contact) {
      contact =
        (
          await db.query(
            "insert into public.omni_leads_generated(business_id,email,first_name,last_name,phone,source_table,source_record_id,source,status,pipeline_type) values($1,$2,$3,$4,$5,'editorial_readers',$6,'web','new','inbound') on conflict do nothing returning id",
            identity,
          )
        ).rows[0] || (await findContact()).rows[0];
    }
    if (!contact) throw new Error("Reader contact mirror unavailable");
    await db.query(
      "update public.omni_leads_generated set first_name=$2,last_name=$3,phone=$4 where id=$1",
      [contact.id, first, rest.join(" "), locked.phone],
    );
    await db.query(
      "update public.editorial_readers set completed_at=now() where email=$1",
      [email],
    );
  });
}

export async function stopReaderMail(id: string) {
  await transaction(async (db) => {
    const { rows } = await db.query(
      "update public.editorial_readers set unsubscribed_at=coalesce(unsubscribed_at,now()) where id=$1 returning email,source",
      [id],
    );
    if (!rows[0]) return;
    await db.query(
      "update public.federation_newsletter_subscribers set unsubscribed=true,unsubscribed_at=coalesce(unsubscribed_at,now()),subscription_state='unsubscribed' where site='omni' and email=$1 and source=$2",
      [rows[0].email, rows[0].source],
    );
  });
}
