const assert = require("node:assert/strict");
const { registerHooks } = require("node:module");
const { test } = require("node:test");
const { NextRequest } = require("next/server");

// Next.js provides this marker in its server bundle. The tests import the
// route directly in Node and never load it into a client bundle.
const serverMarker = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const postHandler = import("../app/api/reader/route.ts").then(({ POST }) => POST)
  .finally(() => serverMarker.deregister());

async function probe(host, origin, forwardedHost) {
  const headers = new Headers({ host, "content-type": "application/json" });
  if (origin) headers.set("origin", origin);
  if (forwardedHost) headers.set("x-forwarded-host", forwardedHost);
  // The honeypot returns before creating a code, writing a row, or sending mail.
  const POST = await postHandler;
  return POST(new NextRequest("https://omnileadsagi.com/api/reader", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "request", website: "bot-filled" }),
  }));
}

test("reader accepts HTTPS submissions on each matching public host", async () => {
  for (const host of ["interlinked.news", "omnileadsagi.com", "www.omnileadsagi.com"]) {
    const response = await probe(host, `https://${host}`);
    assert.equal(response.status, 200, host);
    assert.equal((await response.json()).step, "code", host);
  }
});

test("reader rejects crossed origins, forwarded host spoofing, and noncanonical HTTPS origins", async () => {
  const rejected = [
    ["interlinked.news", "https://omnileadsagi.com"],
    ["omnileadsagi.com", "https://interlinked.news"],
    ["interlinked.news", "https://www.interlinked.news"],
    ["interlinked.news", "https://interlinked.news.attacker.invalid"],
    ["interlinked.news", "http://interlinked.news"],
    ["interlinked.news:444", "https://interlinked.news:444"],
    ["interlinked.news", "https://interlinked.news:444"],
    ["interlinked.news", "https://user@interlinked.news"],
    ["interlinked.news", "https://interlinked.news/extra"],
    ["interlinked.news", "null"],
    ["interlinked.news", undefined],
    ["preview.example.test", "https://interlinked.news", "interlinked.news"],
    ["127.0.0.1:3118", "http://127.0.0.1:3118"],
  ];
  for (const [host, origin, forwarded] of rejected) {
    assert.equal((await probe(host, origin, forwarded)).status, 403, `${host} ${origin}`);
  }
});

test("reader development accepts only the matching HTTP loopback origin", async () => {
  const environment = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "development" });
  try {
    for (const host of ["localhost:3118", "127.0.0.1:3118"]) {
      assert.equal((await probe(host, `http://${host}`)).status, 200, host);
    }
    assert.equal((await probe("localhost:3118", "http://localhost:3119")).status, 403);
    assert.equal((await probe("localhost:3118", "http://localhost:3118/extra")).status, 403);
    assert.equal((await probe("localhost:3118", "https://localhost:3118")).status, 403);
  } finally {
    if (environment === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: environment });
  }
});
