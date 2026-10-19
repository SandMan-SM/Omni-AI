import { paymentRuntimeRequest } from "@/lib/server/sitanim-payments-runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const POST = (request: Request) => paymentRuntimeRequest("worker", request);
export const GET = (request: Request) => paymentRuntimeRequest("worker", request);
