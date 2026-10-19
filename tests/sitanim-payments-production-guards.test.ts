import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Pool } from "pg";
import { authorizePaymentRequest, PAYMENT_FRONTEND_PROJECT } from "../lib/server/sitanim-payments-auth";
import { paymentRuntimeConfig,validateLivePaymentDatabase } from "../lib/server/sitanim-payments-runtime";
import { createPaymentProvider } from "../lib/server/sitanim-payments-provider";
import { PaymentError, approvedOffers, PAYMENT_LIVE_BUSINESS_ID } from "../lib/server/sitanim-payments-policy";
import { PaymentStore } from "../lib/server/sitanim-payments-store";

const operator = "synthetic_operator_not_a_runtime_credential_517";
const cron = "synthetic_cron_not_a_runtime_credential_517";
const token = "synthetic.signed.oidc";
const request = (authorization = `Bearer ${token}`, url = "https://omnileadsagi.com/api/inbound/sitanim/payments", method = "GET") =>
  new Request(url, { method, headers: { authorization } });
const expectedCode = (code: string) => (error: unknown) => error instanceof PaymentError && error.code === code;

test("runtime live flag is off by default and cannot activate on preview/development", () => {
  assert.throws(() => paymentRuntimeConfig({}), expectedCode("payments_backend_disabled"));
  const env = { SITANIM_PAYMENTS_BACKEND_ENABLED: "true", SITANIM_PAYMENTS_ENVIRONMENT: "live" };
  for (const extra of [{}, { SITANIM_PAYMENTS_LIVE_ENABLED: "true", NODE_ENV: "development" },
    { SITANIM_PAYMENTS_LIVE_ENABLED: "true", NODE_ENV: "production", VERCEL_ENV: "preview" }]) {
    assert.throws(() => paymentRuntimeConfig({ ...env, ...extra }), expectedCode("live_payments_disabled"));
  }
});

test("live config never falls back to Test or generic database/provider/mail secrets", () => {
  const env = { SITANIM_PAYMENTS_BACKEND_ENABLED: "true", SITANIM_PAYMENTS_ENVIRONMENT: "live", SITANIM_PAYMENTS_LIVE_ENABLED: "true",
    NODE_ENV: "production", VERCEL_ENV: "production", SITANIM_PAYMENTS_OPERATOR_TOKEN: operator,
    DATABASE_URL: "legacy-database", STRIPE_SECRET_KEY: "legacy-provider", RESEND_API_KEY: "legacy-mail",
    SITANIM_PAYMENTS_DATABASE_URL: "test-database", SITANIM_PAYMENTS_STRIPE_TEST_RESTRICTED_KEY: "test-provider",
    SITANIM_PAYMENTS_RESEND_KEY: "test-mail" };
  assert.throws(() => paymentRuntimeConfig(env), expectedCode("dedicated_payments_database_not_configured"));
  const dedicated="postgresql://synthetic_app@db.tzwxbbpsvmcaxhnlxmjj.supabase.co:5432/postgres";
  const config = paymentRuntimeConfig({ ...env, SITANIM_PAYMENTS_LIVE_DATABASE_URL: dedicated });
  assert.equal(config.database, dedicated); assert.equal(config.key, ""); assert.equal(config.resendKey, "");
});

test("dedicated live DB rejects shared project, admin credentials and lookalike hosts",()=>{
  for(const value of ["postgresql://postgres@db.tzwxbbpsvmcaxhnlxmjj.supabase.co/postgres",
    "postgresql://synthetic_app@db.odvxtychuxxsudfpcqqs.supabase.co/postgres",
    "postgresql://synthetic_app.odvxtychuxxsudfpcqqs@aws-0-us-east-1.pooler.supabase.com/postgres",
    "postgresql://synthetic_app@db.tzwxbbpsvmcaxhnlxmjj.supabase.co.evil.invalid/postgres",
    "postgresql://synthetic_app@127.0.0.1:55417/postgres"]){
    assert.throws(()=>validateLivePaymentDatabase(value),expectedCode("dedicated_live_payment_database_required"));
  }
  validateLivePaymentDatabase("postgresql://synthetic_app.tzwxbbpsvmcaxhnlxmjj@aws-0-us-east-1.pooler.supabase.com:6543/postgres");
});

