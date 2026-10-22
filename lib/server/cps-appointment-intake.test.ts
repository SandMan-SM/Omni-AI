import assert from "node:assert/strict";
import { generateKeyPairSync, sign, type JsonWebKey } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  cpsAppointmentPayloadFingerprint,
  cpsAppointmentReplayMatches,
  handleCpsAppointmentPost,
  isLoopbackDevelopmentRequest,
  resolveCpsAppointmentOwnerRecipients,
  shouldRefreshCpsSuppression,
  validateCpsAppointmentPayload,
} from "./cps-appointment-intake";
import { INBOUND_ORIGINS } from "../inbound-types";
import { cpsPostgresConfig } from "./cps-postgres-config";

const VALID_SUBMISSION_ID = "6f02ab44-d7d0-4fc5-bac7-74e11a413355";
const VALID_CONSENT = {
  consent: true,
  consent_version: "cps-contact-consent-v2",
  consent_recorded_at: "2026-07-22T12:00:00.000Z",
};

test('CPS production database TLS cannot be weakened by URL or local flags', () => {
  const config = cpsPostgresConfig('postgresql://fixture:fixture@db.example.test/fixture?sslmode=disable&uselibpqcompat=true', { NODE_ENV: 'production' });
  assert.equal(config.connectionString, undefined);
  assert.equal((config.ssl as { rejectUnauthorized: boolean }).rejectUnauthorized, true);
  assert.equal(cpsPostgresConfig('postgresql://fixture:fixture@127.0.0.1/fixture', { NODE_ENV: 'development' }).ssl, false);
  assert.equal((cpsPostgresConfig('postgresql://fixture:fixture@127.0.0.1/fixture', { NODE_ENV: 'production' }).ssl as { rejectUnauthorized: boolean }).rejectUnauthorized, true);
  const sharedCa = cpsPostgresConfig('postgresql://fixture:fixture@db.example.test/fixture', { NODE_ENV: 'production', IX_DATABASE_CA_CERT: 'shared-project-ca' });
  assert.deepEqual(sharedCa.ssl, { rejectUnauthorized: true, ca: 'shared-project-ca' });
  const dedicatedCa = cpsPostgresConfig('postgresql://fixture:fixture@db.example.test/fixture', { NODE_ENV: 'production', CPS_DATABASE_CA_CERT: 'dedicated-ca', IX_DATABASE_CA_CERT: 'shared-project-ca' });
  assert.deepEqual(dedicatedCa.ssl, { rejectUnauthorized: true, ca: 'dedicated-ca' });
});

test('CPS appointment mail is restricted to a verified sender and email-only provider', () => {
  const source = readFileSync(new URL('./cps-appointment-intake.ts', import.meta.url), 'utf8');
  assert.match(source, /Clinical and Professional Solutions <solutions@omnios\.news>/);
  assert.doesNotMatch(source, /bookings@omnileadsagi\.com|twilio|tel:|sms:/i);
});

