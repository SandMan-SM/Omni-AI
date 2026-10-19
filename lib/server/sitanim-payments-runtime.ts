import { Pool } from "pg";
import { ixPostgresConfig } from "./ix-postgres-config";
import { PaymentError, STRIPE_ACCOUNT_ID, type PaymentEnvironment } from "./sitanim-payments-policy";
import { createPaymentProvider, hydratePaymentEvent, verifyCustomerCheckout, verifyPaymentEvent } from "./sitanim-payments-provider";
import { sendBillingMessage } from "./sitanim-payments-notifications";
import { PaymentStore } from "./sitanim-payments-store";
import { createPaymentHandlers } from "./sitanim-payments-http";
import { authorizePaymentRequest } from "./sitanim-payments-auth";
import {getVercelOidcToken} from "@vercel/oidc";
import {syncPaymentGateway,paymentGatewaySuppression,paymentGatewayReadiness} from "./sitanim-payments-transport";

let cached: ReturnType<typeof createPaymentHandlers> | undefined;
let cachedStore:PaymentStore|undefined;
const PAYMENT_DATABASE_REF="tzwxbbpsvmcaxhnlxmjj";

/** Prevent an accidental shared/legacy/admin URL even under the dedicated env name. */
export function validateLivePaymentDatabase(value:string):void {
  try {
    const url=new URL(value),user=decodeURIComponent(url.username),suffix=`.${PAYMENT_DATABASE_REF}`;
    const baseUser=user.endsWith(suffix)?user.slice(0,-suffix.length):user;
    const direct=url.hostname===`db.${PAYMENT_DATABASE_REF}.supabase.co`;
    const pooler=url.hostname.endsWith(".pooler.supabase.com")&&user.endsWith(`.${PAYMENT_DATABASE_REF}`);
    if(!["postgres:","postgresql:"].includes(url.protocol)||(!direct&&!pooler)||!["/postgres","postgres"].includes(url.pathname)||
      !user||["postgres","supabase_admin","service_role","authenticator"].includes(baseUser))throw new Error();
  } catch {throw new PaymentError("dedicated_live_payment_database_required",503,false);}
}

/** Dedicated values only: no legacy Stripe/CRM/database/email credential fallbacks. */
export function paymentRuntimeConfig(env: Record<string, string | undefined> = process.env) {
  if (env.SITANIM_PAYMENTS_BACKEND_ENABLED !== "true") throw new PaymentError("payments_backend_disabled", 503, false);
  const environment = env.SITANIM_PAYMENTS_ENVIRONMENT as PaymentEnvironment;
  if (environment !== "test" && environment !== "live") throw new PaymentError("invalid_payment_environment", 503, false);
  if (environment === "live" && (env.SITANIM_PAYMENTS_LIVE_ENABLED !== "true" || env.NODE_ENV !== "production" || env.VERCEL_ENV !== "production")) {
    throw new PaymentError("live_payments_disabled", 503, false);
  }
  if (environment === "test" && env.VERCEL_ENV === "production") throw new PaymentError("test_environment_forbidden_in_production", 503, false);
  const database = environment === "live" ? env.SITANIM_PAYMENTS_LIVE_DATABASE_URL : env.SITANIM_PAYMENTS_DATABASE_URL;
  if (!database) throw new PaymentError("dedicated_payments_database_not_configured", 503, false);
  if(environment==="live")validateLivePaymentDatabase(database);
  const operatorToken = env.SITANIM_PAYMENTS_OPERATOR_TOKEN || "";
  if (operatorToken.length < 32) throw new PaymentError("payments_operator_auth_not_configured", 503, false);
  return {
    environment, database, operatorToken,
    key: (environment === "live" ? env.SITANIM_PAYMENTS_STRIPE_LIVE_RESTRICTED_KEY : env.SITANIM_PAYMENTS_STRIPE_TEST_RESTRICTED_KEY) || "",
    webhookSecret: (environment === "live" ? env.SITANIM_PAYMENTS_STRIPE_LIVE_WEBHOOK_SECRET : env.SITANIM_PAYMENTS_STRIPE_TEST_WEBHOOK_SECRET) || "",
    resendKey: (environment === "live" ? env.SITANIM_PAYMENTS_LIVE_RESEND_KEY : env.SITANIM_PAYMENTS_RESEND_KEY) || "",
    businessId: environment === "live" ? env.SITANIM_PAYMENTS_LIVE_BUSINESS_ID : undefined,
    ownerEmail: (environment === "live" ? env.SITANIM_PAYMENTS_OWNER_EMAIL : env.SITANIM_PAYMENTS_TEST_OWNER_EMAIL) || "",
    from: env.SITANIM_PAYMENTS_EMAIL_FROM || "", replyTo: env.SITANIM_PAYMENTS_REPLY_TO || undefined,
    // Vercel injects only the existing platform CRON_SECRET into scheduled GETs.
    // Never replace it with a payment-specific token or mutate its value.
    cronSecret: env.CRON_SECRET,
    liveCrmEnabled: environment==="live" && env.SITANIM_PAYMENTS_CRM_GATEWAY_ENABLED==="true",
    databaseCa: environment==="live" ? env.SITANIM_PAYMENTS_LIVE_DATABASE_CA_CERT : env.SITANIM_PAYMENTS_TEST_DATABASE_CA_CERT,
  };
}

