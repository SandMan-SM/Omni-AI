import { paymentRuntimeRequest } from "@/lib/server/sitanim-payments-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) => paymentRuntimeRequest("customerStatus", request);