test('retired CPS writers return 410 before any database or provider effects', async () => {
  const { POST: legacy } = await import('@/app/api/cps/leads/route');
  const { POST: generic } = await import('@/app/api/inbound/[slug]/leads/route');
  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = async () => { externalCalls += 1; throw new Error('retired writer must not call external services'); };
  try {
    const retired = await legacy();
    assert.equal(retired.status, 410);
    assert.equal((await retired.json()).code, 'cps_legacy_intake_retired');
    const retiredGeneric = await generic(new Request('https://omnileadsagi.com/api/inbound/cps/leads', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }), { params: Promise.resolve({ slug: 'cps' }) });
    assert.equal(retiredGeneric.status, 410);
    assert.equal((await retiredGeneric.json()).code, 'cps_legacy_intake_retired');
    assert.equal(externalCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("casts CPS appointment JSON object keys explicitly", () => {
  const source = readFileSync(
    new URL("./cps-appointment-intake.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /jsonb_build_object\(\$5::text, \$6::jsonb\)/);
  assert.match(source, /jsonb_build_object\(\$6::text, \$7::jsonb\)/);
  assert.match(source, /last_attempt_at'[\s\S]+IS NOT DISTINCT FROM \$6::text/);
  assert.match(source, /IN \('accepted', 'delivery_unknown', 'suppressed'\)/);
});

test("validates and normalizes a CPS appointment payload", () => {
  const payload = validateCpsAppointmentPayload({
    submission_id: VALID_SUBMISSION_ID.toUpperCase(),
    name: "  Jane   Example  ",
    email: " JANE@EXAMPLE.COM ",
    phone: "(801) 555-0100",
    ...VALID_CONSENT,
  });

  assert.equal(payload.submissionId, VALID_SUBMISSION_ID);
  assert.equal(payload.name, "Jane Example");
  assert.equal(payload.email, "jane@example.com");
  assert.equal(payload.serviceInterest, "General solutions request");
  assert.equal(payload.location, "No preference");
});

test("rejects a missing stable submission id", () => {
  assert.throws(() =>
    validateCpsAppointmentPayload({
      name: "Jane Example",
      email: "jane@example.com",
      phone: "8015550100",
      ...VALID_CONSENT,
    }),
  );
});

test("binds a submission id to one normalized payload", () => {
  const original = validateCpsAppointmentPayload({
    submission_id: VALID_SUBMISSION_ID,
    name: "Jane Example",
    email: "jane@example.com",
    phone: "801-555-0100",
    ...VALID_CONSENT,
  });
  const storedFingerprint = cpsAppointmentPayloadFingerprint(original);
  const equivalent = validateCpsAppointmentPayload({
    submission_id: VALID_SUBMISSION_ID.toUpperCase(),
    name: "  Jane   Example ",
    email: " JANE@EXAMPLE.COM ",
    phone: "801-555-0100",
    ...VALID_CONSENT,
  });
  const changed = validateCpsAppointmentPayload({
    submission_id: VALID_SUBMISSION_ID,
    name: "Jane Example",
    email: "jane@example.com",
    phone: "801-555-0199",
    ...VALID_CONSENT,
  });

  assert.equal(
    cpsAppointmentReplayMatches(equivalent, storedFingerprint),
    true,
  );
  assert.equal(cpsAppointmentReplayMatches(changed, storedFingerprint), false);
  assert.equal(cpsAppointmentReplayMatches(original, undefined), false);
});

test("requires the exact consent version and a valid recorded timestamp", () => {
  const base = {
    submission_id: VALID_SUBMISSION_ID,
    name: "Jane Example",
    email: "jane@example.com",
    phone: "801-555-0100",
    ...VALID_CONSENT,
  };

  assert.throws(() =>
    validateCpsAppointmentPayload({ ...base, consent_version: "legacy" }),
  );
  assert.throws(() =>
    validateCpsAppointmentPayload({ ...base, consent_recorded_at: "not-a-date" }),
  );
});

test("fixes appointment owner delivery and replies to the authorized CPS inbox", () => {
  assert.deepEqual(resolveCpsAppointmentOwnerRecipients(), {
    recipients: ["sitanim8@gmail.com"],
    replyTo: "sitanim8@gmail.com",
  });

  const source = readFileSync(
    new URL("./cps-appointment-intake.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /Clinical and Professional Solutions/);
  assert.match(source, /#A1252B/);
  assert.match(source, /#7F1C22/);
  assert.doesNotMatch(source, /Comprehensive Psychological Services/);
  assert.doesNotMatch(
    source,
    /CPS_APPOINTMENT_(?:OWNER_EMAIL|ADDITIONAL_OWNER_EMAILS|FROM)/,
  );
  assert.match(source, /New CPS solutions request/);
  assert.match(source, /possible next steps/);
});

test("limits generic CPS intake CORS to the rebranded production domains", () => {
  assert.deepEqual(INBOUND_ORIGINS.cps, [
    "https://cpsutah.org",
    "https://www.cpsutah.org",
  ]);
});

test("refreshes cached clear suppression until customer email is accepted", () => {
  const pendingCustomer = {
    status: "retryable_failed" as const,
    idempotency_key: "cps-appointment-customer-test",
    attempts: 1,
    provider_id: null,
    last_error: "resend_timeout",
    last_attempt_at: new Date().toISOString(),
    accepted_at: null,
  };
  const cachedClear = {
    status: "clear" as const,
    checked_at: new Date().toISOString(),
    last_error: null,
  };
  const acceptedCustomer = {
    ...pendingCustomer,
    status: "accepted" as const,
    provider_id: "resend-message-id",
    last_error: null,
    accepted_at: new Date().toISOString(),
  };

  assert.equal(shouldRefreshCpsSuppression(pendingCustomer, cachedClear), true);
  assert.equal(
    shouldRefreshCpsSuppression(acceptedCustomer, cachedClear),
    false,
  );
  assert.equal(
    shouldRefreshCpsSuppression(pendingCustomer, {
      ...cachedClear,
      status: "suppressed",
    }),
    false,
  );
});

test("dev bypass requires development, loopback, and the configured secret", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  const previousSecret = mutableEnv.CPS_LOCAL_SOURCE_SECRET;
  mutableEnv.NODE_ENV = "development";
  mutableEnv.CPS_LOCAL_SOURCE_SECRET = "random-local-secret";

  try {
    assert.equal(
      isLoopbackDevelopmentRequest(
        new Request("http://127.0.0.1:3002/api/inbound/cps/appointments", {
          headers: { "x-cps-local-source": "random-local-secret" },
        }),
      ),
      true,
    );
    assert.equal(
      isLoopbackDevelopmentRequest(
        new Request("https://omnileadsagi.com/api/inbound/cps/appointments", {
          headers: { "x-cps-local-source": "random-local-secret" },
        }),
      ),
      false,
    );
    assert.equal(
      isLoopbackDevelopmentRequest(
        new Request("http://localhost:3002/api/inbound/cps/appointments", {
          headers: { "x-cps-local-source": "wrong-secret" },
        }),
      ),
      false,
    );
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;

    if (previousSecret === undefined) delete mutableEnv.CPS_LOCAL_SOURCE_SECRET;
    else mutableEnv.CPS_LOCAL_SOURCE_SECRET = previousSecret;
  }
});

test("authenticated honeypot is a no-write completion", async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  const previousSecret = mutableEnv.CPS_LOCAL_SOURCE_SECRET;
  mutableEnv.NODE_ENV = "development";
  mutableEnv.CPS_LOCAL_SOURCE_SECRET = "random-local-secret";

  try {
    const response = await handleCpsAppointmentPost(
      new Request("http://127.0.0.1:3002/api/inbound/cps/appointments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cps-local-source": "random-local-secret",
        },
        body: JSON.stringify({ website: "bot-value" }),
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      completion: "no_write",
    });

    const unauthorized = await handleCpsAppointmentPost(
      new Request("http://127.0.0.1:3002/api/inbound/cps/appointments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cps-local-source": "wrong-secret",
        },
        body: JSON.stringify({ website: "bot-value" }),
      }),
    );
    assert.equal(unauthorized.status, 401);
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;

    if (previousSecret === undefined) delete mutableEnv.CPS_LOCAL_SOURCE_SECRET;
    else mutableEnv.CPS_LOCAL_SOURCE_SECRET = previousSecret;
  }
});

test("appointment receiver rejects non-JSON and oversized bodies before writes", async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  const previousSecret = mutableEnv.CPS_LOCAL_SOURCE_SECRET;
  mutableEnv.NODE_ENV = "development";
  mutableEnv.CPS_LOCAL_SOURCE_SECRET = "random-local-secret";

  try {
    const unsupported = await handleCpsAppointmentPost(
      new Request("http://127.0.0.1:3002/api/inbound/cps/appointments", {
        method: "POST",
        headers: { "x-cps-local-source": "random-local-secret" },
        body: "plain text",
      }),
    );
    assert.equal(unsupported.status, 415);

    const oversized = await handleCpsAppointmentPost(
      new Request("http://127.0.0.1:3002/api/inbound/cps/appointments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(33 * 1024),
          "x-cps-local-source": "random-local-secret",
        },
        body: JSON.stringify({ website: "bot-value" }),
      }),
    );
    assert.equal(oversized.status, 413);
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
    if (previousSecret === undefined) delete mutableEnv.CPS_LOCAL_SOURCE_SECRET;
    else mutableEnv.CPS_LOCAL_SOURCE_SECRET = previousSecret;
  }
});

test("local no-write mode rejects real submissions before database access", async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  const previousSecret = mutableEnv.CPS_LOCAL_SOURCE_SECRET;
  const previousNoWrite = mutableEnv.CPS_LOCAL_NO_WRITE_ONLY;
  mutableEnv.NODE_ENV = "development";
  mutableEnv.CPS_LOCAL_SOURCE_SECRET = "random-local-secret";
  mutableEnv.CPS_LOCAL_NO_WRITE_ONLY = "1";

  try {
    const response = await handleCpsAppointmentPost(
      new Request("http://127.0.0.1:3002/api/inbound/cps/appointments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cps-local-source": "random-local-secret",
        },
        body: JSON.stringify({
          submission_id: VALID_SUBMISSION_ID,
          name: "Jane Example",
          email: "jane@example.com",
          phone: "801-555-0100",
          ...VALID_CONSENT,
        }),
      }),
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "local_write_disabled");
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
    if (previousSecret === undefined) delete mutableEnv.CPS_LOCAL_SOURCE_SECRET;
    else mutableEnv.CPS_LOCAL_SOURCE_SECRET = previousSecret;
    if (previousNoWrite === undefined) delete mutableEnv.CPS_LOCAL_NO_WRITE_ONLY;
    else mutableEnv.CPS_LOCAL_NO_WRITE_ONLY = previousNoWrite;
  }
});

