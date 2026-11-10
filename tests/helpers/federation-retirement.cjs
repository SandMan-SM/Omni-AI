const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file, mocks = {}, context = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, URL, Buffer, require: name => {
    if (name in mocks) return mocks[name];
    if (name === 'server-only') return {};
    if (name.startsWith('.') && name.endsWith('.json')) return JSON.parse(fs.readFileSync(path.resolve(root, path.dirname(file), name), 'utf8'));
    return require(name);
  }, ...context }, { filename: file });
  return module.exports;
}
const retirement = load('lib/federation-retirement.ts');
const contacts = load('lib/server/federation-contact-retirement.ts', { '@/lib/federation-retirement': retirement });
module.exports = { load, retirement, contacts, retirementMocks: {
  './federation-retirement': retirement, '@/lib/federation-retirement': retirement,
  './server/federation-contact-retirement': contacts, '@/lib/server/federation-contact-retirement': contacts,
} };
