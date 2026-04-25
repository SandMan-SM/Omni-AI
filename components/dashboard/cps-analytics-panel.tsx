"use client";

/**
 * <CpsAnalyticsPanel />
 *
 * Mounted inside the main /dashboard page when the signed-in user is the
 * CPS account (username='cps'). Polls /api/dashboard/cps-data every 30s
 * and renders leads, calls counted, top pages, top buttons, and the
 * live event feed for psychandcustodyevaluations.com.
 *
 * Style follows the surrounding dashboard chrome — `Card` from
 * components/ui/card with bg-white/[0.03] border-white/[0.06].
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Phone,
  Mail,
  ExternalLink,
  TrendingUp,
  MousePointerClick,
  Eye,
  Users,
  Activity,
  RefreshCw,
} from "lucide-react";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  source: string;
  page_path: string | null;
  page_url: string | null;
  status: string;
  email_notified: boolean;
  telegram_notified: boolean;
  created_at: string;
};

type EventRow = {
  id: string;
  event_type: string;
  event_category: string;
  action: string;
  target_id: string | null;
  page_path: string | null;
  is_phone_click: boolean;
  phone_number: string | null;
  visitor_id: string | null;
  session_id: string | null;
  created_at: string;
};

type Payload = {
  leadsToday: number;
  leads7d: number;
  leads30d: number;
  pageViews7d: number;
  clicks7d: number;
  phoneClicksToday: number;
  phoneClicks7d: number;
  recentLeads: Lead[];
  recentEvents: EventRow[];
  topPages: { path: string; count: number }[];
  topClicks: { label: string; count: number }[];
  phoneClickRows: { phone_number: string | null; page_path: string | null; created_at: string }[];
  uniqueVisitorsSample: number;
  uniqueSessionsSample: number;
  fetchedAt: string;
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CpsAnalyticsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Pull the bearer token the dashboard uses for /api/campaigns etc.
        // Same omni_token format — we accept it server-side in /api/dashboard/cps-data.
        let bearer = "";
        try {
          bearer = localStorage.getItem("omni_token") || "";
        } catch {
          /* SSR / blocked */
        }

        const res = await fetch("/api/dashboard/cps-data", {
          headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Payload = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading && !data) {
    return (
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardContent className="p-6 text-sm text-gray-400 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading CPS analytics…
        </CardContent>
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardContent className="p-6 text-sm text-red-400">
          Couldn&apos;t load CPS analytics: {error || "no data"}
        </CardContent>
      </Card>
    );
  }

  const stats = [
    { label: "Leads today", value: data.leadsToday, icon: Users, accent: "text-emerald-400" },
    { label: "Leads this week", value: data.leads7d, icon: TrendingUp, accent: "text-emerald-400" },
    { label: "Calls today", value: data.phoneClicksToday, icon: Phone, accent: "text-blue-400" },
    { label: "Calls this week", value: data.phoneClicks7d, icon: Phone, accent: "text-blue-400" },
    { label: "Page views (7d)", value: data.pageViews7d, icon: Eye, accent: "text-violet-400" },
    { label: "Button clicks (7d)", value: data.clicks7d, icon: MousePointerClick, accent: "text-violet-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">CPS Live Analytics</h2>
          <p className="text-xs text-gray-500 mt-1">
            psychandcustodyevaluations.com · refreshes every 30s ·
            <span className="text-gray-600"> last updated {fmtTime(data.fetchedAt)}</span>
          </p>
        </div>
        <Activity className="w-5 h-5 text-emerald-400" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-white/[0.03] border-white/[0.06]">
              <CardContent className="p-4">
                <Icon className={`w-4 h-4 mb-3 ${s.accent}`} aria-hidden />
                <div className="text-2xl font-bold text-white">
                  {s.value.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">
                  {s.label}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent leads + Calls received */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white/[0.03] border-white/[0.06] lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="text-lg text-white">Recent leads</CardTitle>
            <span className="text-xs text-gray-500">{data.recentLeads.length} shown</span>
          </CardHeader>
          <CardContent>
            {data.recentLeads.length === 0 ? (
              <p className="text-sm text-gray-500">
                No leads yet. They&apos;ll appear here the moment a CPS contact form is submitted.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.recentLeads.map((l) => (
                  <li key={l.id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-white truncate">{l.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 uppercase tracking-wider">
                            {l.status}
                          </span>
                          <span className="text-[10px] text-gray-500">via {l.source}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-300">
                          {l.phone && (
                            <a
                              href={`tel:${l.phone}`}
                              className="inline-flex items-center gap-1 hover:text-white"
                            >
                              <Phone className="w-3 h-3" aria-hidden /> {l.phone}
                            </a>
                          )}
                          {l.email && (
                            <a
                              href={`mailto:${l.email}`}
                              className="inline-flex items-center gap-1 hover:text-white"
                            >
                              <Mail className="w-3 h-3" aria-hidden /> {l.email}
                            </a>
                          )}
                          {l.page_path && (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <ExternalLink className="w-3 h-3" aria-hidden /> {l.page_path}
                            </span>
                          )}
                        </div>
                        {l.message && (
                          <p className="mt-2 text-sm text-gray-400 whitespace-pre-wrap line-clamp-2">
                            {l.message}
                          </p>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 whitespace-nowrap">
                        {fmtTime(l.created_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-white">Calls received</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              tel: link clicks · last 7 days
            </p>
          </CardHeader>
          <CardContent>
            {data.phoneClickRows.length === 0 ? (
              <p className="text-sm text-gray-500">No phone clicks tracked yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.phoneClickRows.map((r, i) => (
                  <li
                    key={i}
                    className="text-sm flex items-center justify-between border-b border-white/5 pb-2"
                  >
                    <span className="inline-flex items-center gap-2 text-gray-200">
                      <Phone className="w-3 h-3 text-blue-400" aria-hidden />
                      {r.phone_number || "(801) 483-1600"}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {r.page_path || "/"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top pages + Top buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-white">Top pages</CardTitle>
            <p className="text-xs text-gray-500 mt-1">By page views · last 7 days</p>
          </CardHeader>
          <CardContent>
            {data.topPages.length === 0 ? (
              <p className="text-sm text-gray-500">No page views tracked yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.topPages.map((p) => (
                  <li
                    key={p.path}
                    className="flex items-center justify-between border-b border-white/5 pb-2"
                  >
                    <span className="text-sm text-gray-200 truncate mr-4">{p.path}</span>
                    <span className="text-sm font-semibold text-violet-300">{p.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-white">Top buttons clicked</CardTitle>
            <p className="text-xs text-gray-500 mt-1">By click count · last 7 days</p>
          </CardHeader>
          <CardContent>
            {data.topClicks.length === 0 ? (
              <p className="text-sm text-gray-500">No clicks tracked yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.topClicks.map((c) => (
                  <li
                    key={c.label}
                    className="flex items-center justify-between border-b border-white/5 pb-2"
                  >
                    <span className="text-sm text-gray-200 truncate mr-4">{c.label}</span>
                    <span className="text-sm font-semibold text-emerald-300">{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live event feed */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg text-white">Live event feed</CardTitle>
            <p className="text-xs text-gray-500 mt-1">Most recent 50 events</p>
          </div>
          <div className="text-xs text-gray-500">
            {data.uniqueVisitorsSample} visitors · {data.uniqueSessionsSample} sessions in sample
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/10">
                <th className="text-left font-semibold py-2">Time</th>
                <th className="text-left font-semibold py-2">Type</th>
                <th className="text-left font-semibold py-2">Target</th>
                <th className="text-left font-semibold py-2">Page</th>
              </tr>
            </thead>
            <tbody>
              {data.recentEvents.map((e) => (
                <tr key={e.id} className="border-b border-white/5">
                  <td className="py-2 text-gray-500 whitespace-nowrap">
                    {fmtTime(e.created_at)}
                  </td>
                  <td className="py-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        e.is_phone_click
                          ? "bg-blue-500/15 text-blue-300"
                          : e.event_type === "form_submit"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/10 text-gray-300"
                      }`}
                    >
                      {e.is_phone_click ? "phone_click" : e.event_type}
                    </span>
                  </td>
                  <td className="py-2 text-gray-300 max-w-[280px] truncate">
                    {e.target_id || "—"}
                  </td>
                  <td className="py-2 text-gray-500 max-w-[200px] truncate">
                    {e.page_path || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
