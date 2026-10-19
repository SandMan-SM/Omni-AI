import { timingSafeEqual } from "node:crypto";
import { verifyVercelProjectToken } from "./vercel-oidc";
import type { PaymentEnvironment } from "./sitanim-payments-policy";

export const PAYMENT_FRONTEND_PROJECT = Object.freeze({
  ownerId: "team_jvhwfBn81nJXTMX0DEvwQCuA",
  projectId: "prj_smIaIxycXxT64cnJ2RlCo6r1dEar",
  projectName: "sitanimafi-website",
  environment: "production" as const,
});
export const PAYMENT_CENTRAL_PROJECT = Object.freeze({
  ownerId: "team_jvhwfBn81nJXTMX0DEvwQCuA",
  projectId: "prj_TRmLRTqEhjJj8ZlV4MQk0zjFGtU4",
  projectName: "omni-ai",
  environment: "production" as const,
});

export async function authorizeCentralPaymentRequest(request: Request, env: Record<string,string|undefined> = process.env): Promise<boolean> {
  if (env.NODE_ENV!=="production" || env.VERCEL_ENV!=="production" || env.SITANIM_PAYMENTS_CRM_GATEWAY_ENABLED!=="true") return false;
  const authorization=request.headers.get("authorization")||"";
  if (!authorization.startsWith("Bearer ") || authorization.length>16_384) return false;
  return verifyVercelProjectToken(authorization.slice(7),PAYMENT_CENTRAL_PROJECT);
}
export type PaymentAction = "health" | "worker" | "status" | "customerStatus";
export type PaymentAuthConfig = {
  environment: PaymentEnvironment;
  nodeEnv?: string;
  vercelEnv?: string;
  operatorToken: string;
  cronSecret?: string;
};
function matches(actual: string, secret: string | undefined, minimum = 32): boolean {
  if (!secret || secret.length < minimum) return false;
  const expected = `Bearer ${secret}`;
  return Buffer.byteLength(actual) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

/** Fixed frontend identity, except existing operator read-only health; Test bridge never authorizes live. */
export async function authorizePaymentRequest(
  request: Request,
  action: PaymentAction,
  config: PaymentAuthConfig,
  verify: (token: string, trusted: typeof PAYMENT_FRONTEND_PROJECT) => Promise<boolean> = verifyVercelProjectToken,
): Promise<boolean> {
  const authorization = request.headers.get("authorization") || "";
  if (config.environment === "test") {
    const url = new URL(request.url);
    return config.nodeEnv === "development" && config.vercelEnv !== "production" && url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) && url.port === "3019" &&
      (action !== "worker" || request.method === "POST") && matches(authorization, config.operatorToken);
  }
  if (config.nodeEnv !== "production" || config.vercelEnv !== "production") return false;
  if (action === "worker") {
    if (request.method === "GET") return matches(authorization, config.cronSecret, 16);
    if (request.method === "POST") return matches(authorization, config.operatorToken);
    return false;
  }
  if (action === "status") return matches(authorization, config.operatorToken);
  if (action === "health" && request.method === "GET" && matches(authorization, config.operatorToken)) return true;
  if (!authorization.startsWith("Bearer ") || authorization.length > 16_384 || matches(authorization, config.operatorToken) || matches(authorization, config.cronSecret, 16)) return false;
  try { return await verify(authorization.slice(7), PAYMENT_FRONTEND_PROJECT); }
  catch { return false; }
}
