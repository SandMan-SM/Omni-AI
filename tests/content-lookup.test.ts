import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lookupContent, requireLookup } from '../lib/server/content-lookup.ts';

/**
 * The classifier that keeps a failed database read from answering 404.
 *
 * Every shape below is a response Supabase actually returns. The two that
 * matter most:
 *
 *   - `.single()` with NO rows answers `{ data: null, error: PGRST116 }`.
 *     PostgREST cannot represent "no rows" as `application/vnd.pgrst.object+json`,
 *     so it answers 406 with an error instead. Reading that error as a
 *     FAILURE makes a route serve 500 for a page that does not exist —
 *     which is exactly what the first version of the classifier did, and
 *     what the live probe suite caught the day it shipped.
 *   - `.single()` with MORE than one row answers the same code. It must
 *     not become a 404: that is a data-integrity failure, not an absence.
 */

const noRow = { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
const manyRows = {
  data: null,
  error: {
    code: 'PGRST116',
    message: 'JSON object requested, multiple (or no) rows returned',
    details: 'Results contain 2 rows, application/vnd.pgrst.object+json requires 1 row',
  },
};
const timeout = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };
const denied = { data: null, error: { code: '42501', message: 'permission denied for table' } };
const empty = { data: null, error: null };
const found = { data: { id: 'row-1' }, error: null };

test('a single() read that found no row is an absence, not a failure', async () => {
  const result = await lookupContent(async () => noRow);
  assert.equal(result.kind, 'missing');
});

test('a single() read that found more than one row is a failure, never a 404', async () => {
  const result = await lookupContent(async () => manyRows);
  assert.equal(result.kind, 'failed');
});

test('a maybeSingle() read that found no row is an absence', async () => {
  const result = await lookupContent(async () => empty);
  assert.equal(result.kind, 'missing');
});

test('a statement timeout is a failure', async () => {
  const result = await lookupContent(async () => timeout);
  assert.equal(result.kind, 'failed');
});

test('a permission error is a failure', async () => {
  const result = await lookupContent(async () => denied);
  assert.equal(result.kind, 'failed');
});

test('a rejected read is a failure', async () => {
  const result = await lookupContent(async () => {
    throw new Error('the connection dropped');
  });
  assert.equal(result.kind, 'failed');
});

test('a row that exists is found', async () => {
  const result = await lookupContent(async () => found);
  assert.equal(result.kind, 'found');
});

test('requireLookup returns the row when the lookup found one', () => {
  const row = requireLookup({ kind: 'found', value: { id: 'row-1' } });
  assert.deepEqual(row, { id: 'row-1' });
});

test('requireLookup returns null for a genuine absence', () => {
  assert.equal(requireLookup({ kind: 'missing' }), null);
});

test('requireLookup throws for a failed lookup, so the route can never reach notFound()', () => {
  assert.throws(
    () => requireLookup({ kind: 'failed', error: { code: '57014' } }),
    /content lookup failed/,
  );
});
