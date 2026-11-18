import { createHmac, timingSafeEqual } from "node:crypto";

const path = "https://omnileadsagi.com/api/reader/unsubscribe";
function signature(id: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Reader signing unavailable");
  return createHmac("sha256", secret)
    .update("interlinked-email-opt-out/v1/" + id)
    .digest("base64url");
}
export function editorialUnsubscribeUrl(readerId: string) {
  return path + "?token=" + readerId + "." + signature(readerId);
}
export function editorialUnsubscribeId(token: string) {
  const match =
    /^([0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/.exec(
      token,
    );
  if (
    !match ||
    !timingSafeEqual(Buffer.from(match[3]), Buffer.from(signature(match[1])))
  )
    return null;
  return match[1];
}
