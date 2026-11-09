const fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require('typescript');
// Host-side metadata extractor. Run only after resolving federation.surfaces.
// Never deploy from folder names; --registry must be an explicit read-only registry export.
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const at=arg.indexOf('=');return [arg.slice(2,at),arg.slice(at+1)];}));
if(!args.registry)throw Error('Required: --registry=/absolute/path/to/federation-surfaces.json');
const output=path.resolve(args.output||path.join(__dirname,'../lib/newsletter-source-catalog.generated.json'));
const dbSlugs=args['database-slugs']?JSON.parse(fs.readFileSync(path.resolve(args['database-slugs']),'utf8')):{};
const rows=JSON.parse(fs.readFileSync(path.resolve(args.registry),'utf8')).filter(x=>x.role==='primary');
const C={
 achatwithliz:{name:'A Chat with Liz',niche:'relationships',module:'lib/newsletter.ts',export:'ISSUES',route:'/newsletter/',family:'json-issues',archive:'/newsletter',date:'2026-09-17'},
 aisempire:{name:'AIS Empire',niche:'artificial-intelligence',module:'lib/articles.ts',export:'ARTICLES',route:'/newsletter/',family:'ts-articles',archive:'/newsletter'},
 beehive:{name:'Beehive Biz Pulse',niche:'utah-business',family:'newsroom-db-markdown',archive:'/archive',route:'/posts/',masthead:'beehive'},
 cpsutah:{name:'Clinical and Professional Solutions',niche:'health-and-community',module:'lib/posts.ts',export:'POSTS',route:'/blog/',family:'ts-posts',archive:'/blog'},
 cps:{name:'CPS Evaluations',niche:'health',module:'lib/posts.ts',export:'POSTS',route:'/blog/',family:'ts-posts',archive:'/blog'},
 gmsekingsavage:{name:'GMSE King Savage',niche:'music',module:'lib/newsletter.ts',export:'POSTS',route:'/newsletter/',family:'ts-letter-posts',archive:'/newsletter'},
 leadfranchise:{name:'Lead Franchise',niche:'business',family:'leadfranchise-db',archive:'/newsletter',route:'/newsletter/'},
 mafiempire:{name:'Mafi Empire',niche:'business',module:'lib/editorial.ts',export:'ARTICLES',route:'/newsletter/',family:'ts-editorial',archive:'/newsletter'},
 omnileads:{name:'Omni AI',niche:'artificial-intelligence',family:'newsletter-posts-db',archive:'/newsletter',route:'/newsletter/'},
 omnios:{name:'Omni OS',niche:'artificial-intelligence',module:'lib/editorial.ts',export:'ARTICLES',route:'/articles/',family:'ts-editorial',archive:'/articles'},
 rene:{name:'Rene Laveau',niche:'music',module:'lib/newsletter.ts',export:'POSTS',route:'/newsletter/',family:'ts-letter-posts',archive:'/newsletter'},
 imperium:{name:'Imperium',niche:'leadership',family:'empty-public-newsletter',archive:'/newsletter',issue:'Newsletter section exists; public letters intentionally unavailable pending tenant-scoped publication contract'},
 sitanim:{name:'Sitani Mafi',niche:'leadership',module:'lib/data.ts',export:'NEWSLETTER_ISSUES',route:'/newsletter/',family:'ts-newsletter-issues',archive:'/newsletter'},
 tanielafiefia:{name:'The Concrete Operator',niche:'construction',module:'lib/newsletter.ts',export:'issues',route:'/newsletter/',family:'ts-issues',archive:'/newsletter'},
 wasatch:{name:'The Wasatch Post',niche:'utah-news',family:'newsroom-db-markdown',archive:'/archive',route:'/posts/',masthead:'wasatch'},
 utahaddiction:{name:'Utah Addiction Centers Eagle Mountain',niche:'health',module:'lib/posts.ts',export:'POSTS',route:'/blog/',family:'ts-posts',archive:'/blog'},
 mainst:{name:'Utah Main Street',niche:'utah-news',family:'newsroom-db-markdown',archive:'/archive',route:'/posts/',masthead:'mainst'},
 ltb:{name:'Love Thy Barber',niche:'beauty-and-grooming',module:'app/blog/blog-data.ts',export:'BLOG_POSTS',route:'/blog/',family:'ts-blog-posts',archive:'/blog'},
 youngs:{name:'Youngs Cabinet Refinishing',niche:'home-improvement',module:'lib/newsletter.ts',export:'newsletterPosts',route:'/newsletter/',family:'ts-newsletter-posts',archive:'/newsletter'},
};
for(const [slug,name,niche] of [['deptofcreatvs','Dept. of Creatvs','fashion'],['hiddencamerastudios','Hidden Camera Studios','media'],['lanretealone','Lanrete Alone','music'],['luxurybran','Luxury Bran','fashion'],['masondayy','Maison Dayy','fashion'],['sfdempire','SFD Empire','music'],['societyfeen','Society Feen','fashion'],['theluxesocialist','The Luxe Socialist','fashion']])C[slug]={name,niche,module:'lib/news.ts',export:'NEWS_ARTICLES',route:'/news/',family:'ix-news-content',archive:'/news'};

