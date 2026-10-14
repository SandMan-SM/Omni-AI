import { createHmac, timingSafeEqual } from "node:crypto";
import { verifyVercelProjectToken } from "@/lib/server/vercel-oidc";

export class SitanimSignupError extends Error {
  constructor(readonly code: string, readonly status = 503, readonly retryable = status >= 500) {
    super(code);
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return `{${Object.keys(item).filter((key) => item[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(item[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Legacy intake stores caller JSON: only signed snapshots are receiver-owned. */
export function signSitanimState(state: Record<string, unknown>, secret: string): string {
  if (!secret) throw new SitanimSignupError("workflow_signing_not_configured");
  const unsigned = { ...state }; delete unsigned.signature;
  return createHmac("sha256", secret).update("sitanim-newsletter-state-v1\0").update(canonical(unsigned)).digest("hex");
}

export function verifySitanimState(state: Record<string, unknown>, secret: string, email: string, leadId: string): boolean {
  if (state.email !== email || state.leadId !== leadId || typeof state.signature !== "string" || !/^[a-f0-9]{64}$/.test(state.signature)) return false;
  const expected = Buffer.from(signSitanimState(state, secret));
  const supplied = Buffer.from(state.signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

type BridgeEnvironment = { NODE_ENV?: string; SITANIM_LOCAL_BRIDGE?: string; SITANIM_LOCAL_SECRET?: string };
export function isSitanimLocalRequest(request: Request, env: BridgeEnvironment): boolean {
  const expected = env.SITANIM_LOCAL_SECRET || "";
  const supplied = request.headers.get("x-sitanim-local-secret") || "";
  const url = new URL(request.url);
  if (env.NODE_ENV !== "development" || env.SITANIM_LOCAL_BRIDGE !== "1" ||
      !["localhost", "127.0.0.1"].includes(url.hostname) || expected.length < 24) return false;
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authenticateSitanim(request: Request): Promise<boolean> {
  if (isSitanimLocalRequest(request, process.env)) return true;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(token) && verifyVercelProjectToken(token, {
    ownerId: "team_jvhwfBn81nJXTMX0DEvwQCuA",
    projectId: "prj_smIaIxycXxT64cnJ2RlCo6r1dEar",
    projectName: "sitanimafi-website",
    environment: "production",
  });
}

export type MessagePayload = { from: string; to: string[]; subject: string; html: string; text: string; headers?: Record<string, string>; reply_to?: string };
export type MessageState = {
  status: "pending" | "sending" | "accepted" | "failed" | "unknown";
  key: string;
  payload: MessagePayload;
  firstAttemptAt?: string;
  lastAttemptAt?: string;
  providerId?: string;
  error?: string;
};
export type DeliveryState = { welcome: MessageState; owner: MessageState };
export type DeliveryDependencies = {
  checkSuppression: () => Promise<void>;
  persist: () => Promise<void>;
  send: (message: MessageState) => Promise<{ id: string }>;
  now?: () => Date;
};

/** A persisted send intent always precedes delivery; an accepted receipt precedes success. */
export async function deliverSitanimMessages(state: DeliveryState, deps: DeliveryDependencies): Promise<void> {
  for (const channel of ["welcome", "owner"] as const) {
    const message = state[channel];
    if (message.status === "accepted" && message.providerId) continue;
    await deps.checkSuppression();
    const now = (deps.now || (() => new Date()))();
    // Resend keys expire after 24h. Never blindly re-send an unresolved old send.
    if (message.firstAttemptAt && now.getTime() - Date.parse(message.firstAttemptAt) >= 23 * 60 * 60 * 1000) {
      throw new SitanimSignupError(`${channel}_receipt_reconciliation_required`, 503, false);
    }
    message.firstAttemptAt ||= now.toISOString();
    message.lastAttemptAt = now.toISOString();
    message.status = "sending";
    await deps.persist();
    try {
      const receipt = await deps.send(message);
      if (!receipt.id) throw new SitanimSignupError(`${channel}_missing_provider_receipt`);
      message.status = "accepted";
      message.providerId = receipt.id;
      delete message.error;
      await deps.persist();
    } catch (error) {
      // If acceptance was received but persistence failed, keep it in the retry
      // snapshot; never discard the only known provider receipt.
      if (message.status !== "accepted") {
        message.status = "unknown";
        message.error = error instanceof SitanimSignupError ? error.code : "provider_request_failed";
      }
      await deps.persist();
      throw new SitanimSignupError(`${channel}_notification_failed`);
    }
  }
}