test("Test environment is rejected on production and restricted keys are mode-specific", () => {
  assert.throws(() => paymentRuntimeConfig({ SITANIM_PAYMENTS_BACKEND_ENABLED: "true", SITANIM_PAYMENTS_ENVIRONMENT: "test", VERCEL_ENV: "production" }),
    expectedCode("test_environment_forbidden_in_production"));
  for (const key of ["sk_live_synthetic", "rk_test_synthetic", "", "legacy"]) {
    assert.throws(() => createPaymentProvider(key, "live"), expectedCode("dedicated_live_restricted_key_required"));
  }
  assert(createPaymentProvider("rk_live_synthetic_not_runtime", "live").client);
  assert.throws(() => createPaymentProvider("rk_live_synthetic_not_runtime"), expectedCode("dedicated_test_restricted_key_required"));
});

test("production customer auth stays frontend-only; health also accepts existing read-only operator", async () => {
  const config = { environment: "live" as const, nodeEnv: "production", vercelEnv: "production", operatorToken: operator, cronSecret: cron };
  const verified: Array<unknown> = [];
  const verify = async (value: string, identity: typeof PAYMENT_FRONTEND_PROJECT) => { verified.push(identity); return value === token; };
  for (const action of ["health", "customerStatus"] as const) {
    assert.equal(await authorizePaymentRequest(request(), action, config, verify), true);
    assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`), action, config, verify), action==="health");
    assert.equal(await authorizePaymentRequest(request(`Bearer ${cron}`), action, config, verify), false);
    assert.equal(await authorizePaymentRequest(request("Bearer wrong"), action, config, verify), false);
    assert.equal(await authorizePaymentRequest(request(), action, { ...config, vercelEnv: "preview" }, verify), false);
  }
  assert(verified.every((identity) => identity === PAYMENT_FRONTEND_PROJECT));
  assert.equal(PAYMENT_FRONTEND_PROJECT.projectName, "sitanimafi-website");
});

test("operator health is GET-only and production-live only, never customer status or platform-cron authority",async()=>{
  const config={environment:"live" as const,nodeEnv:"production",vercelEnv:"production",operatorToken:operator,cronSecret:cron};
  const never=async():Promise<never>=>{throw new Error("Valid operator health must not call the frontend verifier");};
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`),"health",config,never),true);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`,undefined,"POST"),"health",config,never),false);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`),"customerStatus",config,never),false);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${cron}`),"health",config,never),false);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`),"health",{...config,vercelEnv:"preview"},never),false);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`),"health",{...config,nodeEnv:"development"},never),false);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`),"health",{...config,operatorToken:"too_short"},async()=>false),false);
});

test("actual OIDC signature/claims verifier rejects other projects and preview tokens", async () => {
  const config = { environment: "live" as const, nodeEnv: "production", vercelEnv: "production", operatorToken: operator };
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const issuer = "https://oidc.vercel.com/synthetic-payments-qa";
  const previous = global.__vercelOidcJwksCache;
  global.__vercelOidcJwksCache = new Map([[issuer, { expiresAt: Date.now() + 60_000, keys: [{ ...publicKey.export({ format: "jwk" }), kid: "synthetic-payments-qa", alg: "RS256", use: "sig" }] }]]);
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: issuer, aud: "https://vercel.com/synthetic-payments-qa", owner: "synthetic-payments-qa",
    owner_id: PAYMENT_FRONTEND_PROJECT.ownerId, project_id: PAYMENT_FRONTEND_PROJECT.projectId,
    project: PAYMENT_FRONTEND_PROJECT.projectName, environment: "production",
    sub: "owner:synthetic-payments-qa:project:sitanimafi-website:environment:production", iat: now, exp: now + 300 };
  const jwt = (changes: Record<string, unknown> = {}) => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "synthetic-payments-qa" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ ...claims, ...changes })).toString("base64url");
    return `${header}.${body}.${sign("RSA-SHA256", Buffer.from(`${header}.${body}`), privateKey).toString("base64url")}`;
  };
  try {
    assert.equal(await authorizePaymentRequest(request(`Bearer ${jwt()}`), "customerStatus", config), true);
    for (const changes of [{ project_id: "prj_other" }, { owner_id: "team_other" }, { environment: "preview" },
      { sub: "owner:synthetic-payments-qa:project:other:environment:production" }, { exp: now - 120 }]) {
      assert.equal(await authorizePaymentRequest(request(`Bearer ${jwt(changes)}`), "customerStatus", config), false);
    }
    const valid = jwt();
    assert.equal(await authorizePaymentRequest(request(`Bearer ${valid.slice(0, -20)}tampered`), "health", config), false);
  } finally { global.__vercelOidcJwksCache = previous; }
});