test("production OIDC accepts only the exact CPS Vercel project", async () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  const previousFetch = globalThis.fetch;
  const oidcGlobal = globalThis as typeof globalThis & {
    __vercelOidcJwksCache?: Map<string, unknown>;
  };
  const previousCache = oidcGlobal.__vercelOidcJwksCache;
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey & {
    kid?: string;
    alg?: string;
    use?: string;
  };
  publicJwk.kid = "cps-test-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: "https://oidc.vercel.com/sandman-sms-projects",
    aud: "https://vercel.com/sandman-sms-projects",
    sub: "owner:sandman-sms-projects:project:cpsutah:environment:production",
    owner: "sandman-sms-projects",
    owner_id: "team_jvhwfBn81nJXTMX0DEvwQCuA",
    project: "cpsutah",
    project_id: "prj_0BXjSD05cmHJuj0pZYwkTL0DB7dA",
    environment: "production",
    iat: now,
    nbf: now - 1,
    exp: now + 300,
  };
  const token = (overrides: Record<string, unknown> = {}) => {
    const encodedHeader = encode({ alg: "RS256", kid: publicJwk.kid });
    const encodedClaims = encode({ ...claims, ...overrides });
    const signature = sign(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      privateKey,
    ).toString("base64url");
    return `${encodedHeader}.${encodedClaims}.${signature}`;
  };
  const requestWithToken = (authorizationToken: string) =>
    new Request("https://omnileadsagi.com/api/inbound/cps/appointments", {
      method: "POST",
      headers: {
        authorization: `Bearer ${authorizationToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ website: "bot-value" }),
    });

  mutableEnv.NODE_ENV = "production";
  oidcGlobal.__vercelOidcJwksCache = new Map();
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  try {
    const accepted = await handleCpsAppointmentPost(requestWithToken(token()));
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).completion, "no_write");

    const wrongProject = await handleCpsAppointmentPost(
      requestWithToken(token({ project_id: "prj_wrong_project" })),
    );
    assert.equal(wrongProject.status, 401);
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
    globalThis.fetch = previousFetch;
    oidcGlobal.__vercelOidcJwksCache = previousCache;
  }
});

