import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { findPublishedIssueForToday } from '../app/api/cron/newsletter/publication';

const now = new Date('2026-10-28T14:05:00.000Z');
const issue = {
  id: 'test-issue', slug: 'interlinked-free-2026-10-28',
  subject: 'Today', tier: 'free', published_at: now.toISOString(),
};

function database(respond: (url: URL, request: number) => Response) {
  const requests: URL[] = [];
  const supabase = createClient('https://newsletter.invalid', 'unit-test-no-runtime-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        assert.equal(init?.method ?? 'GET', 'GET', 'dedupe must be read-only');
        const url = new URL(String(input));
        requests.push(url);
        return respond(url, requests.length);
      },
    },
  });
  return { supabase, requests };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('a visible canonical issue skips generation without a second lookup', async () => {
  const db = database(() => json([issue]));
  assert.deepEqual(await findPublishedIssueForToday(db.supabase, 'free', now), issue);
  assert.equal(db.requests.length, 1);
  assert.equal(db.requests[0].searchParams.get('slug'), 'eq.interlinked-free-2026-10-28');
  assert.equal(db.requests[0].searchParams.get('status'), 'eq.published');
  assert.equal(db.requests[0].searchParams.get('published_at'), 'not.is.null');
});

test('a timestamped hidden draft cannot count as already published', async () => {
  const db = database((url) => json(url.searchParams.get('status') === 'eq.published' ? [] : [issue]));
  assert.equal(await findPublishedIssueForToday(db.supabase, 'free', now), null);
  assert.equal(db.requests.length, 2);
  for (const url of db.requests) {
    assert.equal(url.searchParams.get('status'), 'eq.published');
    assert.ok(url.searchParams.getAll('published_at').includes('not.is.null'));
  }
});

test('the fallback accepts a visible same-day issue and bounds its UTC day', async () => {
  const other = { ...issue, slug: 'editor-reviewed-issue' };
  const db = database((_url, request) => json(request === 1 ? [] : [other]));
  assert.deepEqual(await findPublishedIssueForToday(db.supabase, 'free', now), other);
  const url = db.requests[1];
  assert.equal(url.searchParams.get('tier'), 'eq.free');
  assert.equal(url.searchParams.get('status'), 'eq.published');
  assert.deepEqual(url.searchParams.getAll('published_at'), [
    'not.is.null', 'gte.2026-10-28T00:00:00.000Z', 'lt.2026-10-29T00:00:00.000Z',
  ]);
});

for (const failedRequest of [1, 2]) {
  test(`database failure in lookup ${failedRequest} blocks publication`, async () => {
    const db = database((_url, request) => request === failedRequest
      ? json({ code: '42501', message: 'test read rejected' }, 403) : json([]));
    await assert.rejects(findPublishedIssueForToday(db.supabase, 'premium', now),
      new RegExp(`Newsletter publication lookup failed \\(premium, ${failedRequest === 1 ? 'slug' : 'date'}\\)`));
    assert.equal(db.requests.length, failedRequest);
  });
}
