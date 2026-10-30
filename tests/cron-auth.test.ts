import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertCronCaller } from '../lib/cron';

/**
 * The cron gate used to accept `User-Agent: vercel-cron/1.0` as proof of
 * caller identity. A request header is chosen by the caller, so that was an
 * authentication bypass — verified live against production before the fix
 * (an unauthenticated request with the header returned 200 and ran the
 * handler). The bearer is now the only accepted credential, and an unset
 * CRON_SECRET fails closed.
 */

function request(headers: Record<string, string>): Request {
  return new Request('https://omnileadsagi.com/api/cron/nightly-intel', { headers });
}

test('the legacy vercel-cron user-agent is not a credential', () => {
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'a-real-shared-secret';
  try {
    const result = assertCronCaller(request({ 'user-agent': 'vercel-cron/1.0' }));
    assert.equal(result.ok, false, 'a spoofed user-agent must not authorize');
    assert.equal(result.ok === false && result.response.status, 401);
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});

test('the correct bearer authorizes', () => {
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'a-real-shared-secret';
  try {
    const result = assertCronCaller(request({ authorization: 'Bearer a-real-shared-secret' }));
    assert.equal(result.ok, true);
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});

test('a wrong bearer is rejected', () => {
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'a-real-shared-secret';
  try {
    const result = assertCronCaller(request({ authorization: 'Bearer wrong' }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.response.status, 401);
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});

test('an empty bearer is rejected', () => {
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'a-real-shared-secret';
  try {
    const result = assertCronCaller(request({ authorization: 'Bearer ' }));
    assert.equal(result.ok, false);
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});

test('an unset CRON_SECRET fails closed instead of allowing the caller', () => {
  const saved = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const result = assertCronCaller(request({ 'user-agent': 'vercel-cron/1.0' }));
    assert.equal(result.ok, false, 'no secret configured must not mean "allow"');
    assert.equal(result.ok === false && result.response.status, 503);
  } finally {
    if (saved !== undefined) process.env.CRON_SECRET = saved;
  }
});
