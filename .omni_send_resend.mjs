import { Resend } from 'resend';
import fs from 'node:fs';
function loadEnv(path){
  try{
    const env={};
    for (const line of fs.readFileSync(path,'utf8').split(/\r?\n/)){
      const s=line.trim(); if(!s || s.startsWith('#') || !s.includes('=')) continue;
      const idx=s.indexOf('='); env[s.slice(0,idx).trim()]=s.slice(idx+1).trim().replace(/^['\"]|['\"]$/g,'');
    }
    return env;
  }catch{return {};}
}
const key=process.env.RESEND_API_KEY || loadEnv('/workspace/.env.local').RESEND_API_KEY;
if(!key){ console.log(JSON.stringify({ok:false,error:'RESEND_API_KEY missing'})); process.exit(2); }
const payload=JSON.parse(fs.readFileSync('/tmp/omni_interlinked_payload.json','utf8'));
payload.to=['sitanim8@gmail.com']; delete payload.cc; delete payload.bcc; delete payload.reply_to;
const resend=new Resend(key);
try{
  const result=await resend.emails.send(payload);
  console.log(JSON.stringify({ok:!result.error, result}, null, 2));
  if(result.error) process.exit(1);
}catch(e){
  console.log(JSON.stringify({ok:false,error:String(e),stack:e?.stack?.split('\n').slice(0,3)}, null, 2));
  process.exit(1);
}
