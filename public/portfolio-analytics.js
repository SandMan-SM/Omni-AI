(function(){
 'use strict';
 if(window.__aisPortfolioAnalytics)return;
 window.__aisPortfolioAnalytics=true;
 if(navigator.globalPrivacyControl===true||navigator.doNotTrack==='1')return;
 var last='',session,script=document.currentScript;
 var local=script&&script.getAttribute('data-ais-local-metrics')==='true'&&script.src==='http://127.0.0.1:3002/portfolio-analytics.js'&&location.origin==='http://127.0.0.1:4024';
 var destination=local?'http://127.0.0.1:3002/api/public/portfolio-events':'https://omnileadsagi.com/api/public/portfolio-events';
 var privatePath=/^\/(api|_next|admin|dashboard|portal|login|auth|account|checkout|reset|unsubscribe|instagram)(\/|$)/i;
 window.__aisPortfolioAnalyticsCapabilities={version:2,pageViews:true,ctaClicks:true};
 function id(prefix){var bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return prefix+Array.from(bytes,function(value){return value.toString(16).padStart(2,'0');}).join('');}
 try{session=sessionStorage.getItem('ais_public_session');if(!/^s_[a-f0-9]{32}$/.test(session||'')){session=id('s_');sessionStorage.setItem('ais_public_session',session);}}catch(e){session=id('s_');}
 function send(extra){
  var path=location.pathname;if(privatePath.test(path))return;
  var event=Object.assign({path:path,session:session,event:id('e_')},extra||{});
  if(local||new URLSearchParams(location.search).get('ais_metrics_test')==='1')event.test=true;
  try{fetch(destination,{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),keepalive:true}).catch(function(){});}catch(e){}
 }
 function view(){var path=location.pathname;if(last===path||privatePath.test(path))return;last=path;send({collector_version:2,cta_tracking:nativeOwnsClicks()?'native':'measured'});}
 function nativeOwnsClicks(){
  if(window.__aisCtaAnalyticsOwner==='native')return true;
  if(script&&script.getAttribute('data-ais-cta-owner')==='native')return true;
  return !!(document.querySelector&&document.querySelector('html[data-ais-cta-owner="native"],body[data-ais-cta-owner="native"],script[data-ais-cta-owner="native"],script[src*="/embed/inbound-tracker.js"][data-slug]'));
 }
 function click(event){
  if(privatePath.test(location.pathname)||nativeOwnsClicks()||(typeof event.button==='number'&&event.button!==0))return;
  var target=event.target;if(target&&typeof target.closest!=='function')target=target.parentElement;
  var element=target&&target.closest&&target.closest('[data-cta],[data-track],a[href]');if(!element)return;
  if(element.closest('[data-ais-cta-owner="native"],[data-ais-cta-ignore]')||element.getAttribute('aria-hidden')==='true')return;
  var semantic=element.hasAttribute('data-cta')||element.hasAttribute('data-track'),href=element.getAttribute('href')||'',kind='',url;
  if(/^tel:/i.test(href))kind='phone';else if(/^sms:/i.test(href))kind='sms';else if(/^mailto:/i.test(href))kind='email';
  else{
   if(href)try{url=new URL(href,location.origin);if(!/^https?:$/.test(url.protocol)||url.username||url.password||(url.port&&!(local&&url.origin===location.origin))||privatePath.test(url.pathname))url=null;}catch(e){url=null;}
   if(url&&/^(buy|checkout|billing)\.stripe\.com$/.test(url.hostname))kind='checkout';
   if(url&&url.origin===location.origin){if(/^\/contact(\/|$)/i.test(url.pathname))kind='contact';else if(/^\/(book|booking)(\/|$)/i.test(url.pathname))kind='booking';else if(/^\/apply(\/|$)/i.test(url.pathname))kind='application';}
   if(!kind&&semantic){var label=(element.getAttribute('data-cta')||element.getAttribute('data-track')||'').toLowerCase();kind=/book|schedule|calendar|demo/.test(label)?'booking':/apply|application/.test(label)?'application':/contact/.test(label)?'contact':'cta';}
  }
  if(!kind)return;
  var payload={type:'cta_click',subtype:kind,collector_version:2,cta_tracking:'measured'};
  if(url){payload.destination_host=local&&url.origin===location.origin?'aisempire.org':url.hostname;if(url.origin===location.origin)payload.destination_path=url.pathname;}
  send(payload);
 }
 if(document.addEventListener)document.addEventListener('click',click,{capture:true});
 ['pushState','replaceState'].forEach(function(name){var original=history[name];history[name]=function(){var result=original.apply(this,arguments);queueMicrotask(view);return result;};});
 addEventListener('popstate',view);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',view,{once:true});else view();
})();
