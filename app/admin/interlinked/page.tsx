"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Globe, Zap, Database, CreditCard, LogOut, ChevronRight, Loader2,
  Send, Eye, AlertCircle, Users, TrendingUp, Mail, Command
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSuperAdmin } from "@/hooks/use-super-admin";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { CursorSpotlight } from "@/components/cursor-spotlight";

const CLIENT_NAMES = [
  "Imperium",
  "Alira",
  "Omni AI",
  "North Peak",
  "CPS",
  "Leifson Built",
  "Youngs"
];

function StatCard({ icon: Icon, label, value, trend }: { icon: React.ElementType; label: string; value: string | number; trend?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-2xl font-bold text-white">{value}</p>
              {trend !== undefined && (
                <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {trend >= 0 ? '+' : ''}{trend}%
                </p>
              )}
            </div>
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Icon className="w-5 h-5 text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ClientStatusCard({ client, stats }: { client: any; stats: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="bg-white/5 border-white/10 mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Command className="w-5 h-5 text-purple-400" />
              {client.name}
            </CardTitle>
            <Badge
              className={`${
                client.status === 'active'
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : client.status === 'pending'
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
              }`}
            >
              {client.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {client.website && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Globe className="w-4 h-4 text-purple-400" />
                <span className="truncate">{client.website}</span>
              </div>
            )}
            {client.telegram_bot && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="truncate">{client.telegram_bot}</span>
              </div>
            )}
            {client.supabase_project && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Database className="w-4 h-4 text-purple-400" />
                <span className="truncate">{client.supabase_project}</span>
              </div>
            )}
            {client.stripe_status && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <CreditCard className="w-4 h-4 text-purple-400" />
                <Badge
                  className={`text-[10px] ${
                    client.stripe_status === 'active'
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                >
                  {client.stripe_status}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function KPIMetrics({ selectedClient, stats }: { selectedClient: any; stats: any }) {
  const clientStats = stats.by_client[selectedClient?.id] || {
    revenue: 0,
    leads: 0,
    subscribers: 0,
    newsletters_sent: 0,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard
        icon={TrendingUp}
        label="Revenue"
        value={`$${clientStats.revenue.toLocaleString()}`}
      />
      <StatCard
        icon={Users}
        label="Leads"
        value={clientStats.leads.toLocaleString()}
      />
      <StatCard
        icon={Mail}
        label="Subscribers"
        value={clientStats.subscribers.toLocaleString()}
      />
      <StatCard
        icon={Send}
        label="Newsletters Sent"
        value={clientStats.newsletters_sent}
      />
    </div>
  );
}

function QuickActions({ selectedClient }: { selectedClient: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6"
    >
      <p className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-purple-400" />
        Quick Actions
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="border-white/20 bg-transparent text-gray-300 text-sm h-9"
        >
          <Eye className="w-3 h-3 mr-1" />
          View Bot Status
        </Button>
        <Button
          variant="outline"
          className="border-white/20 bg-transparent text-gray-300 text-sm h-9"
        >
          <Send className="w-3 h-3 mr-1" />
          Send Newsletter
        </Button>
        <Button
          variant="outline"
          className="border-white/20 bg-transparent text-gray-300 text-sm h-9"
        >
          <Database className="w-3 h-3 mr-1" />
          View Database
        </Button>
      </div>
    </motion.div>
  );
}

export default function InterlinkedCommandCenter() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const {
    isSuperAdmin,
    clients,
    selectedClient,
    setSelectedClient,
    aggregateStats,
    loading,
    error,
  } = useSuperAdmin();

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have super admin privileges.",
        variant: "destructive",
      });
      router.push("/dashboard");
    }
  }, [loading, isSuperAdmin, router, toast]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabaseClient.auth.signOut();
      router.push("/");
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to sign out.",
        variant: "destructive",
      });
      setSigningOut(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-x-0 top-0 z-40 bg-[#050505] border-b border-white/5 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gradient flex items-center gap-2">
              <Command className="w-7 h-7 text-purple-400" />
              Interlinked Command Center
            </h1>
            <p className="text-xs text-gray-400 mt-1">Multi-client admin control — $Mafi</p>
          </div>
          <Button
            variant="outline"
            className="border-red-500/20 bg-transparent text-red-400 hover:text-red-300"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            <span className="ml-2">Sign Out</span>
          </Button>
        </div>
      </motion.div>

      <div className="pt-24 pb-8 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Aggregate Stats */}
          {clients.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <p className="text-sm font-semibold text-gray-400 mb-4">AGGREGATE METRICS</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  icon={TrendingUp}
                  label="Total Revenue (All Clients)"
                  value={`$${aggregateStats.total_revenue.toLocaleString()}`}
                />
                <StatCard
                  icon={Users}
                  label="Total Leads (All Clients)"
                  value={aggregateStats.total_leads.toLocaleString()}
                />
                <StatCard
                  icon={Mail}
                  label="Total Subscribers (All Clients)"
                  value={aggregateStats.total_subscribers.toLocaleString()}
                />
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-4"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Error</p>
                <p className="text-xs text-red-300 mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Main Content: Sidebar + Details */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar: Client List */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-1"
            >
              <Card className="bg-white/5 border-white/10 sticky top-32">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    Clients ({clients.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
                  {clients.length === 0 ? (
                    <p className="text-xs text-gray-500 py-4">No clients found</p>
                  ) : (
                    clients.map((client) => (
                      <motion.button
                        key={client.id}
                        onClick={() => setSelectedClient(client)}
                        whileHover={{ x: 4 }}
                        className={`w-full text-left px-3 py-2 rounded-md transition-all text-sm flex items-center justify-between group ${
                          selectedClient?.id === client.id
                            ? "bg-purple-500/20 border border-purple-500/30 text-white"
                            : "text-gray-400 hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate">{client.name}</span>
                        <ChevronRight className={`w-3 h-3 transition-opacity ${selectedClient?.id === client.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                      </motion.button>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Right: Client Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-3"
            >
              {selectedClient ? (
                <div>
                  <ClientStatusCard client={selectedClient} stats={aggregateStats} />
                  <KPIMetrics selectedClient={selectedClient} stats={aggregateStats} />
                  <QuickActions selectedClient={selectedClient} />

                  {/* Recent Newsletter Activity */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Card className="bg-white/5 border-white/10">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-white flex items-center gap-2">
                          <Mail className="w-4 h-4 text-purple-400" />
                          Recent Newsletter Sends
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-gray-500 py-8 text-center">
                          Newsletter activity data will appear here
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              ) : (
                <Card className="bg-white/5 border-white/10 h-96 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-400 mb-2">Select a client to view details</p>
                    <p className="text-xs text-gray-600">{clients.length} client{clients.length !== 1 ? 's' : ''} available</p>
                  </div>
                </Card>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
