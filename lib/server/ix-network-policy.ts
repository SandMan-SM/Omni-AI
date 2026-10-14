import { timingSafeEqual } from "node:crypto";
import { verifyVercelProjectToken } from "@/lib/server/vercel-oidc";

const OWNER_ID = "team_jvhwfBn81nJXTMX0DEvwQCuA";
export const IX_SOURCES = [
  { source: "theixnetwork", projectName: "theixnetwork", projectId: "prj_BOyLGGkgbsTnpYqbKEQN1JRhi2UQ" },
  { source: "renelaveau", projectName: "renelaveau-website", projectId: "prj_47LTkaHzwJkyt7BX2GnQb6ErzZg2" },
  { source: "deptofcreatvs", projectName: "deptofcreatvs", projectId: "prj_LbvDvxQ0ub0eMmYQZtYGOFTfSmqZ" },
  { source: "hiddencamerastudios", projectName: "hiddencamerastudios", projectId: "prj_uMgrMVjGEvr5HMIG1L5y5gngmywk" },
  { source: "lanretealone", projectName: "lanretealone", projectId: "prj_deKnTnHVKJoRoFhsX6rbeJPtYPPT" },
  { source: "luxurybran", projectName: "luxurybran", projectId: "prj_8l7vnk3isv7aoxnDorbjyKOpPS9g" },
  { source: "masondayy", projectName: "masondayy", projectId: "prj_cQYQiJ9ktnrK9e1rHWNhsaqLfysg" },
  { source: "sfdempire", projectName: "sfd-empire", projectId: "prj_ktKlH3TdxzN1d4vAHku1Rm2awycu" },
  { source: "societyfeen", projectName: "societyfeen", projectId: "prj_7WJl2KH0EusyA8UeqnqRTk8IsbgD" },
  { source: "theluxesocialist", projectName: "theluxesocialist", projectId: "prj_QRI5wg4CghKraqiKS9JSMplrDVMj" },
] as const;

type BridgeEnvironment = { NODE_ENV?: string; IX_OMNI_LOCAL_BRIDGE?: string; IX_LOCAL_SOURCE_SECRET?: string };
export function isIxLocalBridgeRequest(request: Request, env: BridgeEnvironment): boolean {
  const host = new URL(request.url).hostname;
  const expected = env.IX_LOCAL_SOURCE_SECRET || "";
  const supplied = request.headers.get("x-ix-local-source") || "";
  if (env.NODE_ENV !== "development" || env.IX_OMNI_LOCAL_BRIDGE !== "1" ||
      (host !== "127.0.0.1" && host !== "localhost") || expected.length < 16) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authenticateIxCaller(request: Request): Promise<string | null> {
  if (isIxLocalBridgeRequest(request, process.env)) return "local";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return null;
  // Untrusted claims only select an allowlist candidate. The full JWT signature,
  // issuer, audience, owner, project and production environment are verified next.
  let candidate: typeof IX_SOURCES[number] | undefined;
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1] || "", "base64url").toString("utf8"));
    candidate = IX_SOURCES.find((entry) => entry.projectId === claims.project_id);
  } catch { return null; }
  if (!candidate) return null;
  const verified = await verifyVercelProjectToken(token, {
    ownerId: OWNER_ID, projectId: candidate.projectId,
    projectName: candidate.projectName, environment: "production",
  });
  return verified ? candidate.source : null;
}

export type IxProviderResult = { ok: boolean; id?: string; error?: string; outcome?: "rejected" | "unknown" };
export function classifyIxProviderResponse(ok: boolean, status: number, body: unknown): IxProviderResult {
  if (!ok) return { ok: false, error: `resend_${status}`, outcome: status >= 500 || status === 409 ? "unknown" : "rejected" };
  const id = body && typeof body === "object" && "id" in body ? body.id : undefined;
  if (typeof id !== "string" || !id) return { ok: false, error: "resend_missing_message_id", outcome: "unknown" };
  return { ok: true, id };
}
