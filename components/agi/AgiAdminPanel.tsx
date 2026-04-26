"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Target, Bot, Brain, Inbox as InboxIcon, Send, Building2, BookOpen,
  BarChart3, Calendar, TrendingUp, Activity, Upload, Settings as SettingsIcon,
  Zap, CreditCard, ChevronDown, Sparkles, Award,
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
const HeatmapView    = dynamic(() => import("@/app/dashboard/heatmap/page"),   { ssr: false, loading: () => <Skel /> });
const MeetingsView   = dynamic(() => import("@/app/dashboard/meetings/page"),  { ssr: false, loading: () => <Skel /> });
const AutopilotView  = dynamic(() => import("@/app/dashboard/autopilot/page"), { ssr: false, loading: () => <Skel /> });
const CoachView      = dynamic(() => import("@/app/dashboard/coach/page"),     { ssr: false, loading: () => <Skel /> });
const RunsView       = dynamic(() => import("@/app/dashboard/runs/page"),      { ssr: false, loading: () => <Skel /> });
const ImportView     = dynamic(() => import("@/app/dashboard/import/page"),    { ssr: false, loading: () => <Skel /> });
const SettingsView   = dynamic(() => import("@/app/dashboard/settings/page"),  { ssr: false, loading: () => <Skel /> });
const BillingView    = dynamic(() => import("@/app/dashboard/billing/page"),   { ssr: false, loading: () => <Skel /> });

function Skel() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-12 flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-emerald-500/40 border-t-emerald-500 animate-spin" />
    </div>
  );
}

const TABS: Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  view: React.ComponentType;
  group: "core" | "engage" | "intel" | "ops";
}> = [
  { id: "leads",      label: "Leads",       icon: Target,         view: LeadsView,      group: "core" },
  { id: "outreach",   label: "Outreach",    icon: Send,           view: OutreachView,   group: "engage" },
  { id: "inbox",      label: "Inbox",       icon: InboxIcon,      view: InboxView,      group: "engage" },
  { id: "coach",      label: "Coach",       icon: Brain,          view: CoachView,      group: "intel" },
  { id: "pipeline",   label: "Pipeline",    icon: Award,          view: PipelineView,   group: "core" },
  { id: "meetings",   label: "Meetings",    icon: Calendar,       view: MeetingsView,   group: "engage" },
  { id: "companies",  label: "Companies",   icon: Building2,      view: CompaniesView,  group: "intel" },
  { id: "campaigns",  label: "Campaigns",   icon: TrendingUp,     view: CampaignsView,  group: "core" },
  { id: "templates",  label: "Templates",   icon: BookOpen,       view: TemplatesView,  group: "core" },
  { id: "heatmap",    label: "Heatmap",     icon: Activity,       view: HeatmapView,    group: "intel" },
  { id: "analytics",  label: "Analytics",   icon: BarChart3,      view: AnalyticsView,  group: "intel" },
  { id: "autopilot",  label: "Autopilot",   icon: Bot,            view: AutopilotView,  group: "ops" },
  { id: "runs",       label: "Runs",        icon: Zap,            view: RunsView,       group: "ops" },
  { id: "import",     label: "Import",      icon: Upload,         view: ImportView,     group: "core" },
  { id: "settings",   label: "Settings",    icon: SettingsIcon,   view: SettingsView,   group: "ops" },
  { id: "billing",    label: "Billing",     icon: CreditCard,     view: BillingView,    group: "ops" },
];

const GROUP_COLORS: Record<string, string> = {
  core:   "text-emerald-400",
  engage: "text-purple-400",
  intel:  "text-blue-400",
  ops:    "text-orange-400",
};

export function AgiAdminPanel() {
  const [active, setActive] = useState("leads");
  const ActiveView = TABS.find(t => t.id === active)?.view;

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
              <h2 className="text-base font-bold text-white">Omni AI</h2>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300">
                Agentic
              </span>
            </div>
            <p className="text-[11px] text-gray-400 -mt-0.5">
              Self-driving lead generation · {TABS.length} surfaces
            </p>
          </div>
        </div>
        <a
          href="/admin/info"
          className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
        >
          How it works →
        </a>
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 border-b border-white/5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = active === t.id;
            const groupColor = GROUP_COLORS[t.group];
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                  ${isActive
                    ? "bg-white/10 text-white border border-white/20"
                    : `text-gray-400 hover:text-white hover:bg-white/5 border border-transparent`}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? groupColor : ""}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content - render the active view inline.
          Each AGI page brings its own header + nav + 100vh background.
          When embedded, we hide the inner header (the panel's tabs ARE the nav)
          and collapse the inner full-height background so it sits inside the panel cleanly. */}
      <div className="agi-embedded-view bg-black/20">
        <style jsx global>{`
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
            .agi-embedded-view [style*="padding: 32"],
            .agi-embedded-view [style*="padding:32"],
            .agi-embedded-view [style*="padding: '32px'"] {
              padding: 16px !important;
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
          }
        `}</style>
        {ActiveView && <ActiveView />}
      </div>
    </div>
  );
}
