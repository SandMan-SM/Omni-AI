import { paymentRuntimeRequest } from "@/lib/server/sitanim-payments-runtime";

export const dynamic = "force-dynamic";
export const GET = (request: Request) => paymentRuntimeRequest("status", request);
