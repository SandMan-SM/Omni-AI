const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function collector(initialPath) {
  const sent = [], listeners = {}, documentListeners = {}, values = new Map();
  const location = { origin: 'https://aisempire.org', pathname: initialPath, search: '?tab=content-studio' };
  const navigate = (_state, _unused, path) => { location.pathname = path; };
  const context = { window: {}, navigator: {}, location, URL, URLSearchParams, Uint8Array, crypto: webcrypto,
    document: { readyState: 'complete', currentScript: null, querySelector: () => null,
      addEventListener: (name, fn) => { documentListeners[name] = fn; } },
    history: { pushState: navigate, replaceState: navigate },
    sessionStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    addEventListener: (name, fn) => { listeners[name] = fn; }, queueMicrotask: fn => fn(),
    fetch: async (_url, options) => { sent.push(JSON.parse(options.body)); return {}; },
  };
  vm.runInNewContext(fs.readFileSync('public/portfolio-analytics.js', 'utf8'), context);
  return { context, sent, listeners, documentListeners, location };
}

test('direct CRM and nested CRM pages never send public analytics', () => {
  for (const path of ['/crm', '/crm/content-studio', '/CRM/content-studio', '/dashboard']) {
    const f = collector(path);
    assert.equal(f.sent.length, 0, path);
    f.documentListeners.click({ button: 0, target: { closest: () => { throw Error('Private click must exit before inspecting an element'); } } });
    assert.equal(f.sent.length, 0, path);
  }
});

test('client pushState, replaceState and popstate into CRM stay excluded after a public page loads', () => {
  const f = collector('/');
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].path, '/');
  f.context.history.pushState({}, '', '/crm');
  f.context.history.replaceState({}, '', '/crm/content-studio');
  f.listeners.popstate();
  assert.equal(f.sent.length, 1);
  f.context.history.pushState({}, '', '/contact');
  assert.equal(f.sent.length, 2); assert.equal(f.sent[1].path, '/contact');
  assert.ok(f.sent.every(event => !event.path.startsWith('/crm')));
});

test('public pages whose names merely start with crm remain measurable', () => {
  const f = collector('/crm-services');
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].path, '/crm-services');
});