test("worker GET accepts existing platform cron only; POST accepts dedicated operator only", async () => {
  const config = { environment: "live" as const, nodeEnv: "production", vercelEnv: "production", operatorToken: operator, cronSecret: cron };
  const never = async (): Promise<never> => { throw new Error("worker/operator routes must not use frontend OIDC"); };
  assert.equal(await authorizePaymentRequest(request(`Bearer ${cron}`), "worker", config, never), true);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`), "worker", config, never), false);
  for (const method of ["GET", "POST", "PUT"]) {
    assert.equal(await authorizePaymentRequest(request(undefined, undefined, method), "worker", config, never), false);
  }
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`, undefined, "POST"), "worker", config, never), true);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${cron}`, undefined, "POST"), "worker", config, never), false);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`, undefined, "PUT"), "worker", config, never), false);
  const existingPlatformCron = "syntheticcron_16x";
  assert.equal(await authorizePaymentRequest(request(`Bearer ${existingPlatformCron}`), "worker", { ...config, cronSecret: existingPlatformCron }, never), true);
  assert.equal(await authorizePaymentRequest(request(), "status", config, never), false);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${cron}`), "status", config, never), false);
});

test("runtime uses platform CRON_SECRET without falling back to a payment-specific cron token", () => {
  const env = { SITANIM_PAYMENTS_BACKEND_ENABLED: "true", SITANIM_PAYMENTS_ENVIRONMENT: "test",
    SITANIM_PAYMENTS_DATABASE_URL: "synthetic-test-database", SITANIM_PAYMENTS_OPERATOR_TOKEN: operator,
    SITANIM_PAYMENTS_CRON_SECRET: "synthetic_payment_specific_not_platform" };
  assert.equal(paymentRuntimeConfig(env).cronSecret, undefined);
  assert.equal(paymentRuntimeConfig({ ...env, CRON_SECRET: cron }).cronSecret, cron);
});

test("payment worker cron is five-minute and offset from unchanged daily newsletter cron", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.crons, [
    { path: "/api/cron/newsletter?action=publish-public", schedule: "5 14 * * *" },
    { path: "/api/internal/sitanim/payments/worker", schedule: "1-59/5 * * * *" },
  ]);
});

test("Test operator bridge is dev-only loopback3019 and can never authorize live", async () => {
  const config = { environment: "test" as const, nodeEnv: "development", operatorToken: operator };
  const local = request(`Bearer ${operator}`, "http://127.0.0.1:3019/api/internal/sitanim/payments/customer-status");
  assert.equal(await authorizePaymentRequest(local, "customerStatus", config), true);
  const localWorker = "http://127.0.0.1:3019/api/internal/sitanim/payments/worker";
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`, localWorker), "worker", config), false);
  assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`, localWorker, "POST"), "worker", config), true);
  for (const url of ["https://omnileadsagi.com/api/inbound/sitanim/payments", "http://127.0.0.1:3018/api/inbound/sitanim/payments"]) {
    assert.equal(await authorizePaymentRequest(request(`Bearer ${operator}`, url), "customerStatus", config), false);
  }
  assert.equal(await authorizePaymentRequest(local, "customerStatus", { ...config, nodeEnv: "production" }), false);
  assert.equal(await authorizePaymentRequest(local, "customerStatus", { ...config, environment: "live" }), false);
});

test("portable live store is fail closed before any DB/public CRM access while architecture is pending", async () => {
  const pool = { connect: async () => { throw new Error("No database access authorized by this unit test"); } } as unknown as Pool;
  assert.throws(() => new PaymentStore(pool, { environment: "live" }), expectedCode("live_payments_disabled"));
  const store = new PaymentStore(pool, { environment: "live", allowLive: true, businessId: PAYMENT_LIVE_BUSINESS_ID });
  await assert.rejects(store.readiness(), expectedCode("live_payment_crm_not_configured"));
  await assert.rejects(store.claimOutbox(1), expectedCode("live_payment_crm_not_configured"));
  await assert.rejects(store.checkSuppression("synthetic@example.invalid", "11111111-1111-4111-8111-111111111111"), expectedCode("live_payment_crm_not_configured"));
  assert.equal(approvedOffers("live").filter((offer) => offer.slug === "sustainer").length, 2, "Guardian display must not mutate stable provider ownership IDs");
});
