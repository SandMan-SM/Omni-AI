"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Shield, Users, Crown, Loader2, ArrowLeft,
  Check, UserCog, Mail, Phone, Building2, CircleDot, Command, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, type Profile } from "@/hooks/use-profile";
import { useToast } from "@/hooks/use-toast";
import { CursorSpotlight } from "@/components/cursor-spotlight";
import { NewsletterStudio } from "@/components/newsletter-studio";

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { profile, profileLoading, isAdmin, fetchAllUsers, updateUserRole } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!profileLoading && profile && !isAdmin) {
      toast({ title: "Access Denied", description: "You don't have admin privileges.", variant: "destructive" });
      router.push("/dashboard");
    }
  }, [profile, profileLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    setUsersLoading(true);
    const { users: fetchedUsers, error } = await fetchAllUsers();
    if (error) {
      toast({ title: "Error", description: "Failed to load users.", variant: "destructive" });
    } else {
      setUsers(fetchedUsers);
    }
    setUsersLoading(false);
  };

  const handleMakeAdmin = async (userId: string) => {
    setUpdatingId(userId);
    const { error } = await updateUserRole(userId, "admin");
    if (error) {
      toast({ title: "Error", description: "Failed to update user role.", variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "User has been promoted to admin." });
      await loadUsers();
    }
    setUpdatingId(null);
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (userId === user?.id) {
      toast({ title: "Error", description: "You cannot remove your own admin access.", variant: "destructive" });
      return;
    }
    setUpdatingId(userId);
    const { error } = await updateUserRole(userId, "user");
    if (error) {
      toast({ title: "Error", description: "Failed to update user role.", variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Admin privileges removed." });
      await loadUsers();
    }
    setUpdatingId(null);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const adminCount = users.filter(u => u.role === "admin").length;
  const totalUsers = users.length;
  const completedOnboarding = users.filter(u => u.onboarding_completed).length;

  return (
    <div className="min-h-screen bg-[#050505] text-white noise-overlay">
      <CursorSpotlight />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            className="border-white/20 bg-transparent text-gray-400"
            onClick={() => router.push("/dashboard")}
            data-testid="button-admin-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gradient flex items-center gap-3" data-testid="text-admin-heading">
              <Shield className="w-7 h-7 text-purple-400" />
              Admin Panel
            </h1>
            <p className="text-gray-400 text-sm mt-1">Manage users and roles</p>
          </div>
        </div>

        {/* Super Admin Command Center Card */}
        {profile?.role === 'super_admin' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent" />
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-purple-500/20">
                      <Command className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Interlinked Command Center</h3>
                      <p className="text-sm text-gray-300">Multi-client admin control over all 7 Interlinked clients</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => router.push('/admin/interlinked')}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white whitespace-nowrap"
                  >
                    Access Center
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="users" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
              <UserCog className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">
              <Mail className="w-4 h-4 mr-2" />
              Newsletter Studio
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white" data-testid="text-total-users">{totalUsers}</p>
                    <p className="text-xs text-gray-400">Total Users</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Crown className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white" data-testid="text-admin-count">{adminCount}</p>
                    <p className="text-xs text-gray-400">Admins</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Check className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white" data-testid="text-onboarded-count">{completedOnboarding}</p>
                    <p className="text-xs text-gray-400">Onboarded</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/5 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-gray-400" />
                  Users
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-transparent text-gray-400"
                  onClick={loadUsers}
                  data-testid="button-refresh-users"
                >
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No users found</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <motion.div
                        key={u.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]"
                        data-testid={`user-row-${u.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white truncate">
                              {u.name || "No name"}
                            </span>
                            <Badge
                              className={`text-[10px] ${
                                u.role === "admin"
                                  ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                  : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                              }`}
                            >
                              {u.role}
                            </Badge>
                            {u.onboarding_completed && (
                              <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20">
                                Onboarded
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {u.email}
                            </span>
                            {u.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {u.phone}
                              </span>
                            )}
                            {u.business_name && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {u.business_name}
                              </span>
                            )}
                            {u.activated_platforms?.length > 0 && (
                              <span className="flex items-center gap-1">
                                <CircleDot className="w-3 h-3 text-green-400" />
                                {u.activated_platforms.length} platforms
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          {u.role === "admin" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/20 bg-transparent text-red-400 text-xs"
                              onClick={() => handleRemoveAdmin(u.id)}
                              disabled={updatingId === u.id || u.id === user?.id}
                              data-testid={`button-remove-admin-${u.id}`}
                            >
                              {updatingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Remove Admin"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white text-xs"
                              onClick={() => handleMakeAdmin(u.id)}
                              disabled={updatingId === u.id}
                              data-testid={`button-make-admin-${u.id}`}
                            >
                              {updatingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Make Admin"}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Newsletter Studio Tab */}
          <TabsContent value="newsletter" className="mt-0">
            <NewsletterStudio />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
