import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { ixLegacySignupPost } from "../lib/server/ix-network-legacy";
import { IX_SOURCES } from "../lib/server/ix-network-policy";

const endpoint = "https://omnileadsagi.com/api/federation-newsletter/subscribe";
const complete = {
  ok: true, workflow_complete: true, completion: "new_welcome_accepted",
  subscription_active: true, dashboard_mirrored: true, analytics_mirrored: true,
  welcome_accepted: true, owner_notification_accepted: true,
};
const body = { site: "theixnetwork", source: "theixnetwork", email: "unit@invalid.example" };
const request = (headers?: HeadersInit) => new Request(endpoint, { method: "POST", headers });
const json = (data: unknown, status = 200) => Response.json(data, { status });

test("legacy auth runs before payload handling and never trusts unsigned project claims", async () => {
  let submitted = 0;
  const submit = async () => { submitted++; return json(complete); };
  for (const payload of [body, null, { ...body, source: "renelaveau" }]) {
    const response = await ixLegacySignupPost(request(), payload, { authenticate: async () => null, submit });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).workflow_complete, false);
  }
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const forged = `${encode({ alg: "HS256", kid: "untrusted" })}.${encode({ project_id: IX_SOURCES[0].projectId })}.invalid`;
  const rejected = await ixLegacySignupPost(request({ Authorization: `Bearer ${forged}` }), body);
  assert.equal(rejected.status, 401);
  assert.equal(submitted, 0);
});

test("central and Rene identities require valid signature, exact production project and owner", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicJwk = { ...publicKey.export({ format: "jwk" }), kid: "ix-fixture", alg: "RS256", use: "sig" };
  const priorFetch = globalThis.fetch;
  const priorCache = globalThis.__vercelOidcJwksCache;
  globalThis.__vercelOidcJwksCache = new Map();
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://oidc.vercel.com/ix-fixture-owner/.well-known/jwks");
    return json({ keys: [publicJwk] });
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = (projectName: string, projectId: string, overrides = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const content = `${encode({ alg: "RS256", kid: "ix-fixture" })}.${encode({
      iss: "https://oidc.vercel.com/ix-fixture-owner", aud: "https://vercel.com/ix-fixture-owner",
      sub: `owner:ix-fixture-owner:project:${projectName}:environment:production`,
      owner: "ix-fixture-owner", owner_id: "team_jvhwfBn81nJXTMX0DEvwQCuA",
      project: projectName, project_id: projectId, environment: "production", iat: now, exp: now + 600,
      ...overrides,
    })}`;
    return `${content}.${sign("RSA-SHA256", Buffer.from(content), privateKey).toString("base64url")}`;
  };
  try {
    const { authenticateIxCaller } = await import("../lib/server/ix-network-policy");
    for (const source of ["theixnetwork", "renelaveau"]) {
      const identity = IX_SOURCES.find((entry) => entry.source === source)!;
      let submits = 0;
      const submit = async () => { submits++; return json(complete); };
      const valid = token(identity.projectName, identity.projectId);
      const response = await ixLegacySignupPost(request({ Authorization: `Bearer ${valid}` }), { ...body, source }, { authenticate: authenticateIxCaller, submit });
      assert.equal(response.status, 200);
      assert.equal(submits, 1);
      for (const claims of [{ owner_id: "team_other" }, { project: "other" }, { environment: "preview" }, { project_id: "prj_other" }, { exp: 1 }]) {
        const invalid = token(identity.projectName, identity.projectId, claims);
        assert.equal((await ixLegacySignupPost(request({ Authorization: `Bearer ${invalid}` }), { ...body, source }, { authenticate: authenticateIxCaller, submit })).status, 401);
      }
      assert.equal((await ixLegacySignupPost(request({ Authorization: `Bearer ${valid}` }), { ...body, source: "luxurybran" }, { authenticate: authenticateIxCaller, submit })).status, 403);
      const tampered = `${valid.slice(0, valid.lastIndexOf(".") + 1)}invalid`;
      assert.equal((await ixLegacySignupPost(request({ Authorization: `Bearer ${tampered}` }), { ...body, source }, { authenticate: authenticateIxCaller, submit })).status, 401);
      assert.equal(submits, 1);
    }
  } finally {
    globalThis.fetch = priorFetch;
    globalThis.__vercelOidcJwksCache = priorCache;
  }
});