function moduleLoader(root){
 const cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file).exports;
  if(!file.startsWith(root+path.sep))throw Error('outside_root');
  if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));
  const m={exports:{}};cache.set(file,m);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const req=spec=>{
   if(spec==='server-only')return {};
   if(!(spec.startsWith('.')||spec.startsWith('@/')))throw Error('external_import:'+spec);
   const start=spec.startsWith('@/')?path.join(root,spec.slice(2)):path.resolve(path.dirname(file),spec);
   const target=[start,start+'.ts',start+'.tsx',start+'.json',path.join(start,'index.ts')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
   if(!target)throw Error('missing_import:'+spec);
   return load(target);
  };
  const ctx=vm.createContext({module:m,exports:m.exports,require:req,URL,Date});
  new vm.Script(code,{filename:path.relative(root,file)}).runInContext(ctx,{timeout:3000});
  return m.exports;
 }
 return load;
}
function iso(v){if(typeof v!=='string'||!v)return null;let t=new Date(v);return Number.isFinite(t.getTime())?t.toISOString():null;}
function texts(v){if(typeof v==='string')return v;if(Array.isArray(v))return v.filter(x=>typeof x==='string').join(' ');return null;}
const posts=[],sources=[],inventory=[];
function add(sourceId,p,route,defaultDate){
 const title=texts(p.title)||texts(p.question)||texts(p.subject)||texts(p.seoTitle);
 if(typeof p.slug!=='string'||!title)throw Error('article_metadata_missing_slug_or_title');
 const tags=[...(Array.isArray(p.tags)?p.tags:[]),...(Array.isArray(p.keywords)?p.keywords:[]),p.category,p.kind,p.topic].filter(x=>typeof x==='string'&&x.trim());
 const rawPreview=texts(p.excerpt)||texts(p.description)||texts(p.preview)||texts(p.deck)||texts(p.intro)||texts(p.introduction)||null;
 const preview=rawPreview?.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').slice(0,421)||null;
 posts.push({sourceId,key:'static:'+p.slug,slug:p.slug,title,status:'published',publishedAt:iso(p.publishedAt||p.published||p.publishedDate||p.date||defaultDate),createdAt:null,tags:[...new Set(tags)],preview,path:route+p.slug});
}
for(const r of rows){
 // Imperium's authority is its Git root; Vercel's verified app root is Website.
 // Both forms remain readable without consulting a legacy tenantless store.
 const root=r.tenant_slug==='imperium'&&!fs.existsSync(path.join(r.codebase_path,'src/lib/newsletter-public.ts'))&&fs.existsSync(path.join(r.codebase_path,'Website/src/lib/newsletter-public.ts'))?path.join(r.codebase_path,'Website'):r.codebase_path;
 let c=C[r.tenant_slug];
 if(r.tenant_slug==='imperium'&&fs.existsSync(path.join(root,'src/lib/newsletter-public.ts'))){
  c={name:'Imperium',niche:'leadership',module:'src/lib/newsletter-public.ts',export:'PUBLIC_NEWSLETTER_ARTICLES',route:'/newsletter/',family:'ts-articles',archive:'/newsletter'};
 }
 const s={id:r.tenant_slug,name:c?.name||r.domain,siteUrl:'https://'+r.domain,niche:c?.niche||'other',available:!!c};
 const inv={...r,siteUrl:s.siteUrl,channel:c?.name||r.domain,niche:s.niche,adapter:c?.family||'none',sourceModule:c?.module||null,sourceExport:c?.export||null,archivePath:c?.archive||null,articleRoute:c?.route?c.route+'[slug]':null,requiresDeploy:!!c&&!['newsroom-db-markdown','leadfranchise-db','newsletter-posts-db'].includes(c.family),status:'inspected-canonical-source'};
 if(!c){s.state='absent';s.issue='No newsletter or news archive found';sources.push(s);inventory.push(inv);continue;}
 if(c.issue){s.available=false;s.issue=c.issue;}
 if(c.module){
  try{
   const mod=moduleLoader(root)(path.join(root,c.module));const data=mod[c.export];
   if(!Array.isArray(data))throw Error('export_not_array');
   data.forEach(p=>add(s.id,p,c.route,c.date||mod.EDITORIAL_DATE));inv.staticCount=data.length;
   if(s.id==='achatwithliz'&&fs.existsSync(path.join(root,'lib/general-news.ts'))){
    const news=moduleLoader(root)(path.join(root,'lib/general-news.ts')).GENERAL_NEWS;
    if(!Array.isArray(news))throw Error('general_news_export_not_array');
    news.forEach(p=>add(s.id,p,c.route));inv.staticCount+=news.length;
   }
  }catch(e){s.available=false;s.issue='Static archive metadata could not be extracted';inv.error='static_archive_extraction_failed';}
 }
 if(c.family==='newsroom-db-markdown'){
  try{
   const yaml=require('js-yaml');
   const matter=raw=>({data:yaml.load((raw.match(/^---\s*\n([\s\S]*?)\n---/)||[])[1]||'',{schema:yaml.JSON_SCHEMA})||{}});
   const mirrors=new Set(dbSlugs[c.masthead]||[]);
   const dir=path.join(root,'posts');let count=0;
   for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.md'))){
    const slug=name.slice(0,-3);if(mirrors.has(slug))continue;
    const d=matter(fs.readFileSync(path.join(dir,name),'utf8')).data;
    const title=d.title||d.lead_headline||d.headline||d.subject||d.feature?.title||d.lead?.title||d.signal?.title||d.brief?.title||d.name||slug;
    add(s.id,{...d,slug,title,description:d.dek||d.lead_dek||d.description},c.route);count++;
   }
   inv.staticCount=count;inv.sourceModule='lib/posts.ts + posts/*.md';
   // Separate native feature archive, not mirrored by newsroom_posts.
   const f=path.join(root,c.masthead==='wasatch'?'data/wasatch-feature-stories.json':c.masthead==='beehive'?'lib/features.ts':'lib/agent-features.ts');
   if(fs.existsSync(f)){
    const data=f.endsWith('.json')?JSON.parse(fs.readFileSync(f,'utf8')):(c.masthead==='mainst'?moduleLoader(root)(f).AGENT_FEATURES:moduleLoader(root)(f).FEATURES);
    if(Array.isArray(data))data.forEach(p=>add(s.id,p,'/features/','2026-10-16'));
   }
   const spotlights=path.join(root,'data/spotlights.ts');
   if(fs.existsSync(spotlights)){
    const data=moduleLoader(root)(spotlights).SPOTLIGHTS;
    if(Array.isArray(data))data.forEach(p=>add(s.id,{...p,title:p.title||p.headline||p.name,description:p.summary},'/spotlight/',p.publishedAt||p.date));
   }
  }catch(e){s.available=false;s.issue='Markdown archive inventory incomplete';inv.error='markdown_archive_extraction_failed';}
 }
 s.state=c.family==='empty-public-newsletter'?'restricted':s.available?'archive':'unavailable';
 sources.push(s);inventory.push(inv);
}
// Same tenant can appear under two primary domains in federation; retain one source per tenant.
const uniqueSources=Array.from(new Map(sources.map(x=>[x.id,x])).values());
const uniquePosts=Array.from(new Map(posts.map(x=>[x.sourceId+':'+x.path,x])).values());
const out={generatedAt:new Date().toISOString(),sources:uniqueSources,posts:uniquePosts};
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
if(args.inventory)fs.writeFileSync(path.resolve(args.inventory),JSON.stringify({generatedAt:out.generatedAt,surfaces:inventory},null,2)+'\n');
console.log(JSON.stringify({sources:uniqueSources.length,posts:uniquePosts.length,errors:inventory.filter(x=>x.error).map(x=>({domain:x.domain,error:x.error})),families:inventory.reduce((a,x)=>(a[x.adapter]=(a[x.adapter]||0)+1,a),{}),counts:uniqueSources.filter(x=>x.available).map(s=>({source:s.id,count:uniquePosts.filter(p=>p.sourceId===s.id).length}))},null,2));
