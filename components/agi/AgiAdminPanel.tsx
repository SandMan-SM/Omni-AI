"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Target, Bot, Brain, Inbox as InboxIcon, Send, Building2, BookOpen,
  BarChart3, Calendar, TrendingUp, Activity, Upload, Settings as SettingsIcon,
  Zap, CreditCard, ChevronDown, Sparkles, Award, Trophy, Mail,
  Crown, MessageSquare,
} from "lucide-react";

// Dynamic imports of each AGI page — lazy-loaded so first paint is fast.
// Each page is a self-contained client component already; we just render
// its default export inside the tab body.
const LeadsView      = dynamic(() => import("@/app/dashboard/leads/page"),     { ssr: false, loading: () => <Skel /> });
const InboxView      = dynamic(() => import("@/app/dashboard/inbox/page"),     { ssr: false, loading: () => <Skel /> });
const OutreachView   = dynamic(() => import("@/app/dashboard/outreach/page"),  { ssr: false, loading: () => <Skel /> });
const CompaniesView  = dynamic(() => import("@/app/dashboard/companies/page"), { ssr: false, loading: () => <Skel /> });
const CampaignsView  = dynamic(() => import("@/app/dashboard/campaigns/page"), { ssr: false, loading: () => <Skel /> });
const TemplatesView  = dynamic(() => import("@/app/dashboard/templates/page"), { ssr: false, loading: () => <Skel /> });
const AnalyticsView  = dynamic(() => import("@/app/dashboard/analytics/page"), { ssr: false, loading: () => <Skel /> });
const PipelineView   = dynamic(() => import("@/app/dashboard/pipeline/page"),  { ssr: false, loading: () => <Skel /> });
// SponsorView and AffiliateView are now imported by app/dashboard/pipeline/page.tsx
// — they render as sub-sections of the Pipeline tab rather than standalone tabs.
const HeatmapView    = dynamic(() => import("@/app/dashboard/heatmap/page"),   { ssr: false, loading: () => <Skel /> });
const MeetingsView   = dynamic(() => import("@/app/dashboard/meetings/page"),  { ssr: false, loading: () => <Skel /> });
const AutopilotView  = dynamic(() => import("@/app/dashboard/autopilot/page"), { ssr: false, loading: () => <Skel /> });
const CoachView      = dynamic(() => import("@/app/dashboard/coach/page"),     { ssr: false, loading: () => <Skel /> });
const RunsView       = dynamic(() => import("@/app/dashboard/runs/page"),      { ssr: false, loading: () => <Skel /> });
const ImportView     = dynamic(() => import("@/app/dashboard/import/page"),    { ssr: false, loading: () => <Skel /> });
const SettingsView   = dynamic(() => import("@/app/dashboard/settings/page"),  { ssr: false, loading: () => <Skel /> });
const BillingView    = dynamic(() => import("@/app/dashboard/billing/page"),   { ssr: false, loading: () => <Skel /> });
const SiteAnalyticsRouterView = dynamic(() => import("@/components/dashboard/site-analytics-router"), { ssr: false, loading: () => <Skel /> });
const ClientArenaView = dynamic(() => import("@/components/agi/ClientArenaPanel").then(m => ({ default: m.ClientArenaPanel })), { ssr: false, loading: () => <Skel /> });

// Newsletter management tab: existing admin studio component (subscriber
// audience, premium tier, send job preview, CSV import/export).
const NewsletterView = dynamic(
  () => import("@/components/newsletter-studio").then(m => ({ default: m.NewsletterStudio })),
  { ssr: false, loading: () => <Skel /> }
);

// Per-tenant client newsletter view — read-only list scoped to the active
// workspace's business_id via /api/newsletter/scoped-posts. No subscribers,
// no sends, no payment-link surface; clients edit via email request.
const ClientNewsletterView = dynamic(
  () => import("@/components/newsletter-studio/ClientNewsletterStudio").then(m => ({ default: m.ClientNewsletterStudio })),
  { ssr: false, loading: () => <Skel /> }
);

