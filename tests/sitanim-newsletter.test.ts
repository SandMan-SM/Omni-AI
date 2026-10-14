import assert from "node:assert/strict";
import { test } from "node:test";
import { authenticateSitanim, isSitanimLocalRequest, deliverSitanimMessages, SitanimSignupError, signSitanimState, verifySitanimState, type DeliveryState } from "../lib/server/sitanim-newsletter-policy";

const secret = "unit-test-sitanim-only-secret-not-runtime";
const env = { NODE_ENV: "development", SITANIM_LOCAL_BRIDGE: "1", SITANIM_LOCAL_SECRET: secret };
const req = (url = "http://127.0.0.1:3132/api/inbound/sitanim/newsletter", value = secret) => new Request(url, { headers: { "x-sitanim-local-secret": value } });

test("local bridge requires development, explicit marker, loopback and matching long secret", () => {
  assert.equal(isSitanimLocalRequest(req(), env), true);
  assert.equal(isSitanimLocalRequest(req(), { ...env, NODE_ENV: "production" }), false);
  assert.equal(isSitanimLocalRequest(req(), { ...env, SITANIM_LOCAL_BRIDGE: "0" }), false);
  assert.equal(isSitanimLocalRequest(req(), { ...env, SITANIM_LOCAL_SECRET: "short" }), false);
  assert.equal(isSitanimLocalRequest(req(undefined, "wrong"), env), false);
  assert.equal(isSitanimLocalRequest(req("https://omnileadsagi.com/api/inbound/sitanim/newsletter"), env), false);
});

test("unverified OIDC claims cannot authorize Sitani", async () => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", kid: "unit-test" })}.${encode({ project_id: "prj_smIaIxycXxT64cnJ2RlCo6r1dEar" })}.invalid`;
  assert.equal(await authenticateSitanim(new Request("https://omnileadsagi.com/api/inbound/sitanim/newsletter", { headers: { Authorization: `Bearer ${token}` } })), false);
});

test("workflow signatures survive JSONB key ordering and bind server state to row and email", () => {
  const original = { email: "unit@invalid.example", leadId: "unit-row", nested: { b: 2, a: 1 }, version: 1 };
  const signature = signSitanimState(original, secret);
  const roundtrip = { version: 1, nested: { a: 1, b: 2 }, leadId: "unit-row", email: "unit@invalid.example", signature };
  assert.equal(verifySitanimState(roundtrip, secret, original.email, original.leadId), true);
  assert.equal(verifySitanimState({ ...roundtrip, version: 2 }, secret, original.email, original.leadId), false);
  assert.equal(verifySitanimState(roundtrip, secret, "different@invalid.example", original.leadId), false);
  assert.equal(verifySitanimState(roundtrip, secret, original.email, "other-row"), false);
  assert.equal(verifySitanimState({ ...roundtrip, signature: "invalid" }, secret, original.email, original.leadId), false);
});

function state(): DeliveryState {
  const payload = { from: "test@invalid.example", to: ["unit@invalid.example"], subject: "unit", html: "unit", text: "unit" };
  return { welcome: { status: "pending", key: "stable-welcome", payload }, owner: { status: "pending", key: "stable-owner", payload } };
}

test("both intents and both accepted receipts are persisted before success", async () => {
  const s = state(), events: string[] = [];
  await deliverSitanimMessages(s, {
    checkSuppression: async () => { events.push("check"); },
    persist: async () => { events.push(`persist:${s.welcome.status}:${s.owner.status}`); },
    send: async (message) => { events.push(`send:${message.key}`); return { id: `${message.key}-id` }; },
  });
  assert.deepEqual(events, ["check", "persist:sending:pending", "send:stable-welcome", "persist:accepted:pending", "check", "persist:accepted:sending", "send:stable-owner", "persist:accepted:accepted"]);
  assert.equal(s.welcome.providerId, "stable-welcome-id"); assert.equal(s.owner.providerId, "stable-owner-id");
});

test("repeat signup with accepted receipts sends no duplicate messages", async () => {
  const s = state();
  s.welcome.status = s.owner.status = "accepted";
  s.welcome.providerId = "welcome-id"; s.owner.providerId = "owner-id";
  await deliverSitanimMessages(s, {
    checkSuppression: async () => { throw new Error("not needed for accepted channel"); },
    persist: async () => { throw new Error("not needed for accepted channel"); },
    send: async () => { throw new Error("duplicate send"); },
  });
});

test("owner rejection fails closed, keeps welcome receipt and stable retry key", async () => {
  const s = state(); let persisted = 0;
  await assert.rejects(deliverSitanimMessages(s, {
    checkSuppression: async () => {}, persist: async () => { persisted++; },
    send: async (message) => { if (message.key === "stable-owner") throw new SitanimSignupError("resend_422"); return { id: "welcome-id" }; },
  }), (error: unknown) => error instanceof SitanimSignupError && error.code === "owner_notification_failed");
  assert.equal(s.welcome.providerId, "welcome-id"); assert.equal(s.owner.status, "unknown"); assert.equal(persisted, 4);
  const retried: string[] = [];
  await deliverSitanimMessages(s, {
    checkSuppression: async () => {}, persist: async () => {},
    send: async (message) => { retried.push(message.key); return { id: "owner-id" }; },
  });
  assert.deepEqual(retried, ["stable-owner"]);
});

