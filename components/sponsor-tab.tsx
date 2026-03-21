"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Bot, Mail, Target, CheckCircle, DollarSign, Building2,
  Users, TrendingUp, Calendar, ChevronDown, ChevronRight, Lock
} from "lucide-react";
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

interface GoalData {
  label: string;
  current: number;
  goal: number;
  icon: React.ReactNode;
  color: string;
}

const mockSponsorData: BusinessData[] = [
  {
    id: "1",
    name: "Valley Recovery Center",
    totalTasksCompleted: 847,
    totalRevenue: 24500,
    personalAssistant: {
      tasksCompleted: 312,
      meetingsBooked: 28,
      messagesSent: 184,
    },
    newsletterAgent: {
      contentGenerated: 45,
      lifetimeSubscribers: 4521,
      subscribersGenerated: 892,
      mostPopularContent: [
        { title: "The Path to Recovery", views: 1243 },
        { title: "Understanding Addiction", views: 987 },
      ],
    },
    marketingAgent: {
      contentGeneratedMinutes: 234,
      viewsGenerated: 45600,
      conversionRate: 4.8,
    },
  },
  {
    id: "2",
    name: "Horizon Wellness",
    totalTasksCompleted: 623,
    totalRevenue: 18200,
    personalAssistant: {
      tasksCompleted: 245,
      meetingsBooked: 19,
      messagesSent: 156,
    },
    newsletterAgent: {
      contentGenerated: 38,
      lifetimeSubscribers: 3214,
      subscribersGenerated: 567,
      mostPopularContent: [
        { title: "Wellness Tips", views: 892 },
        { title: "Mindfulness Practices", views: 654 },
      ],
    },
    marketingAgent: {
      contentGeneratedMinutes: 187,
      viewsGenerated: 32100,
      conversionRate: 3.9,
    },
  },
  {
    id: "3",
    name: "New Dawn Treatment",
    totalTasksCompleted: 412,
    totalRevenue: 12800,
    personalAssistant: {
      tasksCompleted: 178,
      meetingsBooked: 14,
      messagesSent: 98,
    },
    newsletterAgent: {
      contentGenerated: 28,
      lifetimeSubscribers: 2156,
      subscribersGenerated: 324,
      mostPopularContent: [
        { title: "Treatment Options", views: 678 },
        { title: "Recovery Stories", views: 543 },
      ],
    },
    marketingAgent: {
      contentGeneratedMinutes: 123,
      viewsGenerated: 21400,
      conversionRate: 3.2,
    },
  },
];