// Council tab — the Pantheon roster + active leadership stewards. Visible
// to admins and per-tenant clients alike (read-only platform identity
// surface; no per-tenant data exposed). Reads /api/council.
const CouncilView = dynamic(
  () => import("@/components/agi/CouncilPanel").then(m => ({ default: m.CouncilPanel })),
  { ssr: false, loading: () => <Skel /> }
);

// Dialogue tab — Pantheon members talking to each other in response to
// system_findings + intel_digest. Cron writes new threads every 30 min.
// Reads /api/council/dialogue.
const DialogueView = dynamic(
  () => import("@/components/agi/DialoguePanel").then(m => ({ default: m.DialoguePanel })),
  { ssr: false, loading: () => <Skel /> }
);

// Arena management tab: lightweight admin wrapper around the existing
// arena components (Leaderboard, RankingTiers, BadgeShowcase) without the
// public marketing page chrome (hero, footer, modals).
const ArenaView = dynamic(() => import("./AgiArenaManager").then(m => ({ default: m.AgiArenaManager })), {
  ssr: false, loading: () => <Skel />,
});

function Skel() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-12 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-emerald-500/40 border-t-emerald-500 animate-spin" />
    </div>
  );
}

// Closure helpers used by the Arena and Newsletter tabs to switch their
// inner view based on the panel's isAdmin prop. We can't conditionally
// pass adminOnly to the TABS array (the panel reads that flag at module
// scope), so the routing happens inside the view component instead.
function makeArenaView(isAdmin: boolean): React.ComponentType {
  if (isAdmin) return ArenaView;
  return ClientArenaView;
}
function makeNewsletterView(isAdmin: boolean): React.ComponentType {
  // Admins keep the full NewsletterStudio (subscribers, stats, sends,
  // payment links). Per-tenant client viewers (Brent / Adam / Sammy /
  // CPS-owner) get the read-only ClientNewsletterStudio scoped to their
  // workspace via /api/newsletter/scoped-posts. Editing is request-based
  // for now — the API gate (omni_business_users membership) is the
  // first line of defence; the component is the second.
  if (isAdmin) return NewsletterView;
  return ClientNewsletterView;
}

const TABS: Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  view: React.ComponentType;
  group: "core" | "engage" | "intel" | "ops";
  /** When true, the tab only renders while the active workspace is Omni AI. */
  omniOnly?: boolean;
  /** When true, the tab only renders while the active workspace is CPS. */
  cpsOnly?: boolean;
  /** When true, renders only for client workspaces (cps/youngs/leifson/ltb). */
  clientOnly?: boolean;
  /** When true, the tab only renders for admins (hidden for non-admin viewers). */
  adminOnly?: boolean;
}> = [
  { id: "leads",      label: "Contacts",    icon: Target,         view: LeadsView,      group: "core" },
  { id: "outreach",   label: "Outreach",    icon: Send,           view: OutreachView,   group: "engage" },
  { id: "inbox",      label: "Inbox",       icon: InboxIcon,      view: InboxView,      group: "engage" },
  { id: "coach",      label: "Coach",       icon: Brain,          view: CoachView,      group: "intel" },
  { id: "pipeline",   label: "Pipeline",    icon: Award,          view: PipelineView,   group: "core" },
  // Sponsors and Affiliates are now sub-sections inside the Pipeline tab —
  // operator switches between Contacts / Sponsors / Affiliates pipelines
  // via the in-page section switcher rather than three separate tabs.
  { id: "meetings",   label: "Meetings",    icon: Calendar,       view: MeetingsView,   group: "engage" },
  { id: "newsletter", label: "Newsletter",  icon: Mail,           view: NewsletterView, group: "engage" },
  { id: "arena",      label: "Arena",       icon: Trophy,         view: ArenaView,      group: "engage" },
  { id: "council",    label: "Council",     icon: Crown,          view: CouncilView,    group: "engage" },
  { id: "dialogue",   label: "Dialogue",    icon: MessageSquare,  view: DialogueView,   group: "engage" },
  { id: "companies",  label: "Companies",   icon: Building2,      view: CompaniesView,  group: "intel",  adminOnly: true },
  { id: "campaigns",  label: "Campaigns",   icon: TrendingUp,     view: CampaignsView,  group: "core",   adminOnly: true },
  { id: "templates",  label: "Templates",   icon: BookOpen,       view: TemplatesView,  group: "core",   adminOnly: true },
  { id: "heatmap",    label: "Heatmap",     icon: Activity,       view: HeatmapView,    group: "intel",  adminOnly: true },
  { id: "analytics",  label: "Analytics",   icon: BarChart3,      view: AnalyticsView,  group: "intel",  adminOnly: true },
  { id: "site-analytics", label: "Site Analytics", icon: Activity, view: SiteAnalyticsRouterView, group: "intel", clientOnly: true },
  { id: "autopilot",  label: "Autopilot",   icon: Bot,            view: AutopilotView,  group: "ops",    adminOnly: true },
  { id: "runs",       label: "Runs",        icon: Zap,            view: RunsView,       group: "ops",    adminOnly: true },
  { id: "import",     label: "Import",      icon: Upload,         view: ImportView,     group: "core",   adminOnly: true },
  { id: "settings",   label: "Settings",    icon: SettingsIcon,   view: SettingsView,   group: "ops",    adminOnly: true },
  { id: "billing",    label: "Billing",     icon: CreditCard,     view: BillingView,    group: "ops",    adminOnly: true },
];

