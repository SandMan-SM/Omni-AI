(function(){
 'use strict';
 if(window.__aisPortfolioAnalytics)return;
 window.__aisPortfolioAnalytics=true;
 if(navigator.globalPrivacyControl===true||navigator.doNotTrack==='1')return;
 var last='',session,script=document.currentScript;
 var local=script&&script.getAttribute('data-ais-local-metrics')==='true'&&script.src==='http://127.0.0.1:3002/portfolio-analytics.js'&&location.origin==='http://127.0.0.1:4024';
 var destination=local?'http://127.0.0.1:3002/api/public/portfolio-events':'https://omnileadsagi.com/api/public/portfolio-events';
 function id(prefix){var bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return prefix+Array.from(bytes,function(value){return value.toString(16).padStart(2,'0');}).join('');}
 try{session=sessionStorage.getItem('ais_public_session');if(!/^s_[a-f0-9]{32}$/.test(session||'')){session=id('s_');sessionStorage.setItem('ais_public_session',session);}}catch(e){session=id('s_');}
 function view(){
  var path=location.pathname;
  if(last===path||/^\/(api|_next|admin|dashboard|portal|login|auth|account|checkout|reset|unsubscribe|instagram)(\/|$)/i.test(path))return;
  last=path;
  var event={path:path,session:session,event:id('e_')};
  if(local||new URLSearchParams(location.search).get('ais_metrics_test')==='1')event.test=true;
  try{fetch(destination,{method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),keepalive:true}).catch(function(){});}catch(e){}
 }
 ['pushState','replaceState'].forEach(function(name){var original=history[name];history[name]=function(){var result=original.apply(this,arguments);queueMicrotask(view);return result;};});
 addEventListener('popstate',view);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',view,{once:true});else view();
})();
