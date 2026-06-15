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
      <header className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
