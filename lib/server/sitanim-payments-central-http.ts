import type { CrmReceipt,PaymentCrmProof } from "./sitanim-payments-store";
import { PaymentError,normalizeEmail } from "./sitanim-payments-policy";

export type CentralPaymentDependencies={
  authorize(request:Request):Promise<boolean>;
  ready():Promise<void>;
  proof(orderId:string,eventId:string,bodyHash:string):Promise<PaymentCrmProof>;
  sync(proof:PaymentCrmProof):Promise<CrmReceipt>;
  recipient(orderId:string,purpose:"customer"|"owner",payloadHash:string):Promise<{email:string;businessId:string}>;
  suppressed(email:string):Promise<boolean>;
  ownerEmail:string;
};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
async function body(request:Request,keys:string[]):Promise<Record<string,unknown>> {
  const reader=request.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if (!reader || Number(request.headers.get("content-length"))>4096) throw new PaymentError("invalid_gateway_request",400,false);
  for (;;) {const result=await reader.read();if(result.done)break;size+=result.value.byteLength;if(size>4096){await reader.cancel();throw new PaymentError("invalid_gateway_request",413,false);}chunks.push(result.value);}
  try {
    const value:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));
    if (!value || typeof value!=="object" || Array.isArray(value) || Object.keys(value).sort().join()!==keys.sort().join()) throw new Error();
    return value as Record<string,unknown>;
  } catch {throw new PaymentError("invalid_gateway_request",400,false);}
}
export function createCentralPaymentHandlers(deps:CentralPaymentDependencies) {
  const handle=(fn:(request:Request)=>Promise<Response>)=>async(request:Request)=>{
    try {if(!await deps.authorize(request))return json({ok:false,error:"unauthorized"},401);return await fn(request);}
    catch(error){const code=error instanceof PaymentError?error.code:"central_payment_gateway_unavailable";console.error("[sitanim-payments-central]",code);return json({ok:false,error:code,retryable:error instanceof PaymentError?error.retryable:true},error instanceof PaymentError?error.status:503);}
  };
  return {
    health:handle(async()=>{await deps.ready();return json({ok:true,scope:"sitanim-crm-connectivity-only"});}),
    sync:handle(async(request)=>{
      const value=await body(request,["orderId","eventId","bodyHash"]);
      if ([value.orderId,value.eventId,value.bodyHash].some((item)=>typeof item!=="string")) throw new PaymentError("invalid_gateway_request",400,false);
      const proof=await deps.proof(String(value.orderId),String(value.eventId),String(value.bodyHash));
      return json({ok:true,...await deps.sync(proof)});
    }),
    suppression:handle(async(request)=>{
      const value=await body(request,["orderId","purpose","payloadHash"]);
      if (typeof value.orderId!=="string" || typeof value.payloadHash!=="string" || !["customer","owner"].includes(String(value.purpose))) throw new PaymentError("invalid_gateway_request",400,false);
      const purpose=value.purpose as "customer"|"owner";
      const recipient=await deps.recipient(value.orderId,purpose,value.payloadHash);
      if (purpose==="owner" && normalizeEmail(recipient.email)!==normalizeEmail(deps.ownerEmail)) throw new PaymentError("notification_owner_binding_invalid",409,false);
      return json({ok:true,suppressed:await deps.suppressed(recipient.email)});
    }),
  };
}
