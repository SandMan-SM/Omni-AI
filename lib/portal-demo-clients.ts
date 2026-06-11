// /portal demo client dashboards — hardcoded sample accounts.
//
// This is intentionally NOT wired to the real auth stack (lib/auth.ts /
// user_credentials / Supabase). The portal renders demo dashboards with
// sample data for showcase purposes, so credentials live here as plain
// strings and the dashboard reads everything from this file. Do not
// "upgrade" this to real auth — if a client needs a live dashboard,
// that's /dashboard, not /portal.

export interface AdsReport {
  clicks: number;
  spend: number;
  cpc: number;
  ctrPct: number;
}

export interface PipelineStage {
  stage: string;
  count: number;
}

export interface ValueBar {
  label: string;
  value: number;
}

export interface LeadSourceRow {
  source: string;
  totalLeads: number;
  totalValue: number;
  open: number;
  won: number;
  lost: number;
  abandoned: number;
  winPct: number;
}

export interface DemoTask {
  title: string;
  status: "pending" | "completed";
  due?: string;
}

export interface DemoMetrics {
  opportunities: { total: number; won: number; lost: number; open: number };
  opportunityValue: { total: number; bars: ValueBar[] };
  conversion: { ratePct: number; wonRevenue: number };
  funnel: { pipelineName: string; stages: PipelineStage[] };
  stageDistribution: { total: number; stages: PipelineStage[] };
  tasks: DemoTask[];
  manualActions: { phone: number; sms: number; pending: number };
  leadSources: { rows: LeadSourceRow[]; total: number; trendPct: number | null };
  googleAnalytics: {
    visitors: number;
    sessions: number;
    pageViews: number;
    bounceRatePct: number;
  };
  googleBusinessProfile: {
    views: number;
    searches: number;
    clicks: number;
    bookings: number;
  };
  facebookAds: AdsReport;
  googleAds: AdsReport;
  salesEfficiency: {
    avgSalesDurationDays: number;
    avgTimeToWonDays: number;
    salesVelocityPerMonth: number;
  };
}

export interface DemoClient {
  username: string;
  password: string;
  businessName: string;
  website: string;
  vertical: string;
  metrics: DemoMetrics;
}

