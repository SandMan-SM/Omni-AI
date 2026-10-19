import {centralPaymentRequest} from "@/lib/server/sitanim-payments-central-runtime";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export const POST=(request:Request)=>centralPaymentRequest("suppression",request);