const GROUP_COLORS: Record<string, string> = {
  core:   "text-emerald-400",
  engage: "text-purple-400",
  intel:  "text-blue-400",
  ops:    "text-orange-400",
};

export function AgiAdminPanel({
  isAdmin = true,
  pinnedWorkspaceSlug = null,
}: {
  isAdmin?: boolean;
  /** Slug to auto-pin the workspace to for non-admin viewers (cps|youngs|leifson|ltb). */
  pinnedWorkspaceSlug?: string | null;
} = {}) {
  const [active, setActive] = useState("leads");
  const [activeBizId, setActiveBizId] = useState<string | null>(null);
  const [omniAiBizId, setOmniAiBizId] = useState<string | null>(null);
  const [businessNames, setBusinessNames] = useState<Record<string, string>>({});
  const [businessSlugs, setBusinessSlugs] = useState<Record<string, string>>({});
  // Ordered list backing the admin-only header dropdown. Same source
  // as businessNames but keeps loadBusinesses()'s display_order so the
  // dropdown matches the rest of the dashboard.
  const [businessList, setBusinessList] = useState<{ id: string; name: string }[]>([]);
  const tabsScrollRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  // Track which business is selected globally (used to hide Omni-AI-only tabs).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setActiveBizId(localStorage.getItem("omni_active_business_id"));
    sync();
    const onStorage = (ev: StorageEvent) => { if (ev.key === "omni_active_business_id") sync(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Resolve all business names + slugs once so the header can label whichever
  // workspace is active without an extra round-trip on each switch.
  // Goes through /api/dashboard/businesses because omni_businesses is
  // RLS-locked to service_role — the previous direct supabase call
  // returned zero rows for every viewer, which silently broke the
  // header label (always "All") and the omni-only tab gates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { loadBusinesses } = await import("@/lib/dashboard-businesses");
        const { data } = await loadBusinesses();
        if (cancelled || !data) return;
        const nameMap: Record<string, string> = {};
        const slugMap: Record<string, string> = {};
        for (const b of data) {
          nameMap[b.id] = b.name;
          if (b.slug) slugMap[b.id] = b.slug.toLowerCase();
        }
        setBusinessNames(nameMap);
        setBusinessSlugs(slugMap);
        setBusinessList(data.map(b => ({ id: b.id, name: b.name })));
        const omni = data.find(b => b.name === "Omni AI");
        if (omni) setOmniAiBizId(omni.id);
        // Non-admin viewers get their workspace pinned on mount so leads /
        // pipeline / site-analytics / newsletter scope to their data instead
        // of defaulting to the Omni AI view.
        if (!isAdmin && pinnedWorkspaceSlug && typeof window !== "undefined") {
          const current = window.localStorage.getItem("omni_active_business_id");
          if (!current || current === "all") {
            const target = data.find(b =>
              b.slug?.toLowerCase() === pinnedWorkspaceSlug ||
              b.name?.toLowerCase() === pinnedWorkspaceSlug,
            );
            if (target) {
              window.localStorage.setItem("omni_active_business_id", target.id);
              setActiveBizId(target.id);
              // Dispatch a synthetic storage event so the lazy-loaded sub-pages
              // (LeadsView, InboxView, OutreachView, etc.) see the pin even
              // though localStorage.setItem in the same tab doesn't fire a
              // native storage event. Without this, a client viewer like
              // Sammy logs in, the pinning runs, but the Contacts tab still
              // shows All-businesses (320 leads instead of LTB's 2).
              window.dispatchEvent(new StorageEvent("storage", {
                key: "omni_active_business_id",
                newValue: target.id,
                oldValue: null,
                storageArea: window.localStorage,
              }));
            }
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [isAdmin, pinnedWorkspaceSlug]);

  // Omni-AI-only tabs (Sponsors, Affiliates) only appear when the admin
  // explicitly selects the Omni AI workspace — not when "All" is active.
  const isOmniAi = omniAiBizId !== null && activeBizId === omniAiBizId;
  const activeWorkspaceSlug = activeBizId
    ? (businessSlugs[activeBizId] ?? businessNames[activeBizId]?.toLowerCase() ?? null)
    : null;
  const CLIENT_SLUGS = new Set(["cps", "youngs", "leifson", "ltb", "prime_iv"]);
  const isCPS = activeWorkspaceSlug === "cps";
  const isClientWorkspace = !!activeWorkspaceSlug && CLIENT_SLUGS.has(activeWorkspaceSlug);
  const visibleTabs = TABS.filter(t =>
    (!t.omniOnly || isOmniAi) &&
    (!t.cpsOnly || isCPS) &&
    (!t.clientOnly || isClientWorkspace) &&
    (!t.adminOnly || isAdmin),
  );

  // Header title — reflects whichever workspace the global switcher chose.
  // null and "all" both mean "show everything" → label as "All".
  const headerTitle = (!activeBizId || activeBizId === "all")
    ? "All"
    : (businessNames[activeBizId] ?? "All");

  // If the active tab gets hidden after switching workspaces, fall back to leads.
  useEffect(() => {
    if (!visibleTabs.find(t => t.id === active)) setActive("leads");
  }, [visibleTabs, active]);

  const activeTabDef = visibleTabs.find(t => t.id === active);
  // Arena and Newsletter tabs route their inner view based on isAdmin so
  // client viewers (CPS, Brent, Adam, Sammy) get the scoped panels and
  // admins keep the full management surfaces.
  const ActiveView = activeTabDef?.id === "arena"
    ? makeArenaView(isAdmin)
    : activeTabDef?.id === "newsletter"
      ? makeNewsletterView(isAdmin)
      : activeTabDef?.view;

  // Auto-scroll the active tab into view when the tab changes — the tab strip
  // overflows on mobile, so without this users can lose track of which tab
  // they're on after switching surfaces.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [active]);

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.03] via-purple-500/[0.02] to-blue-500/[0.03] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">{headerTitle}</h2>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300">
                Agentic
              </span>
            </div>
            <p className="text-[11px] text-gray-400 -mt-0.5">
              Self-driving lead generation · {visibleTabs.length} surfaces
            </p>
          </div>
        </div>
        {/* Workspace selector — admin-only. Lets Sita switch which
            tenant's agentic dashboard is active without leaving the
            panel. Writes to localStorage + fires a synthetic storage
            event so every sub-page (LeadsView / PipelineView /
            analytics / etc) rescopes immediately. */}
        {isAdmin && businessList.length > 0 && (
          <label className="flex items-center gap-2 text-[11px] text-gray-400">
            <span className="uppercase tracking-[0.18em]">Workspace</span>
            <select
              value={activeBizId && activeBizId !== "all" ? activeBizId : "all"}
              onChange={(e) => {
                if (typeof window === "undefined") return;
                const next = e.target.value;
                const prev = window.localStorage.getItem("omni_active_business_id");
                window.localStorage.setItem("omni_active_business_id", next);
                window.dispatchEvent(new StorageEvent("storage", {
                  key: "omni_active_business_id",
                  newValue: next,
                  oldValue: prev,
                  storageArea: window.localStorage,
                }));
                setActiveBizId(next);
              }}
              className="bg-zinc-900/80 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white hover:border-emerald-400/50 focus:border-emerald-400 focus:outline-none cursor-pointer min-w-[160px]"
              data-testid="workspace-selector"
              aria-label="Switch workspace"
            >
              <option value="all">All Businesses</option>
              {businessList.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Tabs */}
      <div className="agi-tabs-wrapper relative border-b border-white/5">
        <div
          ref={tabsScrollRef}
          className="agi-tabs-scroll px-3 py-2 sm:py-2 overflow-x-auto overflow-y-hidden"
          style={{ scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center gap-1 min-w-max">
            {visibleTabs.map(t => {
              const Icon = t.icon;
              const isActive = active === t.id;
              const groupColor = GROUP_COLORS[t.group];
              return (
                <button
                  key={t.id}
                  ref={isActive ? activeTabRef : null}
                  onClick={() => setActive(t.id)}
                  className={`agi-tab-btn flex items-center gap-1.5 px-3 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                    ${isActive
                      ? "bg-white/10 text-white border border-white/20"
                      : `text-gray-400 hover:text-white hover:bg-white/5 border border-transparent`}`}
                  style={{ scrollSnapAlign: "center" }}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? groupColor : ""}`} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Edge-fade gradients tell mobile users the strip is scrollable */}
        <div className="agi-tabs-fade agi-tabs-fade-left pointer-events-none absolute top-0 left-0 h-full w-6 bg-gradient-to-r from-black/60 to-transparent" />
        <div className="agi-tabs-fade agi-tabs-fade-right pointer-events-none absolute top-0 right-0 h-full w-6 bg-gradient-to-l from-black/60 to-transparent" />
      </div>

      {/* Content - render the active view inline.
          Each AGI page brings its own header + nav + 100vh background.
          When embedded, we hide the inner header (the panel's tabs ARE the nav)
          and collapse the inner full-height background so it sits inside the panel cleanly. */}
      <div
        className="agi-embedded-view bg-black/20"
        // Tabs without their own page-level padding (Newsletter Studio,
        // Arena Manager) need wrapper padding so content doesn't touch the
        // panel border. Tabs with internal `padding: 32` (the legacy
        // sub-pages) already handle their own spacing.
        data-needs-pad={active === "newsletter" || active === "arena" ? "1" : "0"}
      >
        <style jsx global>{`
          .agi-embedded-view[data-needs-pad="1"] {
            padding: 20px 24px;
          }
          @media (max-width: 640px) {
            .agi-embedded-view[data-needs-pad="1"] {
              padding: 14px 16px;
            }
          }

          /* ── Tab strip — slim scrollbar so the indicator doesn't push content ── */
          .agi-tabs-scroll::-webkit-scrollbar {
            height: 4px;
          }
          .agi-tabs-scroll::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.1);
            border-radius: 2px;
          }
          .agi-tabs-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.2);
          }
          .agi-tabs-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          /* Tap-friendly tabs on mobile */
          @media (max-width: 768px) {
            .agi-tab-btn {
              padding: 8px 12px !important;
              font-size: 12px !important;
              min-height: 36px;
            }
            .agi-tab-btn svg {
              width: 14px !important;
              height: 14px !important;
            }
            .agi-tabs-scroll {
              padding: 6px 8px !important;
            }
            .agi-tabs-fade {
              width: 18px !important;
            }
          }
          @media (max-width: 480px) {
            .agi-tab-btn {
              padding: 8px 10px !important;
            }
          }

          .agi-embedded-view > div {
            min-height: 0 !important;
            background: transparent !important;
          }
          .agi-embedded-view > div > header,
          .agi-embedded-view > div > div > header,
          .agi-embedded-view header[style*="height: 60"] {
            display: none !important;
          }
          /* ── Mobile: cascade-shrink every inner sub-page when embedded ── */
          @media (max-width: 768px) {
            /* Outer page wrappers — kill the 32px padding that pushes content
               past viewport edge, and force inner max-width to 100% so cards
               don't overflow horizontally. */
            .agi-embedded-view [style*="padding: 32"],
            .agi-embedded-view [style*="padding:32"],
            .agi-embedded-view [style*="padding: '32px'"],
            .agi-embedded-view [style*="padding:'32px'"] {
              padding: 16px !important;
              max-width: 100% !important;
              box-sizing: border-box;
            }
            /* Anything with maxWidth > viewport on mobile must yield. */
            .agi-embedded-view [style*="maxWidth: 1400"],
            .agi-embedded-view [style*="maxWidth: 1200"],
            .agi-embedded-view [style*="maxWidth: 1100"],
            .agi-embedded-view [style*="max-width: 1400"],
            .agi-embedded-view [style*="max-width: 1200"],
            .agi-embedded-view [style*="max-width: 1100"] {
              max-width: 100% !important;
            }
            /* The embedded view itself: stop horizontal overflow at the panel
               boundary so nothing inside can paint past it. */
            .agi-embedded-view {
              overflow-x: hidden;
            }
            .agi-embedded-view > div,
            .agi-embedded-view > div > div {
              max-width: 100% !important;
              box-sizing: border-box;
            }
            .agi-embedded-view [style*="grid-template-columns: repeat(4"],
            .agi-embedded-view [style*="gridTemplateColumns: 'repeat(4"] {
              grid-template-columns: repeat(2, 1fr) !important;
            }
            .agi-embedded-view [style*="grid-template-columns: repeat(3"],
            .agi-embedded-view [style*="gridTemplateColumns: 'repeat(3"] {
              grid-template-columns: 1fr !important;
            }
            .agi-embedded-view [style*="font-size: 36"],
            .agi-embedded-view [style*="fontSize: 36"] {
              font-size: 26px !important;
            }
            .agi-embedded-view table {
              font-size: 12px !important;
            }

            /* Tags / badges / chips — universal cascade for embedded sub-pages */
            .agi-embedded-view .agi-tag,
            .agi-embedded-view [class*="agi-tag-"],
            .agi-embedded-view [style*="border-radius: 4"][style*="background"][style*="padding: 3px"],
            .agi-embedded-view [style*="border-radius:4"][style*="background"][style*="padding:3px"] {
              font-size: 11px !important;
              padding: 4px 10px !important;
              border-radius: 6px !important;
              line-height: 1.3 !important;
              display: inline-flex !important;
              align-items: center !important;
              white-space: nowrap;
            }
            /* Score / status circles — touch-friendly */
            .agi-embedded-view .agi-score-circle.agi-score-sm {
              width: 36px !important;
              height: 36px !important;
              font-size: 12px !important;
            }
            .agi-embedded-view .agi-score-circle.agi-score-lg {
              width: 60px !important;
              height: 60px !important;
              font-size: 20px !important;
            }
            /* Filter / status buttons — touch targets */
            .agi-embedded-view .agi-filter-btn,
            .agi-embedded-view .agi-status-btn {
              padding: 8px 14px !important;
              font-size: 12px !important;
              min-height: 32px !important;
            }
            /* Generic small inline pill patterns inside embedded pages */
            .agi-embedded-view button[style*="font-size: 11"][style*="padding"],
            .agi-embedded-view span[style*="font-size: 10"][style*="padding"][style*="border-radius"] {
              font-size: 11px !important;
              padding: 4px 9px !important;
              border-radius: 6px !important;
            }
          }
        `}</style>
        {ActiveView && <ActiveView />}
      </div>
    </div>
  );
}
