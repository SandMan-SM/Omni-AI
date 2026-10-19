import {Pool,type PoolClient} from "pg";
import {ixPostgresConfig} from "./ix-postgres-config";
import {authorizeCentralPaymentRequest} from "./sitanim-payments-auth";
import {PaymentError,PAYMENT_LIVE_BUSINESS_ID} from "./sitanim-payments-policy";
import {paymentRuntimeStore} from "./sitanim-payments-runtime";
import {recordPaymentGateway,gatewaySuppression} from "./sitanim-payments-gateway";
import {createCentralPaymentHandlers} from "./sitanim-payments-central-http";

let central:Pool|undefined;
/** Existing trusted central-service pool pattern ONLY, never exposed as a payment-store fallback/argument. */
function centralPool():Pool {
  const connection=process.env.POSTGRES_URL||process.env.DATABASE_URL;
  if(!connection)throw new PaymentError("central_crm_database_not_configured");
  central ||=new Pool({...ixPostgresConfig(connection),max:1,connectionTimeoutMillis:8_000,idleTimeoutMillis:10_000,statement_timeout:10_000,query_timeout:12_000});
  return central;
}
async function transaction<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T> {
  const client=await centralPool().connect();
  try {await client.query("begin");await client.query("set local lock_timeout='5s'");const result=await fn(client);await client.query("commit");return result;}
  catch(error){await client.query("rollback").catch(()=>{});if(error instanceof PaymentError)throw error;throw new PaymentError("central_payment_persistence_failed");}
  finally{client.release();}
}
export async function centralPaymentRequest(action:"health"|"sync"|"suppression",request:Request):Promise<Response> {
  const handlers=createCentralPaymentHandlers({
    authorize:(incoming)=>authorizeCentralPaymentRequest(incoming),
    ready:async()=>{
      await paymentRuntimeStore().readiness();
      await transaction(async(client)=>{
        const business=await client.query("select id from public.omni_businesses where slug='sitanim'");
        if(business.rows.length!==1||business.rows[0].id!==PAYMENT_LIVE_BUSINESS_ID)throw new PaymentError("payment_crm_business_mismatch");
        await client.query("select id,business_id,email,raw_data from public.omni_leads_generated limit 0");
        await client.query("select id,email,business_id from public.omni_suppressions limit 0");
        await client.query("select id,body_hash from sitanim_payment_gateway.receipts limit 0");
        await client.query("select binding_key,crm_contact_id from sitanim_payment_gateway.bindings limit 0");
      });
    },
    proof:(orderId,eventId,hash)=>paymentRuntimeStore().crmProof(orderId,eventId,hash),
    sync:(proof)=>transaction((client)=>recordPaymentGateway(client,proof)),
    recipient:(orderId,purpose,hash)=>paymentRuntimeStore().notificationRecipient(orderId,purpose,hash),
    suppressed:(email)=>transaction((client)=>gatewaySuppression(client,email)),
    ownerEmail:process.env.SITANIM_PAYMENTS_OWNER_EMAIL||"",
  });
  return handlers[action](request);
}