export const DEMO_CLIENTS: DemoClient[] = [
  // ── 1. Jaime — Prime IV Sandy ─────────────────────────────────────
  // Numbers mirror the real GHL dashboard screenshot exactly. Do not
  // re-balance these when tuning other accounts.
  {
    username: "jaime",
    password: "drip123",
    businessName: "Prime IV Sandy",
    website: "livebetteronthedrip.com",
    vertical: "IV Hydration & Wellness",
    metrics: {
      opportunities: { total: 205, won: 106, lost: 99, open: 0 },
      opportunityValue: {
        total: 5870,
        bars: [
          { label: "New Lead", value: 1070 },
          { label: "Problem Aware Lead", value: 925 },
          { label: "Called", value: 880 },
          { label: "Drips / Booked", value: 760 },
          { label: "No Show / Cancel", value: 580 },
          { label: "Member", value: 540 },
          { label: "Account Frozen", value: 320 },
          { label: "Failed Membership Payment", value: 290 },
          { label: "Membership Payment Settled", value: 255 },
          { label: "Did Not Contact", value: 250 },
        ],
      },
      conversion: { ratePct: 51.71, wonRevenue: 1960 },
      funnel: {
        pipelineName: "Sandy Scheduling Pipeline",
        stages: [
          { stage: "New Lead", count: 62 },
          { stage: "Problem Aware Lead", count: 38 },
          { stage: "Called", count: 31 },
          { stage: "Drips / Booked", count: 24 },
          { stage: "No Show / Cancel", count: 14 },
          { stage: "Member", count: 12 },
          { stage: "Account Frozen", count: 6 },
          { stage: "Failed Membership Payment", count: 4 },
          { stage: "Membership Payment Settled", count: 5 },
          { stage: "Did Not Contact", count: 9 },
        ],
      },
      stageDistribution: {
        total: 205,
        stages: [
          { stage: "New Lead", count: 62 },
          { stage: "Problem Aware Lead", count: 38 },
          { stage: "Called", count: 31 },
          { stage: "Drips / Booked", count: 24 },
          { stage: "No Show / Cancel", count: 14 },
          { stage: "Member", count: 12 },
          { stage: "Account Frozen", count: 6 },
          { stage: "Failed Membership Payment", count: 4 },
          { stage: "Membership Payment Settled", count: 5 },
          { stage: "Did Not Contact", count: 9 },
        ],
      },
      tasks: [
        {
          title:
            "Follow up with lead who showed interest but didn't continue the conversation",
          status: "pending",
          due: "Jun 12",
        },
      ],
      manualActions: { phone: 0, sms: 0, pending: 0 },
      leadSources: {
        total: 205,
        trendPct: 245,
        rows: [
          {
            source: "$79 intro offer - gb-ly",
            totalLeads: 92,
            totalValue: 2630,
            open: 0,
            won: 47,
            lost: 45,
            abandoned: 0,
            winPct: 51.09,
          },
          {
            source: "Direct traffic",
            totalLeads: 81,
            totalValue: 2320,
            open: 0,
            won: 43,
            lost: 38,
            abandoned: 0,
            winPct: 53.09,
          },
          {
            source: "Referral",
            totalLeads: 32,
            totalValue: 920,
            open: 0,
            won: 16,
            lost: 16,
            abandoned: 0,
            winPct: 50.0,
          },
        ],
      },
      googleAnalytics: { visitors: 0, sessions: 0, pageViews: 0, bounceRatePct: 0 },
      googleBusinessProfile: { views: 0, searches: 0, clicks: 0, bookings: 0 },
      facebookAds: { clicks: 1660, spend: 2360, cpc: 1.42, ctrPct: 0.89 },
      googleAds: { clicks: 371, spend: 1320, cpc: 3.56, ctrPct: 12.02 },
      salesEfficiency: {
        avgSalesDurationDays: 0,
        avgTimeToWonDays: 0,
        salesVelocityPerMonth: 0,
      },
    },
  },

  // ── 2. Sitani — Omni Leads AGI ────────────────────────────────────
  {
    username: "sitani",
    password: "orbit123",
    businessName: "Omni Leads AGI",
    website: "omnileadsagi.com",
    vertical: "AI Lead Generation Platform",
    metrics: {
      opportunities: { total: 120, won: 38, lost: 27, open: 55 },
      opportunityValue: {
        total: 214000,
        bars: [
          { label: "New Lead", value: 46200 },
          { label: "Discovery Call", value: 38500 },
          { label: "Audit Delivered", value: 27300 },
          { label: "Proposal Sent", value: 24600 },
          { label: "Negotiation", value: 12800 },
          { label: "Won", value: 64600 },
        ],
      },
      conversion: { ratePct: 31.67, wonRevenue: 84600 },
      funnel: {
        pipelineName: "Omni Growth Pipeline",
        stages: [
          { stage: "New Lead", count: 21 },
          { stage: "Discovery Call", count: 14 },
          { stage: "Audit Delivered", count: 9 },
          { stage: "Proposal Sent", count: 7 },
          { stage: "Negotiation", count: 4 },
          { stage: "Won", count: 38 },
          { stage: "Lost", count: 27 },
        ],
      },
      stageDistribution: {
        total: 120,
        stages: [
          { stage: "New Lead", count: 21 },
          { stage: "Discovery Call", count: 14 },
          { stage: "Audit Delivered", count: 9 },
          { stage: "Proposal Sent", count: 7 },
          { stage: "Negotiation", count: 4 },
          { stage: "Won", count: 38 },
          { stage: "Lost", count: 27 },
        ],
      },
      tasks: [
        { title: "Send revised retainer proposal to roofing prospect", status: "pending", due: "Jun 11" },
        { title: "Publish June federation newsletter", status: "pending", due: "Jun 13" },
        { title: "Q2 pipeline review with sponsors", status: "completed" },
      ],
      manualActions: { phone: 3, sms: 5, pending: 8 },
      leadSources: {
        total: 120,
        trendPct: 38,
        rows: [
          { source: "Apollo outbound", totalLeads: 52, totalValue: 96800, open: 24, won: 16, lost: 12, abandoned: 0, winPct: 30.77 },
          { source: "omnileadsagi.com", totalLeads: 34, totalValue: 61400, open: 15, won: 12, lost: 7, abandoned: 0, winPct: 35.29 },
          { source: "Referral", totalLeads: 21, totalValue: 38600, open: 10, won: 7, lost: 4, abandoned: 0, winPct: 33.33 },
          { source: "LinkedIn", totalLeads: 13, totalValue: 17200, open: 6, won: 3, lost: 4, abandoned: 0, winPct: 23.08 },
        ],
      },
      googleAnalytics: { visitors: 6420, sessions: 8910, pageViews: 21300, bounceRatePct: 41.3 },
      googleBusinessProfile: { views: 1840, searches: 720, clicks: 260, bookings: 31 },
      facebookAds: { clicks: 890, spend: 1240, cpc: 1.39, ctrPct: 1.62 },
      googleAds: { clicks: 1130, spend: 2870, cpc: 2.54, ctrPct: 5.84 },
      salesEfficiency: {
        avgSalesDurationDays: 18,
        avgTimeToWonDays: 23,
        salesVelocityPerMonth: 28200,
      },
    },
  },

  // ── 3. Sammy — Love Thy Barber ────────────────────────────────────
  {
    username: "sammy",
    password: "fade123",
    businessName: "Love Thy Barber",
    website: "lovethybarber.shop",
    vertical: "Barbershop",
    metrics: {
      opportunities: { total: 480, won: 296, lost: 121, open: 63 },
      opportunityValue: {
        total: 21600,
        bars: [
          { label: "New Inquiry", value: 1260 },
          { label: "Booked", value: 990 },
          { label: "Confirmed", value: 585 },
          { label: "Showed", value: 13320 },
          { label: "No Show", value: 5445 },
        ],
      },
      conversion: { ratePct: 61.67, wonRevenue: 13320 },
      funnel: {
        pipelineName: "Booking Pipeline",
        stages: [
          { stage: "New Inquiry", count: 28 },
          { stage: "Booked", count: 22 },
          { stage: "Confirmed", count: 13 },
          { stage: "Showed", count: 296 },
          { stage: "No Show", count: 121 },
        ],
      },
      stageDistribution: {
        total: 480,
        stages: [
          { stage: "New Inquiry", count: 28 },
          { stage: "Booked", count: 22 },
          { stage: "Confirmed", count: 13 },
          { stage: "Showed", count: 296 },
          { stage: "No Show", count: 121 },
        ],
      },
      tasks: [
        { title: "Text reminder blast for Saturday openings", status: "pending", due: "Jun 12" },
        { title: "Reply to new Google reviews", status: "pending", due: "Jun 14" },
      ],
      manualActions: { phone: 2, sms: 11, pending: 13 },
      leadSources: {
        total: 480,
        trendPct: 22,
        rows: [
          { source: "Google Business Profile", totalLeads: 214, totalValue: 9630, open: 26, won: 138, lost: 50, abandoned: 0, winPct: 64.49 },
          { source: "Instagram", totalLeads: 138, totalValue: 6210, open: 18, won: 84, lost: 36, abandoned: 0, winPct: 60.87 },
          { source: "Walk-in", totalLeads: 86, totalValue: 3870, open: 9, won: 52, lost: 25, abandoned: 0, winPct: 60.47 },
          { source: "lovethybarber.shop", totalLeads: 42, totalValue: 1890, open: 10, won: 22, lost: 10, abandoned: 0, winPct: 52.38 },
        ],
      },
      googleAnalytics: { visitors: 3900, sessions: 5200, pageViews: 11400, bounceRatePct: 38.2 },
      googleBusinessProfile: { views: 8400, searches: 3100, clicks: 920, bookings: 311 },
      facebookAds: { clicks: 540, spend: 410, cpc: 0.76, ctrPct: 1.84 },
      googleAds: { clicks: 210, spend: 380, cpc: 1.81, ctrPct: 4.6 },
      salesEfficiency: {
        avgSalesDurationDays: 1,
        avgTimeToWonDays: 1,
        salesVelocityPerMonth: 4400,
      },
    },
  },

  // ── 4. Fred — Greenwood Rentals ───────────────────────────────────
  {
    username: "fred",
    password: "keys123",
    businessName: "Greenwood Rentals",
    website: "arizonaphoenixrentals.com",
    vertical: "Party & Event Rentals",
    metrics: {
      opportunities: { total: 140, won: 64, lost: 41, open: 35 },
      opportunityValue: {
        total: 53200,
        bars: [
          { label: "New Inquiry", value: 5320 },
          { label: "Quote Sent", value: 4180 },
          { label: "Deposit Pending", value: 3040 },
          { label: "Scheduled", value: 1900 },
          { label: "Delivered / Won", value: 24320 },
          { label: "Lost", value: 14440 },
        ],
      },
      conversion: { ratePct: 45.71, wonRevenue: 24320 },
      funnel: {
        pipelineName: "Event Booking Pipeline",
        stages: [
          { stage: "New Inquiry", count: 14 },
          { stage: "Quote Sent", count: 10 },
          { stage: "Deposit Pending", count: 7 },
          { stage: "Scheduled", count: 4 },
          { stage: "Delivered / Won", count: 64 },
          { stage: "Lost", count: 41 },
        ],
      },
      stageDistribution: {
        total: 140,
        stages: [
          { stage: "New Inquiry", count: 14 },
          { stage: "Quote Sent", count: 10 },
          { stage: "Deposit Pending", count: 7 },
          { stage: "Scheduled", count: 4 },
          { stage: "Delivered / Won", count: 64 },
          { stage: "Lost", count: 41 },
        ],
      },
      tasks: [
        { title: "Confirm delivery window for Saturday graduation party", status: "pending", due: "Jun 12" },
        { title: "Collect deposit on quinceanera package", status: "pending", due: "Jun 13" },
      ],
      manualActions: { phone: 4, sms: 6, pending: 10 },
      leadSources: {
        total: 140,
        trendPct: 31,
        rows: [
          { source: "Google Search", totalLeads: 58, totalValue: 22040, open: 14, won: 27, lost: 17, abandoned: 0, winPct: 46.55 },
          { source: "Facebook Marketplace", totalLeads: 41, totalValue: 15580, open: 10, won: 19, lost: 12, abandoned: 0, winPct: 46.34 },
          { source: "Repeat customer", totalLeads: 26, totalValue: 9880, open: 6, won: 13, lost: 7, abandoned: 0, winPct: 50.0 },
          { source: "Referral", totalLeads: 15, totalValue: 5700, open: 5, won: 5, lost: 5, abandoned: 0, winPct: 33.33 },
        ],
      },
      googleAnalytics: { visitors: 2100, sessions: 2840, pageViews: 6900, bounceRatePct: 47.5 },
      googleBusinessProfile: { views: 3600, searches: 1450, clicks: 410, bookings: 58 },
      facebookAds: { clicks: 720, spend: 560, cpc: 0.78, ctrPct: 2.1 },
      googleAds: { clicks: 340, spend: 690, cpc: 2.03, ctrPct: 6.2 },
      salesEfficiency: {
        avgSalesDurationDays: 4,
        avgTimeToWonDays: 5,
        salesVelocityPerMonth: 8100,
      },
    },
  },

  // ── 5. Alex — Utah Main Street ────────────────────────────────────
  {
    username: "alex",
    password: "brick123",
    businessName: "Utah Main Street",
    website: "utahmainstreet.com",
    vertical: "Local Business Network",
    metrics: {
      opportunities: { total: 90, won: 41, lost: 28, open: 21 },
      opportunityValue: {
        total: 41300,
        bars: [
          { label: "New Lead", value: 4130 },
          { label: "Intro Call", value: 2890 },
          { label: "Proposal", value: 2480 },
          { label: "Renewal Pending", value: 1240 },
          { label: "Won", value: 18740 },
          { label: "Lost", value: 11820 },
        ],
      },
      conversion: { ratePct: 45.56, wonRevenue: 18740 },
      funnel: {
        pipelineName: "Sponsor Pipeline",
        stages: [
          { stage: "New Lead", count: 9 },
          { stage: "Intro Call", count: 6 },
          { stage: "Proposal", count: 4 },
          { stage: "Renewal Pending", count: 2 },
          { stage: "Won", count: 41 },
          { stage: "Lost", count: 28 },
        ],
      },
      stageDistribution: {
        total: 90,
        stages: [
          { stage: "New Lead", count: 9 },
          { stage: "Intro Call", count: 6 },
          { stage: "Proposal", count: 4 },
          { stage: "Renewal Pending", count: 2 },
          { stage: "Won", count: 41 },
          { stage: "Lost", count: 28 },
        ],
      },
      tasks: [
        { title: "Send July feature package to downtown bakery", status: "pending", due: "Jun 13" },
        { title: "Renew two lapsing directory sponsors", status: "pending", due: "Jun 16" },
      ],
      manualActions: { phone: 2, sms: 3, pending: 5 },
      leadSources: {
        total: 90,
        trendPct: 17,
        rows: [
          { source: "utahmainstreet.com", totalLeads: 36, totalValue: 16520, open: 8, won: 17, lost: 11, abandoned: 0, winPct: 47.22 },
          { source: "Email newsletter", totalLeads: 27, totalValue: 12390, open: 7, won: 12, lost: 8, abandoned: 0, winPct: 44.44 },
          { source: "Community events", totalLeads: 17, totalValue: 7850, open: 4, won: 8, lost: 5, abandoned: 0, winPct: 47.06 },
          { source: "Referral", totalLeads: 10, totalValue: 4540, open: 2, won: 4, lost: 4, abandoned: 0, winPct: 40.0 },
        ],
      },
      googleAnalytics: { visitors: 5100, sessions: 7300, pageViews: 19800, bounceRatePct: 44.1 },
      googleBusinessProfile: { views: 2200, searches: 860, clicks: 290, bookings: 14 },
      facebookAds: { clicks: 460, spend: 320, cpc: 0.7, ctrPct: 1.95 },
      googleAds: { clicks: 180, spend: 290, cpc: 1.61, ctrPct: 4.1 },
      salesEfficiency: {
        avgSalesDurationDays: 9,
        avgTimeToWonDays: 11,
        salesVelocityPerMonth: 6200,
      },
    },
  },

  // ── 6. Brent — Youngs Cabinet ─────────────────────────────────────
  {
    username: "brent",
    password: "stain123",
    businessName: "Youngs Cabinet",
    website: "youngscabinetrefinishing.com",
    vertical: "Cabinet Refinishing",
    metrics: {
      opportunities: { total: 45, won: 19, lost: 14, open: 12 },
      opportunityValue: {
        total: 189000,
        bars: [
          { label: "New Lead", value: 21000 },
          { label: "Estimate Scheduled", value: 12600 },
          { label: "Quote Sent", value: 13900 },
          { label: "Follow-Up", value: 4200 },
          { label: "Won", value: 79800 },
          { label: "Lost", value: 57500 },
        ],
      },
      conversion: { ratePct: 42.22, wonRevenue: 79800 },
      funnel: {
        pipelineName: "Refinishing Quote Pipeline",
        stages: [
          { stage: "New Lead", count: 5 },
          { stage: "Estimate Scheduled", count: 3 },
          { stage: "Quote Sent", count: 3 },
          { stage: "Follow-Up", count: 1 },
          { stage: "Won", count: 19 },
          { stage: "Lost", count: 14 },
        ],
      },
      stageDistribution: {
        total: 45,
        stages: [
          { stage: "New Lead", count: 5 },
          { stage: "Estimate Scheduled", count: 3 },
          { stage: "Quote Sent", count: 3 },
          { stage: "Follow-Up", count: 1 },
          { stage: "Won", count: 19 },
          { stage: "Lost", count: 14 },
        ],
      },
      tasks: [
        { title: "Send before/after photos to Draper quote", status: "pending", due: "Jun 11" },
        { title: "Schedule color consult for Herriman kitchen", status: "pending", due: "Jun 13" },
      ],
      manualActions: { phone: 3, sms: 2, pending: 5 },
      leadSources: {
        total: 45,
        trendPct: 26,
        rows: [
          { source: "Google Search", totalLeads: 19, totalValue: 79800, open: 5, won: 8, lost: 6, abandoned: 0, winPct: 42.11 },
          { source: "Facebook Ads", totalLeads: 13, totalValue: 54600, open: 4, won: 6, lost: 3, abandoned: 0, winPct: 46.15 },
          { source: "Referral", totalLeads: 8, totalValue: 33600, open: 2, won: 3, lost: 3, abandoned: 0, winPct: 37.5 },
          { source: "Nextdoor", totalLeads: 5, totalValue: 21000, open: 1, won: 2, lost: 2, abandoned: 0, winPct: 40.0 },
        ],
      },
      googleAnalytics: { visitors: 1450, sessions: 1900, pageViews: 4700, bounceRatePct: 51.2 },
      googleBusinessProfile: { views: 2900, searches: 1150, clicks: 340, bookings: 22 },
      facebookAds: { clicks: 610, spend: 880, cpc: 1.44, ctrPct: 1.37 },
      googleAds: { clicks: 260, spend: 740, cpc: 2.85, ctrPct: 5.3 },
      salesEfficiency: {
        avgSalesDurationDays: 14,
        avgTimeToWonDays: 17,
        salesVelocityPerMonth: 26600,
      },
    },
  },

  // ── 7. Adam — Leifson Built ───────────────────────────────────────
  {
    username: "adam",
    password: "deck123",
    businessName: "Leifson Built",
    website: "utahdeckandbasementremodel.com",
    vertical: "Deck & Basement Remodeling",
    metrics: {
      opportunities: { total: 38, won: 13, lost: 11, open: 14 },
      opportunityValue: {
        total: 712000,
        bars: [
          { label: "New Lead", value: 95000 },
          { label: "Site Visit", value: 84000 },
          { label: "Bid Sent", value: 67000 },
          { label: "Contract Review", value: 46000 },
          { label: "Won", value: 247000 },
          { label: "Lost", value: 173000 },
        ],
      },
      conversion: { ratePct: 34.21, wonRevenue: 247000 },
      funnel: {
        pipelineName: "Deck & Basement Pipeline",
        stages: [
          { stage: "New Lead", count: 5 },
          { stage: "Site Visit", count: 4 },
          { stage: "Bid Sent", count: 3 },
          { stage: "Contract Review", count: 2 },
          { stage: "Won", count: 13 },
          { stage: "Lost", count: 11 },
        ],
      },
      stageDistribution: {
        total: 38,
        stages: [
          { stage: "New Lead", count: 5 },
          { stage: "Site Visit", count: 4 },
          { stage: "Bid Sent", count: 3 },
          { stage: "Contract Review", count: 2 },
          { stage: "Won", count: 13 },
          { stage: "Lost", count: 11 },
        ],
      },
      tasks: [
        { title: "Walk the Riverton basement before final bid", status: "pending", due: "Jun 12" },
        { title: "Order composite decking for Sandy build", status: "pending", due: "Jun 15" },
        { title: "Collect signed contract from Lehi remodel", status: "completed" },
      ],
      manualActions: { phone: 5, sms: 3, pending: 8 },
      leadSources: {
        total: 38,
        trendPct: 12,
        rows: [
          { source: "Google Search", totalLeads: 16, totalValue: 304000, open: 6, won: 6, lost: 4, abandoned: 0, winPct: 37.5 },
          { source: "Referral", totalLeads: 11, totalValue: 209000, open: 4, won: 4, lost: 3, abandoned: 0, winPct: 36.36 },
          { source: "Facebook Ads", totalLeads: 7, totalValue: 133000, open: 3, won: 2, lost: 2, abandoned: 0, winPct: 28.57 },
          { source: "Houzz", totalLeads: 4, totalValue: 66000, open: 1, won: 1, lost: 2, abandoned: 0, winPct: 25.0 },
        ],
      },
      googleAnalytics: { visitors: 1700, sessions: 2250, pageViews: 6100, bounceRatePct: 49.8 },
      googleBusinessProfile: { views: 2400, searches: 980, clicks: 310, bookings: 16 },
      facebookAds: { clicks: 480, spend: 1150, cpc: 2.4, ctrPct: 1.12 },
      googleAds: { clicks: 320, spend: 1480, cpc: 4.63, ctrPct: 4.8 },
      salesEfficiency: {
        avgSalesDurationDays: 31,
        avgTimeToWonDays: 36,
        salesVelocityPerMonth: 82300,
      },
    },
  },

  // ── 8. Rene — Rene Laveau ─────────────────────────────────────────
  {
    username: "rene",
    password: "mojo123",
    businessName: "Rene Laveau",
    website: "renelaveau.com",
    vertical: "Recording Artist",
    metrics: {
      opportunities: { total: 75, won: 32, lost: 24, open: 19 },
      opportunityValue: {
        total: 91500,
        bars: [
          { label: "New Inquiry", value: 9600 },
          { label: "In Talks", value: 7800 },
          { label: "Offer Sent", value: 4500 },
          { label: "Hold", value: 2400 },
          { label: "Booked / Won", value: 38400 },
          { label: "Lost", value: 28800 },
        ],
      },
      conversion: { ratePct: 42.67, wonRevenue: 38400 },
      funnel: {
        pipelineName: "Booking Pipeline",
        stages: [
          { stage: "New Inquiry", count: 8 },
          { stage: "In Talks", count: 6 },
          { stage: "Offer Sent", count: 3 },
          { stage: "Hold", count: 2 },
          { stage: "Booked / Won", count: 32 },
          { stage: "Lost", count: 24 },
        ],
      },
      stageDistribution: {
        total: 75,
        stages: [
          { stage: "New Inquiry", count: 8 },
          { stage: "In Talks", count: 6 },
          { stage: "Offer Sent", count: 3 },
          { stage: "Hold", count: 2 },
          { stage: "Booked / Won", count: 32 },
          { stage: "Lost", count: 24 },
        ],
      },
      tasks: [
        { title: "Confirm rider for July festival slot", status: "pending", due: "Jun 14" },
        { title: "Send EPK to venue booker in Vegas", status: "pending", due: "Jun 12" },
      ],
      manualActions: { phone: 1, sms: 4, pending: 5 },
      leadSources: {
        total: 75,
        trendPct: 54,
        rows: [
          { source: "Instagram", totalLeads: 31, totalValue: 37800, open: 8, won: 14, lost: 9, abandoned: 0, winPct: 45.16 },
          { source: "renelaveau.com", totalLeads: 22, totalValue: 26800, open: 6, won: 9, lost: 7, abandoned: 0, winPct: 40.91 },
          { source: "Booking agency", totalLeads: 14, totalValue: 17100, open: 3, won: 6, lost: 5, abandoned: 0, winPct: 42.86 },
          { source: "Spotify / streaming", totalLeads: 8, totalValue: 9800, open: 2, won: 3, lost: 3, abandoned: 0, winPct: 37.5 },
        ],
      },
      googleAnalytics: { visitors: 8900, sessions: 12400, pageViews: 27600, bounceRatePct: 55.4 },
      googleBusinessProfile: { views: 0, searches: 0, clicks: 0, bookings: 0 },
      facebookAds: { clicks: 1320, spend: 940, cpc: 0.71, ctrPct: 2.31 },
      googleAds: { clicks: 0, spend: 0, cpc: 0, ctrPct: 0 },
      salesEfficiency: {
        avgSalesDurationDays: 11,
        avgTimeToWonDays: 13,
        salesVelocityPerMonth: 12800,
      },
    },
  },

  // ── 9. Taniela — Taniela Fiefia Concrete ──────────────────────────
  {
    username: "taniela",
    password: "pour123",
    businessName: "Taniela Fiefia Concrete",
    website: "tanielafiefia.com",
    vertical: "Concrete Contracting",
    metrics: {
      opportunities: { total: 55, won: 23, lost: 17, open: 15 },
      opportunityValue: {
        total: 357500,
        bars: [
          { label: "New Lead", value: 39000 },
          { label: "Site Measure", value: 26000 },
          { label: "Bid Sent", value: 19500 },
          { label: "Follow-Up", value: 13000 },
          { label: "Won", value: 149500 },
          { label: "Lost", value: 110500 },
        ],
      },
      conversion: { ratePct: 41.82, wonRevenue: 149500 },
      funnel: {
        pipelineName: "Concrete Bid Pipeline",
        stages: [
          { stage: "New Lead", count: 6 },
          { stage: "Site Measure", count: 4 },
          { stage: "Bid Sent", count: 3 },
          { stage: "Follow-Up", count: 2 },
          { stage: "Won", count: 23 },
          { stage: "Lost", count: 17 },
        ],
      },
      stageDistribution: {
        total: 55,
        stages: [
          { stage: "New Lead", count: 6 },
          { stage: "Site Measure", count: 4 },
          { stage: "Bid Sent", count: 3 },
          { stage: "Follow-Up", count: 2 },
          { stage: "Won", count: 23 },
          { stage: "Lost", count: 17 },
        ],
      },
      tasks: [
        { title: "Re-bid the West Jordan driveway with rebar upgrade", status: "pending", due: "Jun 12" },
        { title: "Schedule pour crew for Friday flatwork", status: "pending", due: "Jun 13" },
      ],
      manualActions: { phone: 4, sms: 2, pending: 6 },
      leadSources: {
        total: 55,
        trendPct: 19,
        rows: [
          { source: "Google Search", totalLeads: 23, totalValue: 149500, open: 7, won: 10, lost: 6, abandoned: 0, winPct: 43.48 },
          { source: "Referral", totalLeads: 16, totalValue: 104000, open: 4, won: 7, lost: 5, abandoned: 0, winPct: 43.75 },
          { source: "Instagram", totalLeads: 10, totalValue: 65000, open: 3, won: 4, lost: 3, abandoned: 0, winPct: 40.0 },
          { source: "Yard signs", totalLeads: 6, totalValue: 39000, open: 1, won: 2, lost: 3, abandoned: 0, winPct: 33.33 },
        ],
      },
      googleAnalytics: { visitors: 1250, sessions: 1640, pageViews: 3900, bounceRatePct: 52.7 },
      googleBusinessProfile: { views: 2700, searches: 1080, clicks: 360, bookings: 19 },
      facebookAds: { clicks: 390, spend: 520, cpc: 1.33, ctrPct: 1.46 },
      googleAds: { clicks: 240, spend: 810, cpc: 3.38, ctrPct: 5.1 },
      salesEfficiency: {
        avgSalesDurationDays: 12,
        avgTimeToWonDays: 15,
        salesVelocityPerMonth: 49800,
      },
    },
  },

  // ── 10. Mark — Imperium ───────────────────────────────────────────
  {
    username: "mark",
    password: "rome123",
    businessName: "Imperium",
    website: "secretimperium.com",
    vertical: "Private Membership Network",
    metrics: {
      opportunities: { total: 30, won: 14, lost: 9, open: 7 },
      opportunityValue: {
        total: 84000,
        bars: [
          { label: "Application", value: 8400 },
          { label: "Interview", value: 5600 },
          { label: "Invitation Sent", value: 5600 },
          { label: "Member / Won", value: 39200 },
          { label: "Declined", value: 25200 },
        ],
      },
      conversion: { ratePct: 46.67, wonRevenue: 39200 },
      funnel: {
        pipelineName: "Membership Pipeline",
        stages: [
          { stage: "Application", count: 3 },
          { stage: "Interview", count: 2 },
          { stage: "Invitation Sent", count: 2 },
          { stage: "Member / Won", count: 14 },
          { stage: "Declined", count: 9 },
        ],
      },
      stageDistribution: {
        total: 30,
        stages: [
          { stage: "Application", count: 3 },
          { stage: "Interview", count: 2 },
          { stage: "Invitation Sent", count: 2 },
          { stage: "Member / Won", count: 14 },
          { stage: "Declined", count: 9 },
        ],
      },
      tasks: [
        { title: "Review two pending member applications", status: "pending", due: "Jun 13" },
      ],
      manualActions: { phone: 1, sms: 1, pending: 2 },
      leadSources: {
        total: 30,
        trendPct: null,
        rows: [
          { source: "Member referral", totalLeads: 18, totalValue: 50400, open: 4, won: 9, lost: 5, abandoned: 0, winPct: 50.0 },
          { source: "secretimperium.com", totalLeads: 8, totalValue: 22400, open: 2, won: 4, lost: 2, abandoned: 0, winPct: 50.0 },
          { source: "Private event", totalLeads: 4, totalValue: 11200, open: 1, won: 1, lost: 2, abandoned: 0, winPct: 25.0 },
        ],
      },
      googleAnalytics: { visitors: 640, sessions: 820, pageViews: 1700, bounceRatePct: 61.3 },
      googleBusinessProfile: { views: 0, searches: 0, clicks: 0, bookings: 0 },
      facebookAds: { clicks: 0, spend: 0, cpc: 0, ctrPct: 0 },
      googleAds: { clicks: 0, spend: 0, cpc: 0, ctrPct: 0 },
      salesEfficiency: {
        avgSalesDurationDays: 21,
        avgTimeToWonDays: 25,
        salesVelocityPerMonth: 9800,
      },
    },
  },

  // ── 11. Steve — Comprehensive Psychological Services ──────────────
  {
    username: "steve",
    password: "mind123",
    businessName: "Comprehensive Psychological Services",
    website: "psychandcustodyevaluations.com",
    vertical: "Psychological & Custody Evaluations",
    metrics: {
      opportunities: { total: 110, won: 52, lost: 33, open: 25 },
      opportunityValue: {
        total: 176000,
        bars: [
          { label: "New Referral", value: 14400 },
          { label: "Records Requested", value: 11200 },
          { label: "Eval Scheduled", value: 9600 },
          { label: "Report Drafting", value: 4800 },
          { label: "Completed / Won", value: 83200 },
          { label: "Lost", value: 52800 },
        ],
      },
      conversion: { ratePct: 47.27, wonRevenue: 83200 },
      funnel: {
        pipelineName: "Intake Pipeline",
        stages: [
          { stage: "New Referral", count: 9 },
          { stage: "Records Requested", count: 7 },
          { stage: "Eval Scheduled", count: 6 },
          { stage: "Report Drafting", count: 3 },
          { stage: "Completed / Won", count: 52 },
          { stage: "Lost", count: 33 },
        ],
      },
      stageDistribution: {
        total: 110,
        stages: [
          { stage: "New Referral", count: 9 },
          { stage: "Records Requested", count: 7 },
          { stage: "Eval Scheduled", count: 6 },
          { stage: "Report Drafting", count: 3 },
          { stage: "Completed / Won", count: 52 },
          { stage: "Lost", count: 33 },
        ],
      },
      tasks: [
        { title: "Send intake packet to new attorney referral", status: "pending", due: "Jun 11" },
        { title: "Finalize custody eval report for review", status: "pending", due: "Jun 16" },
        { title: "Confirm Thursday testimony prep call", status: "completed" },
      ],
      manualActions: { phone: 6, sms: 2, pending: 8 },
      leadSources: {
        total: 110,
        trendPct: 14,
        rows: [
          { source: "Attorney referral", totalLeads: 47, totalValue: 75200, open: 11, won: 23, lost: 13, abandoned: 0, winPct: 48.94 },
          { source: "Court referral", totalLeads: 29, totalValue: 46400, open: 6, won: 14, lost: 9, abandoned: 0, winPct: 48.28 },
          { source: "Google Search", totalLeads: 21, totalValue: 33600, open: 5, won: 10, lost: 6, abandoned: 0, winPct: 47.62 },
          { source: "Psychology Today", totalLeads: 13, totalValue: 20800, open: 3, won: 5, lost: 5, abandoned: 0, winPct: 38.46 },
        ],
      },
      googleAnalytics: { visitors: 2800, sessions: 3700, pageViews: 9200, bounceRatePct: 46.9 },
      googleBusinessProfile: { views: 1900, searches: 740, clicks: 250, bookings: 21 },
      facebookAds: { clicks: 0, spend: 0, cpc: 0, ctrPct: 0 },
      googleAds: { clicks: 410, spend: 1240, cpc: 3.02, ctrPct: 6.7 },
      salesEfficiency: {
        avgSalesDurationDays: 24,
        avgTimeToWonDays: 28,
        salesVelocityPerMonth: 27700,
      },
    },
  },
];

export function authenticateDemo(
  username: string,
  password: string,
): DemoClient | null {
  const u = username.trim().toLowerCase();
  return (
    DEMO_CLIENTS.find((c) => c.username === u && c.password === password) ??
    null
  );
}

export function getDemoClient(username: string): DemoClient | null {
  const u = username.trim().toLowerCase();
  return DEMO_CLIENTS.find((c) => c.username === u) ?? null;
}
