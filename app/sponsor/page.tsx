"use client";
export const dynamic = 'force-dynamic';

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Landmark, Building2, Bot, Calendar, Mail, Target, ChevronDown, ChevronRight,
  CheckCircle, TrendingUp, Users, FileText, Eye, MousePointer, DollarSign,
  MessageSquare, BarChart3, LayoutDashboard
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { CursorSpotlight } from "@/components/cursor-spotlight";

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
        { title: "Family Support Guide", views: 756 },
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
        { title: "Healthy Living", views: 521 },
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
        { title: "Success Rates", views: 412 },
      ],
    },
    marketingAgent: {
      contentGeneratedMinutes: 123,
      viewsGenerated: 21400,
      conversionRate: 3.2,
    },
  },
];

export default function Sponsor() {
  const { user, loading: authLoading } = useAuth();
  const { profile, profileLoading } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<{ business: string; agent: string } | null>(null);

  const isSponsor = profile?.role === "sponsor" || profile?.is_sponsor === true;

  if (!isSponsor) {
    return (
      <div className="min-h-screen bg-[#050505] text-white noise-overlay">
        <CursorSpotlight />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Sponsor Access Required</h1>
          <p className="text-gray-400 mb-8">You need to be a sponsor to view this page.</p>
          <Button onClick={() => router.push("/sponsor/info")}>
            View Sponsor Info
          </Button>
        </div>
      </div>
    );
  }

  const toggleBusiness = (id: string) => {
    setExpandedBusiness(expandedBusiness === id ? null : id);
  };

  const toggleAgent = (businessId: string, agent: string) => {
    const key = `${businessId}-${agent}`;
    const current = expandedAgent?.business === businessId && expandedAgent?.agent === agent;
    setExpandedAgent(current ? null : { business: businessId, agent });
  };

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold text-gradient">
            Omni AI
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white"
              onClick={() => router.push("/dashboard")}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="ghost" onClick={() => router.push("/sponsor/info")}>
              Learn More
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        <motion.div initial="initial" animate="animate" variants={fadeUp} className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Sponsor Insights</h2>
          <p className="text-gray-400">Your sponsored business analytics</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-purple-900/20 border-purple-500/20">
            <CardContent className="p-6">
              <p className="text-purple-400 text-sm">Total Tasks</p>
              <p className="text-3xl font-bold">{mockSponsorData.reduce((a, b) => a + b.totalTasksCompleted, 0).toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-900/20 border-purple-500/20">
            <CardContent className="p-6">
              <p className="text-purple-400 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold">${mockSponsorData.reduce((a, b) => a + b.totalRevenue, 0).toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-900/20 border-purple-500/20">
            <CardContent className="p-6">
              <p className="text-purple-400 text-sm">Assets</p>
              <p className="text-3xl font-bold">{mockSponsorData.length}</p>
            </CardContent>
          </Card>
        </div>

        <motion.div variants={fadeUp}>
          <h3 className="text-lg font-semibold mb-4">Assets (Businesses)</h3>
          <div className="space-y-4">
            {mockSponsorData.map((business) => (
              <div key={business.id} className="border border-white/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleBusiness(business.id)}
                  className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-semibold">{business.name}</h4>
                      <p className="text-sm text-gray-400">
                        {business.totalTasksCompleted.toLocaleString()} tasks • ${business.totalRevenue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {expandedBusiness === business.id ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                
                {expandedBusiness === business.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="bg-black/20 border-t border-white/5"
                  >
                    <div className="p-4 grid md:grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">Total Tasks Completed</p>
                        <p className="text-2xl font-bold text-purple-400">{business.totalTasksCompleted.toLocaleString()}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">Total Revenue Generated</p>
                        <p className="text-2xl font-bold text-purple-400">${business.totalRevenue.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <h5 className="font-semibold text-gray-300 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-purple-400" />
                        AI Agents
                      </h5>
                      
                      <div className="border border-white/10 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleAgent(business.id, "personal")}
                          className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span className="text-sm">Personal Assistant</span>
                          </div>
                          {expandedAgent?.business === business.id && expandedAgent?.agent === "personal" ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        {expandedAgent?.business === business.id && expandedAgent?.agent === "personal" && (
                          <div className="p-3 bg-black/20 border-t border-white/5 grid md:grid-cols-3 gap-3">
                            <div className="bg-white/5 rounded p-3">
                              <p className="text-xs text-gray-400">Tasks Completed</p>
                              <p className="font-bold">{business.personalAssistant.tasksCompleted}</p>
                            </div>
                            <div className="bg-white/5 rounded p-3">
                              <p className="text-xs text-gray-400">Meetings Booked</p>
                              <p className="font-bold">{business.personalAssistant.meetingsBooked}</p>
                            </div>
                            <div className="bg-white/5 rounded p-3">
                              <p className="text-xs text-gray-400">Messages Sent</p>
                              <p className="font-bold">{business.personalAssistant.messagesSent}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border border-white/10 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleAgent(business.id, "newsletter")}
                          className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-green-400" />
                            <span className="text-sm">Newsletter Agent</span>
                          </div>
                          {expandedAgent?.business === business.id && expandedAgent?.agent === "newsletter" ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        {expandedAgent?.business === business.id && expandedAgent?.agent === "newsletter" && (
                          <div className="p-3 bg-black/20 border-t border-white/5 space-y-3">
                            <div className="grid md:grid-cols-3 gap-3">
                              <div className="bg-white/5 rounded p-3">
                                <p className="text-xs text-gray-400">Content Generated</p>
                                <p className="font-bold">{business.newsletterAgent.contentGenerated} posts</p>
                              </div>
                              <div className="bg-white/5 rounded p-3">
                                <p className="text-xs text-gray-400">Lifetime Subscribers</p>
                                <p className="font-bold">{business.newsletterAgent.lifetimeSubscribers.toLocaleString()}</p>
                              </div>
                              <div className="bg-white/5 rounded p-3">
                                <p className="text-xs text-gray-400">Subscribers Generated</p>
                                <p className="font-bold">+{business.newsletterAgent.subscribersGenerated}</p>
                              </div>
                            </div>
                            <div className="bg-white/5 rounded p-3">
                              <p className="text-xs text-gray-400 mb-2">Most Popular Content</p>
                              <div className="space-y-1">
                                {business.newsletterAgent.mostPopularContent.map((content, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="truncate">{content.title}</span>
                                    <Badge variant="outline" className="border-white/20">{content.views.toLocaleString()} views</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border border-white/10 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleAgent(business.id, "marketing")}
                          className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-pink-400" />
                            <span className="text-sm">Marketing Agent</span>
                          </div>
                          {expandedAgent?.business === business.id && expandedAgent?.agent === "marketing" ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        {expandedAgent?.business === business.id && expandedAgent?.agent === "marketing" && (
                          <div className="p-3 bg-black/20 border-t border-white/5 grid md:grid-cols-3 gap-3">
                            <div className="bg-white/5 rounded p-3">
                              <p className="text-xs text-gray-400">Content Generated</p>
                              <p className="font-bold">{business.marketingAgent.contentGeneratedMinutes} min</p>
                            </div>
                            <div className="bg-white/5 rounded p-3">
                              <p className="text-xs text-gray-400">Views Generated</p>
                              <p className="font-bold">{business.marketingAgent.viewsGenerated.toLocaleString()}</p>
                            </div>
                            <div className="bg-white/5 rounded p-3">
                              <p className="text-xs text-gray-400">Conversion Rate</p>
                              <p className="font-bold">{business.marketingAgent.conversionRate}%</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
