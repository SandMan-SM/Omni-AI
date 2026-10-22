import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribeToken } from '@/lib/server/cps-newsletter-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

function html(body: string, status = 200) {
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Clinical and Professional Solutions updates</title></head><body style="font-family:Arial,sans-serif;max-width:480px;margin:80px auto;padding:24px;color:#222">' + body + '</body></html>', { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function handle(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok || verified.kind !== 'nl' || verified.site !== 'cps') {
    return html('<h1>Invalid unsubscribe link</h1><p>Use the link in your Clinical and Professional Solutions email.</p>', 400);
  }
  try {
    const sb = createAdminClient();
    const { data, error } = await sb.rpc('unsubscribe_cps_newsletter', { p_email: verified.email });
    if (error || data !== true) {
      console.error('[cps-newsletter] unsubscribe could not be confirmed');
      return html('<h1>Unsubscribe could not be confirmed</h1><p>Please try again. No success was recorded.</p>', 503);
    }
    return html('<h1>Unsubscribed</h1><p>You will no longer receive Clinical and Professional Solutions updates.</p><p>If this was a mistake, you can subscribe again at <a href="https://cpsutah.org">cpsutah.org</a>.</p>');
  } catch {
    console.error('[cps-newsletter] unsubscribe service unavailable');
    return html('<h1>Unsubscribe could not be confirmed</h1><p>Please try again. No success was recorded.</p>', 503);
  }
}
export const GET = handle;
export const POST = handle;

