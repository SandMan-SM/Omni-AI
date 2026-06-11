import os, json, csv, hashlib, re, sqlite3, sys, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from datetime import datetime, timezone, timedelta

CLIENTS=Path('/Users/janahasson/Desktop/Clients')
LOG_ROOT=CLIENTS/'_agent-logs'/'lead-engine'
LOG_ROOT.mkdir(parents=True, exist_ok=True)
OMNI=CLIENTS/'Sitani Mafi'/'Omni AI'
ENV_FILES=[OMNI/'Website/.env.local', OMNI/'Website/.env', OMNI/'local.env']

def load_env(paths):
    for p in paths:
        if not p.exists(): continue
        for line in p.read_text(errors='ignore').splitlines():
            line=line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            k,v=line.split('=',1)
            v=v.strip().strip('"').strip("'")
            os.environ.setdefault(k.strip(), v)
load_env(ENV_FILES)

now=datetime.now(timezone.utc)
day=now.astimezone().date().isoformat()
prior_ids=set()
for p in LOG_ROOT.glob('*_morning-lead-workflow.json'):
    try:
        data=json.loads(p.read_text())
        for lead in data.get('leads',[]):
            if lead.get('dedupe_key'): prior_ids.add(lead['dedupe_key'])
            raw='|'.join(str(lead.get(k,'')) for k in ['email','phone','business_name','contact_name']).lower()
            if raw.strip('|'): prior_ids.add(hashlib.sha256(raw.encode()).hexdigest()[:16])
    except Exception: pass

sources=[]; candidates=[]

def dedupe_key(d):
    raw='|'.join(str(d.get(k,'') or '') for k in ['email','phone','business_name','contact_name']).lower().strip('|')
    if not raw: raw=json.dumps(d,sort_keys=True)[:500]
    return hashlib.sha256(raw.encode()).hexdigest()[:16]

