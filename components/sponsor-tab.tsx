"use client";
import { useState } from "react";
import { Bot, Building2, Lock, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BusinessData {
  id: string;
  name: string;
  totalTasksCompleted: number;
  totalRevenue: number;
  personalAssistant: {
    tasksCompleted: number;
    meetingsBooked: number;
    messagesSent: number;
  };
  newsletterAgent: {
    contentGenerated: number;
    lifetimeSubscribers: number;
    subscribersGenerated: number;
    mostPopularContent: { title: string; views: number }[];
  };
  marketingAgent: {
    contentGeneratedMinutes: number;
    viewsGenerated: number;
    conversionRate: number;
  };
}

const mockSponsorData: BusinessData[] = [
  {
    id: "1",
    name: "Youngs Cabinet Refinishing",
    totalTasksCompleted: 0,
    totalRevenue: 0,
    personalAssistant: {
      tasksCompleted: 0,
      meetingsBooked: 0,
      messagesSent: 0,
    },
    newsletterAgent: {
      contentGenerated: 0,
      lifetimeSubscribers: 0,
      subscribersGenerated: 0,
      mostPopularContent: [],
    },
    marketingAgent: {
      contentGeneratedMinutes: 0,
      viewsGenerated: 0,
      conversionRate: 0,
    },
  },
  {
    id: "2",
    name: "Leifson Built",
    totalTasksCompleted: 0,
    totalRevenue: 0,
    personalAssistant: {
      tasksCompleted: 0,
      meetingsBooked: 0,
      messagesSent: 0,
    },
    newsletterAgent: {
      contentGenerated: 0,
      lifetimeSubscribers: 0,
      subscribersGenerated: 0,
      mostPopularContent: [],
    },
    marketingAgent: {
      contentGeneratedMinutes: 0,
      viewsGenerated: 0,
      conversionRate: 0,
    },
  },
  {
    id: "3",
    name: "Omni Leads",
    totalTasksCompleted: 0,
    totalRevenue: 0,
    personalAssistant: {
      tasksCompleted: 0,
      meetingsBooked: 0,
      messagesSent: 0,
    },
    newsletterAgent: {
      contentGenerated: 0,
      lifetimeSubscribers: 0,
      subscribersGenerated: 0,
      mostPopularContent: [],
    },
    marketingAgent: {
      contentGeneratedMinutes: 0,
      viewsGenerated: 0,
      conversionRate: 0,
    },
  },
];

function calculateTotals(businesses: BusinessData[]) {
  return businesses.reduce(
    (acc, business) => ({
      totalTasksCompleted: acc.totalTasksCompleted + business.totalTasksCompleted,
      totalRevenue: acc.totalRevenue + business.totalRevenue,
      lifetimeSubscribers: acc.lifetimeSubscribers + business.newsletterAgent.lifetimeSubscribers,
      viewsGenerated: acc.viewsGenerated + business.marketingAgent.viewsGenerated,
      tasksCompleted: acc.tasksCompleted + business.personalAssistant.tasksCompleted,
      meetingsBooked: acc.meetingsBooked + business.personalAssistant.meetingsBooked,
      messagesSent: acc.messagesSent + business.personalAssistant.messagesSent,
    }),
    {
      totalTasksCompleted: 0,
      totalRevenue: 0,
      lifetimeSubscribers: 0,
      viewsGenerated: 0,
      tasksCompleted: 0,
      meetingsBooked: 0,
      messagesSent: 0,
    }
  );
}

function BusinessAnalyticsCard({ business }: { business: BusinessData }) {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-purple-500/10 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{business.totalTasksCompleted}</p>
          <p className="text-xs text-gray-400 mt-1">Tasks</p>
        </div>
        <div className="bg-purple-500/10 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">${(business.totalRevenue / 1000).toFixed(1)}k</p>
          <p className="text-xs text-gray-400 mt-1">Revenue</p>
        </div>
        <div className="bg-purple-500/10 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{business.newsletterAgent.lifetimeSubscribers.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Subscribers</p>
        </div>
        <div className="bg-purple-500/10 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{(business.marketingAgent.viewsGenerated / 1000).toFixed(0)}k</p>
          <p className="text-xs text-gray-400 mt-1">Views</p>
        </div>
      </div>

      <div className="border-t border-purple-500/20 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">AI Agent Stats</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-purple-300">{business.personalAssistant.tasksCompleted}</p>
            <p className="text-xs text-gray-400">Tasks</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-purple-300">{business.personalAssistant.meetingsBooked}</p>
            <p className="text-xs text-gray-400">Meetings</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-purple-300">{business.personalAssistant.messagesSent}</p>
            <p className="text-xs text-gray-400">Messages</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SponsorTab({ isLocked = false }: { isLocked?: boolean }) {
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const totals = calculateTotals(mockSponsorData);

  const toggleBusiness = (id: string) => {
    setExpandedBusiness(expandedBusiness === id ? null : id);
  };

  return (
    <div className={`space-y-4 ${isLocked ? 'blur-sm select-none pointer-events-none' : ''}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Sponsor Insights
            {isLocked && <Lock className="w-4 h-4 text-purple-400" />}
          </h2>
          <p className="text-sm text-gray-400">Your sponsored business analytics</p>
        </div>
        <Badge variant="outline" className="border-purple-500/50 text-purple-400">
          {mockSponsorData.length} Assets
        </Badge>
      </div>

      <Card className="bg-white/5 border-purple-500/30 max-w-3xl mx-auto">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-lg text-purple-300">Asset Analytics</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{totals.totalTasksCompleted}</p>
              <p className="text-xs text-gray-400 mt-1">Tasks</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">${(totals.totalRevenue / 1000).toFixed(1)}k</p>
              <p className="text-xs text-gray-400 mt-1">Revenue</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{totals.lifetimeSubscribers.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Subscribers</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{(totals.viewsGenerated / 1000).toFixed(0)}k</p>
              <p className="text-xs text-gray-400 mt-1">Views</p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">AI Agent Stats</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-300">{totals.tasksCompleted}</p>
                <p className="text-xs text-gray-400">Tasks</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-300">{totals.meetingsBooked}</p>
                <p className="text-xs text-gray-400">Meetings</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-300">{totals.messagesSent}</p>
                <p className="text-xs text-gray-400">Messages</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2 max-w-3xl mx-auto">
        {mockSponsorData.map((business) => (
          <Card key={business.id} className="bg-white/5 border-purple-500/20">
            <CardHeader 
              className="pb-2 cursor-pointer hover:bg-white/5 transition-colors rounded-t-lg"
              onClick={() => toggleBusiness(business.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  <CardTitle className="text-base text-gray-200">{business.name}</CardTitle>
                </div>
                {expandedBusiness === business.id ? (
                  <ChevronDown className="w-5 h-5 text-purple-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-purple-400" />
                )}
              </div>
            </CardHeader>
            {expandedBusiness === business.id && (
              <CardContent>
                <BusinessAnalyticsCard business={business} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