test("legacy source, payload and opt-out validation precede strict workflow effects", async () => {
  let submitted = 0;
  const dependencies = { authenticate: async () => "theixnetwork", submit: async () => { submitted++; return json(complete); } };
  for (const payload of [null, [], "invalid", { ...body, email: "invalid" }, { ...body, email: 1 }, { ...body, email: `${"a".repeat(255)}@invalid.example` }]) {
    assert.equal((await ixLegacySignupPost(request(), payload, dependencies)).status, 422);
  }
  for (const payload of [{ ...body, site: "cps" }, { ...body, source: "gmsekingsavage" }, { ...body, source: "renelaveau" }, { site: body.site, email: body.email }]) {
    assert.equal((await ixLegacySignupPost(request(), payload, dependencies)).status, 403);
  }
  for (const control of [{ consent: false }, { consent_terms: false }, { send_welcome: false }, { mode: "no_write" }, { kind: "waitlist" }, { website: "probe" }, { honeypot: "probe" }]) {
    assert.equal((await ixLegacySignupPost(request(), { ...body, ...control }, dependencies)).status, 422);
  }
  assert.equal(submitted, 0);
});

test("adapter normalizes legacy action into exact strict payload and stable retry identity", async () => {
  const captured: Request[] = [];
  const dependencies = { authenticate: async () => "theixnetwork", submit: async (req: Request) => { captured.push(req); return json(complete); } };
  for (const email of [" Unit@Invalid.Example ", "unit@invalid.example"]) {
    const response = await ixLegacySignupPost(request({ Authorization: "Bearer preserved", "Idempotency-Key": "caller-controlled", "Content-Length": "1" }), { ...body, site: " THEIXNETWORK ", email, first_name: "ignored", destination: "https://untrusted.invalid", idempotency_key: "caller-controlled" }, dependencies);
    assert.equal(response.status, 200);
  }
  const key = `ix-waitlist-${createHash("sha256").update(`theixnetwork|waitlist|${body.email}`).digest("hex").slice(0, 40)}`;
  for (const capturedRequest of captured) {
    assert.equal(capturedRequest.url, endpoint);
    assert.equal(capturedRequest.headers.get("authorization"), "Bearer preserved");
    assert.equal(capturedRequest.headers.get("idempotency-key"), key);
    assert.equal(capturedRequest.headers.has("content-length"), false);
    assert.deepEqual(await capturedRequest.json(), { ...body, kind: "waitlist", mode: "submit", consent: true, idempotency_key: key });
  }
});

test("every successful legacy HTTP response requires full strict completion", async () => {
  const authenticate = async () => "theixnetwork";
  for (const completion of ["new_welcome_accepted", "already_subscribed", "reactivated_welcome_accepted"]) {
    const response = await ixLegacySignupPost(request(), body, { authenticate, submit: async () => json({ ...complete, completion }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).workflow_complete, true);
  }
  const incomplete: unknown[] = [null, {}, { ok: true }, { ...complete, completion: "honeypot_no_write" }, { ...complete, completion: "no_write" }, { ...complete, completion: "pending" }];
  for (const flag of ["ok", "workflow_complete", "subscription_active", "dashboard_mirrored", "analytics_mirrored", "welcome_accepted", "owner_notification_accepted"]) incomplete.push({ ...complete, [flag]: false });
  for (const result of incomplete) {
    const response = await ixLegacySignupPost(request(), body, { authenticate, submit: async () => json(result) });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).workflow_complete, false);
  }
  assert.equal((await ixLegacySignupPost(request(), body, { authenticate, submit: async () => json(complete, 202) })).status, 503);
  assert.equal((await ixLegacySignupPost(request(), body, { authenticate, submit: async () => new Response("invalid") })).status, 503);
  assert.equal((await ixLegacySignupPost(request(), body, { authenticate, submit: async () => { throw new Error("provider unavailable"); } })).status, 503);
  const rejected = await ixLegacySignupPost(request(), body, { authenticate, submit: async () => json({ ok: false, workflow_complete: false, error: "owner_notification_failed" }, 503) });
  assert.equal(rejected.status, 503);
  assert.equal((await rejected.json()).error, "owner_notification_failed");
});

test("slow completion is awaited; disconnected callers cannot start workflow effects", async () => {
  let release!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => { release = resolve; });
  let settled = false;
  const operation = ixLegacySignupPost(request(), body, { authenticate: async () => "theixnetwork", submit: () => pending }).then((response) => { settled = true; return response; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  release(json(complete));
  assert.equal((await operation).status, 200);
  let submitted = 0;
  const controller = new AbortController(); controller.abort();
  const aborted = new Request(endpoint, { method: "POST", signal: controller.signal });
  assert.equal((await ixLegacySignupPost(aborted, body, { authenticate: async () => "theixnetwork", submit: async () => { submitted++; return json(complete); } })).status, 503);
  assert.equal(submitted, 0);
});
