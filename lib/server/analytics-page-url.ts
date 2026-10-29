/** Resolve future relative tracker paths using an exact tenant-approved origin.
 * Existing absolute URLs retain their legacy behavior; no fallback hostname is
 * invented when Origin is absent, foreign, or malformed. Queries never enter a
 * newly resolved URL. Historical rows are deliberately untouched.
 */
export function resolveAnalyticsPageUrl(pageUrl:string|undefined,pagePath:unknown,origin:string|null,allowedOrigins:readonly string[]):string|undefined{
 if(pageUrl&&!pageUrl.startsWith('/'))return pageUrl;
 const path=pageUrl||(typeof pagePath==='string'?pagePath:undefined);
 if(!path||path.length>2048||!path.startsWith('/')||path.startsWith('//')||/[\\\x00-\x20]/.test(path))return undefined;
 if(!origin||!allowedOrigins.includes(origin))return undefined;
 try{
  const base=new URL(origin);
  if(base.protocol!=='https:'||base.port||base.username||base.password||base.origin!==origin)return undefined;
  const url=new URL(path,base.origin);
  if(url.origin!==base.origin)return undefined;
  const pathname=decodeURIComponent(url.pathname);
  if(/[\\?#\x00-\x20]/.test(pathname)||/^\/(api|_next|admin|dashboard|portal|login|auth|account|checkout|reset|unsubscribe|instagram)(\/|$)/i.test(pathname))return undefined;
  return `${base.origin}${url.pathname}`;
 }catch{return undefined;}
}
