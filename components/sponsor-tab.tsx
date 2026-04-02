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
    postsGenerated: number;
  };
}

const mockSponsorData: BusinessData[] = [
  {
    id: "1",
    name: "Young's Cabinet Refinishing",
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
      postsGenerated: 0,
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
      postsGenerated: 0,
    },
  },
  {
    id: "3",
    name: "Omnileads LLC",
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
      postsGenerated: 0,
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
      postsGenerated: acc.postsGenerated + business.marketingAgent.postsGenerated,
    }),
    {
      totalTasksCompleted: 0,
      totalRevenue: 0,
      lifetimeSubscribers: 0,
      viewsGenerated: 0,
      tasksCompleted: 0,
      meetingsBooked: 0,
      messagesSent: 0,
      postsGenerated: 0,
    }
  );
}

function BusinessAnalyticsCard({ business }: { business: BusinessData }) {
  return (
    <div className="space-y-3">
      <Card className="bg-white/5 border-purple-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-lg text-purple-300">{business.name} Analytics</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{business.totalTasksCompleted}</p>
              <p className="text-xs text-gray-400 mt-1">Tasks</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">${(business.totalRevenue / 1000).toFixed(0)}k</p>
              <p className="text-xs text-gray-400 mt-1">Revenue</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{(business.marketingAgent.viewsGenerated / 1000).toFixed(0)}k</p>
              <p className="text-xs text-gray-400 mt-1">Views</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-purple-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-lg text-purple-300">AI Agent Stats</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{business.personalAssistant.meetingsBooked}</p>
              <p className="text-xs text-gray-400 mt-1">Meetings</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{business.personalAssistant.messagesSent}</p>
              <p className="text-xs text-gray-400 mt-1">Messages</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{business.marketingAgent.postsGenerated}</p>
              <p className="text-xs text-gray-400 mt-1">Posts</p>
            </div>
          </div>
        </CardContent>
      </Card>
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
    <div className="space-y-4">
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

      <Card className="bg-white/5 border-purple-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-lg text-purple-300">Asset Analytics</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={`grid grid-cols-3 gap-4 ${isLocked ? 'blur-sm select-none' : ''}`}>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">0</p>
              <p className="text-xs text-gray-400 mt-1">Tasks</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">0k</p>
              <p className="text-xs text-gray-400 mt-1">Revenue</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">0k</p>
              <p className="text-xs text-gray-400 mt-1">Views</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-purple-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-lg text-purple-300">AI Agent Stats</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={`grid grid-cols-3 gap-4 ${isLocked ? 'blur-sm select-none' : ''}`}>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{totals.meetingsBooked}</p>
              <p className="text-xs text-gray-400 mt-1">Meetings</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{totals.messagesSent}</p>
              <p className="text-xs text-gray-400 mt-1">Messages</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-400">{totals.postsGenerated}</p>
              <p className="text-xs text-gray-400 mt-1">Posts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {mockSponsorData.map((business) => (
          <Card key={business.id} className="bg-white/5 border-purple-500/20">
            <CardHeader 
              className="py-4 cursor-pointer hover:bg-white/5 transition-colors rounded-t-lg"
              onClick={() => toggleBusiness(business.id)}
            >
              <div className="flex items-center justify-between w-full pr-4 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  <span className="text-base text-gray-200 font-medium truncate">{business.name}</span>
                </div>
                <span className="text-sm text-purple-400 whitespace-nowrap">Developed</span>
              </div>
            </CardHeader>
            {expandedBusiness === business.id && (
              <CardContent className="space-y-3">
                <BusinessAnalyticsCard business={business} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
