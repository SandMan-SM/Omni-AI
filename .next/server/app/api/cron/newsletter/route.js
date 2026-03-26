"use strict";(()=>{var e={};e.id=241,e.ids=[241],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4392:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>y,patchFetch:()=>h,requestAsyncStorage:()=>m,routeModule:()=>d,serverHooks:()=>g,staticGenerationAsyncStorage:()=>u});var n={};r.r(n),r.d(n,{GET:()=>p});var o=r(9303),i=r(8716),s=r(670),a=r(7070),l=r(9692),c=r(5913);async function p(e){let t=e.headers.get("authorization"),r=process.env.CRON_SECRET;if(r&&t!==`Bearer ${r}`)return a.NextResponse.json({error:"Unauthorized"},{status:401});try{let e=await (0,l.e)(),t=await (0,c.bk)(e);return console.log(`[Newsletter Cron] Sent: ${t.content.subject} | Telegram: ${t.telegramOk} | Email: ${t.emailOk} | Premium: ${t.premiumSent}`),a.NextResponse.json({success:!0,subject:t.content.subject,telegram:t.telegramOk,email:t.emailOk,premium_recipients:t.premiumSent,timestamp:new Date().toISOString()})}catch(t){let e=t instanceof Error?t.message:"Unknown error";return console.error("[Newsletter Cron] Failed:",e),a.NextResponse.json({success:!1,error:e},{status:500})}}let d=new o.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/cron/newsletter/route",pathname:"/api/cron/newsletter",filename:"route",bundlePath:"app/api/cron/newsletter/route"},resolvedPagePath:"/Users/janahasson/Desktop/Assets/Interlinked/Clients/Omni AI/Omni AI Website/app/api/cron/newsletter/route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:m,staticGenerationAsyncStorage:u,serverHooks:g}=d,y="/api/cron/newsletter/route";function h(){return(0,s.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:u})}},5913:(e,t,r)=>{r.d(t,{bk:()=>u});let n=process.env.ANTHROPIC_API_KEY||"",o=process.env.TELEGRAM_BOT_TOKEN||"",i=process.env.TELEGRAM_CHAT_ID||"",s=process.env.RESEND_API_KEY||"",a=process.env.NEWSLETTER_FROM_EMAIL||"newsletter@omni-ai.co",l=process.env.NEWSLETTER_TO_EMAIL||"sitanim8@gmail.com";async function c(){let e=new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});if(!n)return p(e);try{let t=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":n,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model:"claude-3-5-haiku-20241022",max_tokens:1024,messages:[{role:"user",content:`You are the Omni AI newsletter writer. Generate today's (${e}) daily newsletter.

Write a newsletter with:
1. A punchy subject line
2. Brief intro (2-3 sentences)
3. 3 key AI/business insights for today
4. One "Power Move" — a specific action readers can take today
5. A motivational closing line

Omni AI brand tone: visionary, sharp, empowering.

Respond ONLY with valid JSON using these exact keys:
{"subject":"...","intro":"...","insights":["...","...","..."],"power_move":"...","closing":"..."}`}]})});if(t.ok){let e=(await t.json()).content[0].text,r=e.indexOf("{"),n=e.lastIndexOf("}")+1;if(r>=0)return JSON.parse(e.slice(r,n))}}catch(e){console.error("Content generation error:",e)}return p(e)}function p(e){return{subject:`Omni AI Daily — ${e}`,intro:"Welcome to your daily Omni AI briefing. Here's what's moving in AI and business today.",insights:["AI automation is reducing operational costs by 30-40% for early adopters.","The businesses winning in 2026 treat AI as a strategic partner, not just a tool.","Data quality beats model quality — clean your data before scaling your AI."],power_move:"Audit one repetitive process in your business today and identify where AI could automate it.",closing:"Stay ahead. Stay sharp. Omni AI."}}async function d(e){if(!o||!i)return!1;let t=new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),r=e.insights.map((e,t)=>`  ${t+1}. ${e}`).join("\n"),n=`📰 *Omni AI Daily Newsletter*
_${t}_

${e.intro}

*Today's Key Insights:*
${r}

*Power Move:*
💡 _${e.power_move}_

_${e.closing}_`;try{return(await fetch(`https://api.telegram.org/bot${o}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:i,text:n,parse_mode:"Markdown"})})).ok}catch(e){return console.error("Telegram send error:",e),!1}}async function m(e,t){if(!s)return!1;let r=new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}),n=e.insights.map(e=>`<li style="margin-bottom:12px;line-height:1.6;">${e}</li>`).join(""),o=`<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#0f0f1a;color:#e0e0e0;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#00d4ff;font-size:28px;margin:0;">Omni AI</h1>
      <p style="color:#888;font-size:14px;margin:8px 0 0;">Daily Intelligence Brief \xb7 ${r}</p>
    </div>
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(0,212,255,0.2);border-radius:12px;padding:28px;margin-bottom:24px;">
      <p style="font-size:16px;line-height:1.7;color:#e0e0e0;margin:0;">${e.intro}</p>
    </div>
    <div style="margin-bottom:24px;">
      <h2 style="color:#00d4ff;font-size:18px;margin-bottom:16px;">Today's Key Insights</h2>
      <ul style="padding-left:20px;color:#e0e0e0;font-size:15px;">${n}</ul>
    </div>
    <div style="background:rgba(0,212,255,0.08);border-left:3px solid #00d4ff;padding:20px 24px;border-radius:0 8px 8px 0;margin-bottom:32px;">
      <p style="color:#00d4ff;font-weight:bold;margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Power Move</p>
      <p style="color:#e0e0e0;font-size:15px;line-height:1.7;margin:0;">${e.power_move}</p>
    </div>
    <p style="text-align:center;color:#888;font-style:italic;font-size:15px;">${e.closing}</p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:32px 0;">
    <p style="text-align:center;font-size:12px;color:#555;">You're receiving this from Omni AI.<br>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL||"https://omni-ai-theta.vercel.app"}/dashboard" style="color:#00d4ff;">Manage subscription</a>
    </p>
  </div>
</body></html>`;try{return(await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${s}`,"Content-Type":"application/json"},body:JSON.stringify({from:a,to:[t],subject:e.subject,html:o})})).ok}catch(e){return console.error("Email send error:",e),!1}}async function u(e=null){let t=await c(),[r,n]=await Promise.all([d(t),m(t,l)]),o=0;if(e)try{let{data:r}=await e.from("newsletter_subscriptions").select("email").eq("subscription_tier","premium").eq("subscribed",!0);r?.length&&(o=(await Promise.allSettled(r.map(e=>m(t,e.email)))).filter(e=>"fulfilled"===e.status&&e.value).length)}catch(e){console.error("Premium subscriber send error:",e)}return{content:t,telegramOk:r,emailOk:n,premiumSent:o}}},9692:(e,t,r)=>{r.d(t,{e:()=>i});var n=r(2728),o=r(1615);async function i(){let e=await (0,o.cookies)();return(0,n.createServerClient)("https://odvxtychuxxsudfpcqqs.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdnh0eWNodXh4c3VkZnBjcXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjkzMjQsImV4cCI6MjA4NzUwNTMyNH0.Ka-pmRzzDwAoTFNbkuvZqtWJMefrtM0pypIr_dZ6lYA",{cookies:{getAll:()=>e.getAll(),setAll(t){try{t.forEach(({name:t,value:r,options:n})=>e.set(t,r,n))}catch{}}}})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[276,972,637],()=>r(4392));module.exports=n})();