test("suppression lookup errors fail closed before any send", async () => {
  const s = state(); let sent = 0;
  await assert.rejects(deliverSitanimMessages(s, {
    checkSuppression: async () => { throw new SitanimSignupError("suppression_lookup_failed"); },
    persist: async () => {}, send: async () => { sent++; return { id: "unexpected" }; },
  }), /suppression_lookup_failed/);
  assert.equal(sent, 0); assert.equal(s.welcome.status, "pending");
});

test("protected or global suppression cannot become silent success", async () => {
  await assert.rejects(deliverSitanimMessages(state(), {
    checkSuppression: async () => { throw new SitanimSignupError("subscription_suppressed", 409, false); },
    persist: async () => {}, send: async () => { throw new Error("must not send"); },
  }), (error: unknown) => error instanceof SitanimSignupError && error.status === 409 && !error.retryable);
});

test("intent persistence failure prevents sending", async () => {
  let sent = 0;
  await assert.rejects(deliverSitanimMessages(state(), {
    checkSuppression: async () => {}, persist: async () => { throw new Error("storage failed"); },
    send: async () => { sent++; return { id: "unexpected" }; },
  }), /storage failed/);
  assert.equal(sent, 0);
});

test("provider acceptance followed by DB error preserves receipt and fails closed", async () => {
  const s = state(); let persisted = 0;
  await assert.rejects(deliverSitanimMessages(s, {
    checkSuppression: async () => {}, persist: async () => { if (++persisted === 2) throw new Error("storage failed"); },
    send: async () => ({ id: "known-receipt" }),
  }), /welcome_notification_failed/);
  assert.equal(s.welcome.providerId, "known-receipt"); assert.equal(s.welcome.status, "accepted");
  assert.equal(s.owner.status, "pending");
});

test("ambiguous receipt beyond provider idempotency window requires reconciliation", async () => {
  const s = state(); s.welcome.firstAttemptAt = "2026-09-25T00:00:00.000Z"; s.welcome.status = "unknown";
  await assert.rejects(deliverSitanimMessages(s, {
    now: () => new Date("2026-09-27T00:00:00.000Z"), checkSuppression: async () => {}, persist: async () => {},
    send: async () => { throw new Error("must not duplicate old send"); },
  }), (error: unknown) => error instanceof SitanimSignupError && error.code === "welcome_receipt_reconciliation_required" && !error.retryable);
});

test("actual receiver auth and validation precede DB; honeypot only reads readiness", async () => {
  const priorEnv = { NODE_ENV: process.env.NODE_ENV, SITANIM_LOCAL_BRIDGE: process.env.SITANIM_LOCAL_BRIDGE,
    SITANIM_LOCAL_SECRET: process.env.SITANIM_LOCAL_SECRET, POSTGRES_URL: process.env.POSTGRES_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY, OMNI_UNSUB_SECRET: process.env.OMNI_UNSUB_SECRET };
  Object.assign(process.env, env, { POSTGRES_URL: "postgresql://unit.invalid/unused", RESEND_API_KEY: "unit-no-network", OMNI_UNSUB_SECRET: secret });
  const previousPool = globalThis.__sitanimNewsletterPool;
  const previousFetch = globalThis.fetch;
  const queries: string[] = [];
  const client = { query: async (sql: string) => { queries.push(sql); return { rows: sql.includes("join analytics.tenants") ? [{ id: "unit-business" }] : [], rowCount: 0 }; }, release: () => {} };
  globalThis.__sitanimNewsletterPool = { connect: async () => client } as unknown as NonNullable<typeof previousPool>;
  globalThis.fetch = async () => { throw new Error("Provider/network effects are forbidden in this test"); };
  try {
    const { sitanimNewsletterPost, sitanimNewsletterHealth } = await import("../lib/server/sitanim-newsletter");
    const post = (body: unknown, authenticated = true) => sitanimNewsletterPost(new Request("http://127.0.0.1:3132/api/inbound/sitanim/newsletter", {
      method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { "x-sitanim-local-secret": secret } : {}) }, body: JSON.stringify(body),
    }));
    assert.equal((await post({ email: "unit@invalid.example" }, false)).status, 401);
    assert.equal((await post({ email: "invalid" })).status, 422);
    assert.equal((await post(null)).status, 422);
    assert.equal(queries.length, 0);
    const smoke = await post({ email: "unit@invalid.example", website: "safe-smoke" });
    assert.equal(smoke.status, 200);
    assert.deepEqual(await smoke.json(), { ok: true, smoke: true, no_write: true, workflow_complete: false });
    assert.ok(queries.length >= 6);
    assert.ok(queries.every((sql) => /^select\s/i.test(sql)));
    const health = await sitanimNewsletterHealth(req());
    assert.equal(health.status, 200); assert.equal((await health.json()).no_write, true);
  } finally {
    globalThis.__sitanimNewsletterPool = previousPool;
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries(priorEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
