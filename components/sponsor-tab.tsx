"use client";
import { Bot, Building2, Lock } from "lucide-react";
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
    id: "2",
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

export function SponsorTab({ isLocked = false }: { isLocked?: boolean }) {
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

      {mockSponsorData.map((business) => (
        <Card key={business.id} className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-400" />
              <CardTitle className="text-lg">{business.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-purple-500/10 rounded p-3 text-center">
                <p className="text-2xl font-bold text-purple-400">{business.totalTasksCompleted}</p>
                <p className="text-xs text-gray-400">Tasks</p>
              </div>
              <div className="bg-green-500/10 rounded p-3 text-center">
                <p className="text-2xl font-bold text-green-400">${(business.totalRevenue / 1000).toFixed(1)}k</p>
                <p className="text-xs text-gray-400">Revenue</p>
              </div>
              <div className="bg-blue-500/10 rounded p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{business.newsletterAgent.lifetimeSubscribers.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Subscribers</p>
              </div>
              <div className="bg-amber-500/10 rounded p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{(business.marketingAgent.viewsGenerated / 1000).toFixed(0)}k</p>
                <p className="text-xs text-gray-400">Views</p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium">AI Agent Stats</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">Tasks</p>
                  <p className="font-bold">{business.personalAssistant.tasksCompleted}</p>
                </div>
                <div className="bg-white/5 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">Meetings</p>
                  <p className="font-bold">{business.personalAssistant.meetingsBooked}</p>
                </div>
                <div className="bg-white/5 rounded p-2 text-center">
                  <p className="text-xs text-gray-400">Messages</p>
                  <p className="font-bold">{business.personalAssistant.messagesSent}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
