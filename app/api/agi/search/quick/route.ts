// Quick-search endpoint for the Cmd-K palette. Searches across leads,
// businesses, and meetings in one query, returns up to 20 results with
// type + URL so the palette can route the user.

import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface SearchResult {
  type: "lead" | "business" | "meeting";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  score: number; // higher = more relevant
}

export async function GET(req: NextRequest) {
  noStore();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  // Strip PostgREST .or() reserved chars (commas, parens) and SQL wildcards
  // (%, _) from the term so a Cmd-K query like "John, CTO" doesn't break the
  // filter parser, and so users typing % or _ get literal matching.
  const cleaned = q.replace(/[,()%_\\]/g, ' ').trim();
  if (!cleaned) return NextResponse.json({ results: [] });
  const term = `%${cleaned}%`;
  const lower = cleaned.toLowerCase();

  const [leadsR, bizsR, mtgsR] = await Promise.all([
    sb.from("omni_leads_generated")
      .select("id, first_name, last_name, email, company, business_id, score, status")
      .or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},company.ilike.${term}`)
      .limit(10),

    sb.from("omni_businesses")
      .select("id, name, industry, location, plan")
      .ilike("name", term)
      .limit(5),

    sb.from("omni_meeting_bookings")
      .select("id, attendee_name, attendee_email, start_at, status, business_id")
      .or(`attendee_name.ilike.${term},attendee_email.ilike.${term}`)
      .limit(5),
  ]);

  const results: SearchResult[] = [];

  // Leads — exact name/email match scores higher
  for (const l of leadsR.data ?? []) {
    const fullName = [l.first_name, l.last_name].filter(Boolean).join(" ");
    const matchStrength =
      (l.email?.toLowerCase().includes(lower) ? 3 : 0) +
      (fullName.toLowerCase().includes(lower) ? 2 : 0) +
      (l.company?.toLowerCase().includes(lower) ? 1 : 0);
    results.push({
      type: "lead",
      id: l.id,
      title: fullName || l.email || "Unknown lead",
      subtitle: [l.company, l.email, `score ${l.score}`].filter(Boolean).join(" · "),
      href: `/dashboard/leads?lead=${l.id}`,
      score: 50 + matchStrength * 5 + (l.score ?? 0) / 10,
    });
  }

  // Businesses
  for (const b of bizsR.data ?? []) {
    results.push({
      type: "business",
      id: b.id,
      title: b.name,
      subtitle: [b.plan, b.industry, b.location].filter(Boolean).join(" · "),
      href: `/dashboard/companies`,
      score: 70,
    });
  }

  // Meetings
  for (const m of mtgsR.data ?? []) {
    const start = new Date(m.start_at);
    results.push({
      type: "meeting",
      id: m.id,
      title: m.attendee_name,
      subtitle: `${start.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${m.status}`,
      href: `/dashboard/meetings`,
      score: 40,
    });
  }

  results.sort((a, b) => b.score - a.score);

  return NextResponse.json({ results: results.slice(0, 20) });
}
