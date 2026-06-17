"use client";

import { ExternalLink, LogOut } from "lucide-react";
import type { DemoClient } from "@/lib/portal-demo-clients";
import {
  AdsReportWidget,
  ConversionRateWidget,
  FunnelWidget,
  GoogleAnalyticsWidget,
  GoogleBusinessProfileWidget,
  LeadSourceWidget,
  ManualActionsWidget,
  OpportunityStatusWidget,
  OpportunityValueWidget,
  SalesEfficiencyWidget,
  StageDistributionWidget,
  TasksWidget,
} from "@/components/portal/portal-widgets";

export function PortalDashboard({
  client,
  onLogout,
}: {
  client: DemoClient;
  onLogout: () => void;
}) {
  const m = client.metrics;
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_12px_40px_-18px_rgba(0,0,0,0.75)] sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[26px]">
              {client.businessName}
            </h1>
            <p className="mt-1 text-sm text-white/50">{client.vertical}</p>
            <p className="mt-2 text-sm">
              <span className="text-white/40">Asset: </span>
              <a
                href={`https://${client.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-300 hover:underline"
              >
                {client.website}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <OpportunityStatusWidget data={m.opportunities} />
        <OpportunityValueWidget data={m.opportunityValue} />
        <ConversionRateWidget data={m.conversion} />
        <FunnelWidget data={m.funnel} />
        <StageDistributionWidget data={m.stageDistribution} />
        <TasksWidget tasks={m.tasks} />
        <ManualActionsWidget data={m.manualActions} />
        <LeadSourceWidget data={m.leadSources} />
        <GoogleAnalyticsWidget data={m.googleAnalytics} />
        <GoogleBusinessProfileWidget data={m.googleBusinessProfile} />
        <AdsReportWidget
          title="Facebook Ads Report"
          data={m.facebookAds}
          accent="text-sky-300"
        />
        <AdsReportWidget
          title="Google Ads Report"
          data={m.googleAds}
          accent="text-amber-300"
        />
        <SalesEfficiencyWidget data={m.salesEfficiency} />
      </div>
    </div>
  );
}
