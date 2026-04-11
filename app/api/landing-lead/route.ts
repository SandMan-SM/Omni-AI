import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const { name, phone, email, slug } = body as {
      name: string;
      phone: string;
      email: string;
      slug: string;
    };

    if (!name || !phone || !email || !slug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const pageUrl = `${SITE_URL}/${slug}`;

    // 1. Check newsletter subscription
    const { data: sub } = await supabase
      .from("newsletter_subscriptions")
      .select("subscribed, subscription_tier")
      .eq("email", email.toLowerCase().trim())
      .single();

    const isSubscriber = sub?.subscribed === true;
    const tier = sub?.subscription_tier || "none";

    // 2. Insert lead into Supabase
    await supabase.from("landing_page_leads").insert({
      slug,
      name: name.trim(),
      phone: phone.trim(),
      email: email.toLowerCase().trim(),
      is_newsletter_subscriber: isSubscriber,
    });

    // 3. Notify owner
    await sendEmail(
      OWNER_EMAIL,
      `New Lead from omnileadsagi.com/${slug}`,
      `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <h2 style="margin-bottom:4px;">New lead from <a href="${pageUrl}" style="color:#6366f1;">${pageUrl}</a></h2>
        <p style="color:#555;margin-top:0;">Submitted via the landing page form.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:20px;">
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;width:120px;">Name</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${name}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${phone}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;"><a href="mailto:${email}" style="color:#6366f1;">${email}</a></td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">Newsletter</td><td style="padding:10px 0;border-bottom:1px solid #eee;">${isSubscriber ? `✅ Subscribed (${tier})` : "❌ Not subscribed"}</td></tr>
          <tr><td style="padding:10px 0;font-weight:600;">Landing Page</td><td style="padding:10px 0;"><a href="${pageUrl}" style="color:#6366f1;">${pageUrl}</a></td></tr>
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
          You're in, ${name.split(" ")[0]}.
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
