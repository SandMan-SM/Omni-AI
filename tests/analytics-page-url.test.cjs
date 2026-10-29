const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/server/analytics-page-url.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,URL,decodeURIComponent});
const {resolveAnalyticsPageUrl:resolve}=m.exports;
const origin='https://lovethybarber.shop',allowed=[origin,'https://www.lovethybarber.shop'];
test('new relative page URLs and page_path use exact approved request origin with query and fragment removed',()=>{
 assert.equal(resolve('/contact?email=private@example.test#secret',undefined,origin,allowed),origin+'/contact');
 assert.equal(resolve(undefined,'/booking',origin,allowed),origin+'/booking');
 assert.equal(resolve('/booking',undefined,allowed[1],allowed),allowed[1]+'/booking');
});
test('relative paths never borrow a canonical or default domain for missing or foreign origins',()=>{
 for(const candidate of [null,'null','https://evil.test','https://lovethybarber.shop.evil.test','https://lovethybarber.shop/','https://lovethybarber.shop:443','http://lovethybarber.shop','https://user@lovethybarber.shop'])assert.equal(resolve('/contact',undefined,candidate,allowed),undefined,candidate);
 assert.equal(resolve('/contact',undefined,origin,[]),undefined);
});
test('relative protocol escapes, malformed paths and private routes cannot gain a production hostname',()=>{
 for(const path of ['//evil.test/path','/\\evil.test/path','/bad path','/bad\npath','/dashboard','/resources/../checkout','/%64ashboard','/contact%3Femail=private','/bad%ZZ','/'.repeat(2050)])assert.equal(resolve(path,undefined,origin,allowed),undefined,path);
});
test('existing absolute URL behavior remains unchanged without trusting its host for relative paths',()=>{
 const absolute='https://preview.example.test/contact?legacy=query';assert.equal(resolve(absolute,undefined,null,allowed),absolute);
 assert.equal(resolve(undefined,undefined,origin,allowed),undefined);
 assert.equal(resolve(undefined,'https://evil.test',origin,allowed),undefined);
});