def http_get(url, headers=None, timeout=15):
    req=urllib.request.Request(url, headers=headers or {'User-Agent':'OmniClawLeadWorkflow/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body=r.read(120000).decode('utf-8','replace')
            return r.status, body, None
    except urllib.error.HTTPError as e:
        return e.code, e.read(20000).decode('utf-8','replace'), None
    except Exception as e:
        return None, '', str(e)

# Supabase REST probe for known lead tables
supabase_url=os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
service_key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_ANON_KEY')
known_tables=['omni_leads_generated','landing_page_leads','demo_bookings','contact_submissions','newsletter_subscribers','webinar_registrations','cps_leads','newsletter_subscriptions','leads','build_requests']
if supabase_url and service_key:
    headers={'apikey':service_key,'Authorization':'Bearer '+service_key,'Accept':'application/json','User-Agent':'OmniClawLeadWorkflow/1.0'}
    for table in known_tables:
        url=supabase_url.rstrip('/')+f'/rest/v1/{table}?select=*&order=created_at.desc&limit=25'
        status,body,err=http_get(url,headers=headers,timeout=20)
        rec={'source':'Supabase REST','table':table,'status':'ok' if status and status<300 else 'blocked/error','http_status':status}
        if err: rec['detail']=err
        else: rec['body_preview']=body[:300]
        sources.append(rec)
        if status and status<300:
            try: rows=json.loads(body)
            except Exception: rows=[]
            for row in rows if isinstance(rows,list) else []:
                # keep only recent-ish or unknown lead-ish records
                name=row.get('business_name') or row.get('company') or row.get('name') or row.get('contact_name') or row.get('full_name') or row.get('email')
                if not name: continue
                candidates.append({'raw':row,'source':f'Supabase:{table}','business_name':row.get('business_name') or row.get('company') or row.get('business') or row.get('organization') or '', 'contact_name':row.get('contact_name') or row.get('name') or row.get('full_name') or '', 'email':row.get('email') or '', 'phone':row.get('phone') or row.get('phone_number') or '', 'message':row.get('message') or row.get('notes') or row.get('pain_point') or row.get('description') or '', 'created_at':row.get('created_at') or row.get('inserted_at') or row.get('timestamp') or ''})
else:
    sources.append({'source':'Supabase REST','status':'blocked/no_env','detail':'NEXT_PUBLIC_SUPABASE_URL or service/anon key unavailable in local env files'})

# Public endpoint probes (no auth)
for src,url in [('Omni AI health','https://omnileadsagi.com/api/health'),('Omni AI federation health','https://omnileadsagi.com/api/federation/health'),('Omni AI newsletter posts','https://omnileadsagi.com/api/newsletter/posts'),('CPS public site','https://wecanhelpout.com/')]:
    status,body,err=http_get(url,timeout=20)
    sources.append({'source':src,'endpoint':url,'status':'ok' if status and status<300 else 'blocked/error','http_status':status,'detail':err,'body_preview':body[:400]})

# Local SQLite discovery/read (bounded; avoid full portfolio recursive scan in cron runtime)
sqlite_paths=[
    CLIENTS/'Sitani Mafi/Omni AI/CEO/telegram-bot/omni_ai.db',
    CLIENTS/'Sitani Mafi/Imperium/telegram-bot/imperium.db',
    CLIENTS/'CPS/ai-ceo/cps.db',
    CLIENTS/'CPS/telegram-bot/cps.db',
]
for db in [p for p in sqlite_paths if p.exists()]:
    try:
        con=sqlite3.connect(str(db)); cur=con.cursor()
        tables=[r[0] for r in cur.execute("select name from sqlite_master where type='table'").fetchall()]
        lead_tables=[t for t in tables if re.search(r'lead|contact|booking|request|user|subscriber',t,re.I)]
        rec={'source':'local SQLite','path':str(db),'status':'ok','leadish_tables':lead_tables[:20]}
        for t in lead_tables[:5]:
            try:
                rows=cur.execute(f'select * from "{t}" limit 25').fetchall()
                cols=[d[0] for d in cur.description]
                rec.setdefault('table_counts',{})[t]=len(rows)
                for vals in rows:
                    row=dict(zip(cols,vals))
                    name=str(row.get('business_name') or row.get('company') or row.get('name') or row.get('username') or row.get('email') or '')
                    if name:
                        candidates.append({'raw':row,'source':f'SQLite:{db.name}:{t}','business_name':row.get('business_name') or row.get('company') or '', 'contact_name':row.get('contact_name') or row.get('name') or row.get('username') or '', 'email':row.get('email') or '', 'phone':row.get('phone') or '', 'message':row.get('message') or row.get('notes') or '', 'created_at':row.get('created_at') or row.get('timestamp') or ''})
            except Exception as e: rec.setdefault('table_errors',{})[t]=str(e)[:120]
        sources.append(rec); con.close()
    except Exception as e:
        sources.append({'source':'local SQLite','path':str(db),'status':'blocked/error','detail':str(e)[:160]})

# Repo lead-source route discovery for target clients
targets=[('Omni AI',OMNI/'Website'),('CPS',CLIENTS/'CPS/Website'),('Leifson Built',CLIENTS/'Leifson Built/Website'),('Youngs Cabinets',CLIENTS/'Youngs Cabinet Refinishing/Website'),('Imperium',CLIENTS/'Sitani Mafi/Imperium/Website'),('Alira',CLIENTS/'Alira/Website'),('North Peak Roofing',CLIENTS/'North Peak Roofing/Website'),('Omni Leads',CLIENTS/'Omni Leads/Website')]
for client,path in targets:
    evidence=[]
    if path.exists():
        for pat in ['**/api/**/*route.ts','**/*LeadForm*','**/*contact*','**/*estimate*','**/*booking*','**/*crm*']:
            for f in path.glob(pat):
                if f.is_file() and 'node_modules' not in str(f) and '.next' not in str(f): evidence.append(str(f.relative_to(path)))
    sources.append({'source':f'{client} repository lead-source discovery','path':str(path),'status':'ok' if path.exists() else 'missing','evidence':sorted(set(evidence))[:20],'crm_status':'needs CRM connection' if client!='Omni AI' else 'Supabase CRM checked above'})

# score, qualify, dedupe
def score_lead(c):
    score=0; reasons=[]
    text=' '.join(str(c.get(k,'') or '') for k in ['business_name','contact_name','email','phone','message','source']).lower()
    if c.get('business_name'): score+=18; reasons.append('business identified')
    elif c.get('contact_name'): score+=8; reasons.append('contact identified')
    if c.get('email') and '@' in str(c.get('email')): score+=15; reasons.append('reachable email')
    if c.get('phone'): score+=12; reasons.append('reachable phone')
    if any(w in text for w in ['demo','booking','consultation','estimate','quote','intake','contact']): score+=18; reasons.append('high-intent source/message')
    if any(w in text for w in ['urgent','asap','today','crisis','broken','need','help','quote','price','budget']): score+=14; reasons.append('urgency/budget signal')
    if any(w in text for w in ['business','agency','contractor','roof','cabinet','clinic','construction','marketing','lead','ai']): score+=11; reasons.append('business fit / likely close value')
    if len(str(c.get('message') or ''))>40: score+=8; reasons.append('meaningful context')
    return min(score,100), reasons

leads=[]
for c in candidates:
    key=dedupe_key(c); c['dedupe_key']=key
    if key in prior_ids: continue
    score,reasons=score_lead(c)
    if score<35: continue
    c['score']=score; c['score_reasons']=reasons
    c['label']='Hot' if score>=75 else 'Warm' if score>=55 else 'Nurture'
    # conservative public research placeholder if no outbound company domain discovered
    biz=c.get('business_name') or c.get('contact_name') or c.get('email')
    c['research']={'status':'limited/local-source-only','summary':f'Lead appeared in {c.get("source")}. No safe public company URL was included in the lead payload, so no external claims were added.', 'services':'needs public research before send' if not c.get('business_name') else 'inferred from submitted business/context only', 'location':'unknown unless present in CRM payload', 'recent_proof':'not verified', 'likely_pain_points':'needs faster lead follow-up / clearer conversion path', 'best_offer_angle':'Offer a quick Omni AI/CPS/client-specific lead-response audit tied to the form intent.'}
    first=f"Hi {c.get('contact_name') or 'there'} — thanks for reaching out{(' about '+c.get('business_name')) if c.get('business_name') else ''}. I can help route this to the right next step. What outcome are you trying to get first: more qualified leads, faster follow-up, or a cleaner website/booking flow?"
    follow="Quick follow-up — if useful, I can send over a short next-step recommendation after one look at your current website/funnel. No pressure; just want to make sure your request does not sit in limbo."
    c['outreach']={'first_message':first,'follow_up':follow,'internal_rationale':'; '.join(reasons)}
    leads.append(c)

# check approval records
approved=[]
for p in LOG_ROOT.glob('*approval*.*'):
    try:
        txt=p.read_text(errors='ignore').lower()
        if 'approved' in txt or 'approve' in txt: approved.append(str(p))
    except Exception: pass

out={
 'run_at':now.isoformat(),
 'since':'prior lead-engine logs under _agent-logs/lead-engine',
 'sources_checked':sources,
 'candidate_count':len(candidates),
 'new_qualified_count':len(leads),
 'leads':leads,
 'approved_prior_records_found':len(approved),
 'approval_records':approved[:20],
 'outbound_sent_count':0,
 'outbound_status':'No outbound sent; this workflow requires explicit Mafi approval and no executable approved channel record was found.',
 'crm_status':'needs CRM connection / queue written only. Supabase REST was attempted; no autonomous migrations or .env changes performed.',
 'blockers':[],
}
if any(s.get('status')=='blocked/error' and s.get('source')=='Supabase REST' for s in sources): out['blockers'].append('Supabase REST lead/business reads returned errors for one or more tables; CRM health is not fully proven.')
if len(leads)==0: out['blockers'].append('No new qualified, non-duplicate leads found in readable local/public sources today.')
json_path=LOG_ROOT/f'{day}_morning-lead-workflow.json'
csv_path=LOG_ROOT/f'{day}_morning-lead-workflow.csv'
out['queue_json']=str(json_path); out['queue_csv']=str(csv_path); out['updated_at']=datetime.now(timezone.utc).isoformat()
json_path.write_text(json.dumps(out,indent=2,default=str))
with csv_path.open('w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=['dedupe_key','label','score','business_name','contact_name','email','phone','source','crm_status','first_message','follow_up','internal_rationale'])
    w.writeheader()
    for l in leads:
        w.writerow({k:l.get(k,'') for k in ['dedupe_key','label','score','business_name','contact_name','email','phone','source']} | {'crm_status':'needs CRM connection','first_message':l['outreach']['first_message'],'follow_up':l['outreach']['follow_up'],'internal_rationale':l['outreach']['internal_rationale']})
print(json.dumps({'json':str(json_path),'csv':str(csv_path),'new_qualified_count':len(leads),'candidate_count':len(candidates),'supabase_statuses':[(s.get('table'),s.get('http_status')) for s in sources if s.get('source')=='Supabase REST'],'approved_records':len(approved)},indent=2))