/** Always the isolated payments database. The central receiver has a separate pool. */
export function paymentRuntimeStore(config=paymentRuntimeConfig()):PaymentStore {
  if (!cachedStore) {
    const pool=new Pool({...ixPostgresConfig(config.database,{NODE_ENV:process.env.NODE_ENV,IX_DATABASE_CA_CERT:config.databaseCa}),max:1,connectionTimeoutMillis:8_000,idleTimeoutMillis:10_000,statement_timeout:10_000,query_timeout:12_000});
    cachedStore=new PaymentStore(pool,{environment:config.environment,allowLive:config.environment==="live",businessId:config.businessId,liveCrmEnabled:config.liveCrmEnabled});
  }
  return cachedStore;
}

function runtimeHandlers() {
  const config = paymentRuntimeConfig();
  if (cached) return cached;
  const { environment, operatorToken, webhookSecret } = config;
  const { client, provider } = createPaymentProvider(config.key, environment);
  const store = paymentRuntimeStore(config);
  cached = createPaymentHandlers({
    store, operatorToken,
    authorize: (request, action) => authorizePaymentRequest(request, action, { environment, operatorToken, cronSecret: config.cronSecret, nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.VERCEL_ENV }),
    liveCheckoutEnabled: environment === "live" && process.env.SITANIM_PAYMENTS_LIVE_CHECKOUT_ENABLED === "true",
    verify: (body, signature) => verifyPaymentEvent(client, body, signature, webhookSecret, environment),
    hydrate: (event) => hydratePaymentEvent(event, provider, environment),
    providerReady: async () => {
      if ((await provider.account()).id !== STRIPE_ACCOUNT_ID) throw new PaymentError("provider_account_mismatch", 503, false);
      if(environment==="live") await paymentGatewayReadiness(await getVercelOidcToken());
    },
    customerSession: (sessionId, reference) => verifyCustomerCheckout(sessionId, reference, provider, environment),
    notificationConfig: { environment, from: config.from, ownerEmail: config.ownerEmail, replyTo: config.replyTo },
    send: (payload, idempotencyKey) => sendBillingMessage(payload, idempotencyKey, config.resendKey, fetch, environment),
    ...(environment==="live"?{
      crmStore:store,
      syncCrm:async(job:Parameters<typeof syncPaymentGateway>[0])=>syncPaymentGateway(job,await getVercelOidcToken()),
      notificationSuppression:async(orderId:string,purpose:"customer"|"owner",hash:string)=>paymentGatewaySuppression(orderId,purpose,hash,await getVercelOidcToken()),
    }:{}),
  });
  return cached;
}

export async function paymentRuntimeRequest(action: "webhook" | "health" | "worker" | "status" | "customerStatus", request: Request): Promise<Response> {
  try { return await runtimeHandlers()[action](request); }
  catch (error) {
    const code = error instanceof PaymentError ? error.code : "payments_configuration_unavailable";
    console.error("[sitanim-payments]", code);
    return Response.json({ ok: false, error: code, retryable: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