function CircularProgress({ percentage, size = 80, strokeWidth = 6, color = "var(--primary)" }: { percentage: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

function GoalCard({ goal, locked }: { goal: GoalData; locked: boolean }) {
  const percentage = Math.min((goal.current / goal.goal) * 100, 100);
  
  return (
    <Card className={`bg-white/[0.03] border-white/[0.06] relative ${locked ? 'blur-sm select-none' : ''}`}>
      <CardContent className="p-4 flex flex-col items-center text-center">
        <CircularProgress 
          percentage={percentage} 
          color={goal.color}
          size={90}
          strokeWidth={6}
        />
        <div className="mt-3">
          <div className="flex items-center gap-1.5 justify-center mb-1">
            <span className="text-purple-400">{goal.icon}</span>
            <span className="text-xs text-gray-400">{goal.label}</span>
          </div>
          <p className="text-sm font-medium">{goal.current.toLocaleString()} / {goal.goal.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SponsorTab({ isLocked = false }: { isLocked?: boolean }) {
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<{ business: string; agent: string } | null>(null);

  const toggleBusiness = (id: string) => {
    setExpandedBusiness(expandedBusiness === id ? null : id);
  };

  const toggleAgent = (businessId: string, agent: string) => {
    const current = expandedAgent?.business === businessId && expandedAgent?.agent === agent;
    setExpandedAgent(current ? null : { business: businessId, agent });
  };

  const totalTasks = mockSponsorData.reduce((a, b) => a + b.totalTasksCompleted, 0);
  const totalRevenue = mockSponsorData.reduce((a, b) => a + b.totalRevenue, 0);
  const totalSubscribers = mockSponsorData.reduce((a, b) => a + b.newsletterAgent.lifetimeSubscribers, 0);
  const totalViews = mockSponsorData.reduce((a, b) => a + b.marketingAgent.viewsGenerated, 0);

  const goals: GoalData[] = [
    { label: "Tasks Goal", current: totalTasks, goal: 5000, icon: <Target className="w-3 h-3" />, color: "#a855f7" },
    { label: "Revenue Goal", current: totalRevenue, goal: 100000, icon: <DollarSign className="w-3 h-3" />, color: "#22c55e" },
    { label: "Subscribers Goal", current: totalSubscribers, goal: 50000, icon: <Users className="w-3 h-3" />, color: "#3b82f6" },
    { label: "Views Goal", current: totalViews, goal: 1000000, icon: <TrendingUp className="w-3 h-3" />, color: "#f59e0b" },
  ];

  return (
    <div className={`space-y-4 ${isLocked ? 'blur-sm select-none' : ''}`}>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {goals.map((goal) => (
          <GoalCard key={goal.label} goal={goal} locked={isLocked} />
        ))}
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Assets (Businesses)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mockSponsorData.map((business) => (
            <div key={business.id} className="border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleBusiness(business.id)}
                className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  <span className="font-medium">{business.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{business.totalTasksCompleted} tasks</span>
                  {expandedBusiness === business.id ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              </button>
              
              {expandedBusiness === business.id && (
                <div className="p-3 bg-black/20 border-t border-white/5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded p-2">
                      <p className="text-xs text-gray-400">Tasks</p>
                      <p className="font-bold">{business.totalTasksCompleted}</p>
                    </div>
                    <div className="bg-white/5 rounded p-2">
                      <p className="text-xs text-gray-400">Revenue</p>
                      <p className="font-bold">${business.totalRevenue.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 flex items-center gap-1"><Bot className="w-3 h-3" /> AI Agents</p>
                    
                    {["personal", "newsletter", "marketing"].map((agent) => (
                      <div key={agent} className="border border-white/5 rounded">
                        <button
                          onClick={() => toggleAgent(business.id, agent)}
                          className="w-full p-2 flex items-center justify-between bg-white/5 hover:bg-white/10 text-xs"
                        >
                          <span className="capitalize">{agent} Assistant</span>
                          {expandedAgent?.business === business.id && expandedAgent?.agent === agent ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </button>
                        {expandedAgent?.business === business.id && expandedAgent?.agent === agent && (
                          <div className="p-2 bg-black/20 border-t border-white/5 grid grid-cols-3 gap-1">
                            {agent === "personal" && (
                              <>
                                <div className="bg-white/5 rounded p-1"><p className="text-[10px] text-gray-400">Tasks</p><p className="font-bold text-xs">{business.personalAssistant.tasksCompleted}</p></div>
                                <div className="bg-white/5 rounded p-1"><p className="text-[10px] text-gray-400">Meetings</p><p className="font-bold text-xs">{business.personalAssistant.meetingsBooked}</p></div>
                                <div className="bg-white/5 rounded p-1"><p className="text-[10px] text-gray-400">Messages</p><p className="font-bold text-xs">{business.personalAssistant.messagesSent}</p></div>
                              </>
                            )}
                            {agent === "newsletter" && (
                              <>
                                <div className="bg-white/5 rounded p-1"><p className="text-[10px] text-gray-400">Posts</p><p className="font-bold text-xs">{business.newsletterAgent.contentGenerated}</p></div>
                                <div className="bg-white/5 rounded p-1"><p className="text-[10px] text-gray-400">Subs</p><p className="font-bold text-xs">{business.newsletterAgent.lifetimeSubscribers}</p></div>
                                <div className="bg-white/5 rounded p-1"><p className="text-[10px] text-gray-400">New</p><p className="font-bold text-xs">+{business.newsletterAgent.subscribersGenerated}</p></div>
                              </>
                            )}
                            {agent === "marketing" && (
                              <>
                                <div className="bg-white/5 rounded p-1"><p className="text-[10px] text-gray-400">Min</p><p className="font-bold text-xs">{business.marketingAgent.contentGeneratedMinutes}</p></div>
                                <div className="bg-white/5 rounded p-1"><p className="text-[10px] text-gray-400">Views</p><p className="font-bold text-xs">{(business.marketingAgent.viewsGenerated / 1000).toFixed(1)}k</p></div>
                                <div className="bg-white/5 rounded p-1"><p className="text-[10px] text-gray-400">Conv%</p><p className="font-bold text-xs">{business.marketingAgent.conversionRate}</p></div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
