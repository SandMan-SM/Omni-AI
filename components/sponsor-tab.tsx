"use client";
import { motion } from "framer-motion";
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

function CircularProgress({ value, size = 100, strokeWidth = 8, color = "#a855f7", label = "" }: { value: number; size?: number; strokeWidth?: number; color?: string; label?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(value, 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center" style={{ width: size + 20 }}>
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
          <div className="text-center">
            <span className="text-xl font-bold">{value.toLocaleString()}</span>
            {label && <p className="text-[10px] text-gray-400">{label}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SponsorTab({ isLocked = false }: { isLocked?: boolean }) {
  return (
    <div className={`space-y-4 ${isLocked ? 'blur-sm select-none pointer-events-none' : ''}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Command Center
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col items-center">
                <CircularProgress 
                  value={business.totalTasksCompleted} 
                  color="#a855f7"
                  size={80}
                  strokeWidth={6}
                  label="Tasks"
                />
              </div>
              <div className="flex flex-col items-center">
                <CircularProgress 
                  value={business.totalRevenue} 
                  color="#22c55e"
                  size={80}
                  strokeWidth={6}
                  label="Revenue"
                />
                <p className="text-sm font-bold text-green-400 mt-1">${business.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-center">
                <CircularProgress 
                  value={business.newsletterAgent.lifetimeSubscribers} 
                  color="#3b82f6"
                  size={80}
                  strokeWidth={6}
                  label="Subs"
                />
              </div>
              <div className="flex flex-col items-center">
                <CircularProgress 
                  value={business.marketingAgent.viewsGenerated} 
                  color="#f59e0b"
                  size={80}
                  strokeWidth={6}
                  label="Views"
                />
                <p className="text-sm font-bold text-amber-400 mt-1">{(business.marketingAgent.viewsGenerated / 1000).toFixed(1)}k</p>
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium">AI Agents</span>
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
