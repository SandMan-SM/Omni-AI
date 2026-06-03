import {
  handleDocumentSignatureGet,
  handleDocumentSignaturePost,
} from "@/lib/server/document-signature-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  return handleDocumentSignatureGet(req);
}

export async function POST(req: Request) {
  return handleDocumentSignaturePost(req);
}
