"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Plus, Edit2, Trash2, Loader2, ChevronDown, ChevronRight,
  X, AlertTriangle, Search, Building2, Video, Target, TrendingUp,
  CircleDollarSign, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@/hooks/use-profile";
import { authFetch } from "@/lib/auth";
import { AgiTemplateLauncher } from "@/components/agi/AgiTemplateLauncher";

interface Campaign {
  id: string;
  profile_id: string | null;
  name: string;
  status: "active" | "paused" | "draft" | "completed";
  type: string;
  budget: string;
  platform: string;
  description: string;
  thumbnail: string;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ["active", "paused", "draft", "completed"];
const GRADIENT_OPTIONS = [
  "from-purple-600 to-blue-500",
  "from-blue-600 to-cyan-500",
  "from-cyan-600 to-teal-500",
  "from-teal-600 to-blue-600",
  "from-amber-500 to-yellow-600",
  "from-orange-500 to-amber-600",
  "from-red-600 to-orange-500",
  "from-yellow-500 to-orange-500",
  "from-green-500 to-emerald-600",
  "from-pink-500 to-rose-600",
];

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  paused: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

const statusLabels: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  completed: "Completed",
};

export function AdminCampaigns({ users, onRefresh }: { users: Profile[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<"all" | string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/campaigns");
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Group by user
  const userMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    for (const u of users) m[u.id] = u;
    return m;
  }, [users]);

  const grouped = useMemo(() => {
    const g: Record<string, Campaign[]> = {};
    for (const c of campaigns) {
      const key = c.profile_id || "unassigned";
      if (!g[key]) g[key] = [];
      g[key].push(c);
    }
    return g;
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;
    if (campaignFilter !== "all") {
      filtered = filtered.filter(c => c.status === campaignFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c => {
        const user = c.profile_id ? userMap[c.profile_id] : null;
        const userName = user?.business_name || user?.name || "";
        return c.name.toLowerCase().includes(q) || userName.toLowerCase().includes(q);
      });
    }
    return filtered;
  }, [campaigns, campaignFilter, search, userMap]);

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 sm:gap-4">
        {[
          { label: "Total", value: totalCampaigns, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Active", value: activeCampaigns, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Businesses", value: Object.keys(grouped).filter(k => k !== "unassigned").length, color: "text-blue-400", bg: "bg-blue-500/10" },
        ].map(s => (
          <Card key={s.label} className="bg-white/[0.03] border-white/[0.06]">
            <CardContent className="p-4 flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg ${s.bg} flex-shrink-0`}>
                <Briefcase className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-white leading-tight">{loading ? "—" : s.value}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns card — matches dashboard style */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg text-white">Campaigns</CardTitle>
            <Badge className={`text-xs ${statusColors.active}`}>
              {activeCampaigns} active
            </Badge>
            <AgiTemplateLauncher onApplied={load} />
          </div>
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 -mb-1">
            {(["all", "active", "paused", "draft", "completed"] as const).map((filter) => (
              <Button
                key={filter}
                variant="ghost"
                className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 whitespace-nowrap ${campaignFilter === filter ? "bg-white/10 text-white" : "text-gray-500"}`}
                onClick={() => setCampaignFilter(filter)}
              >
                {filter === "all" ? "All" : statusLabels[filter]}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 sm:w-44 h-8 bg-white/5 border-white/10 text-white placeholder:text-gray-600 text-sm" />
            <Button size="sm" className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white h-8 gap-1.5 text-xs flex-shrink-0"
              onClick={() => setShowAdd(true)}>
              <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add Campaign</span><span className="sm:hidden">Add</span>
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <Video className="w-8 h-8 text-gray-700 mx-auto mb-4" />
              <p className="text-sm text-gray-500 mb-1">
                {search ? "No campaigns match your search." : "No campaigns match this filter"}
              </p>
              <p className="text-xs text-gray-600">Try selecting a different status filter above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map((c, i) => {
                const user = c.profile_id ? userMap[c.profile_id] : null;
                const ownerName = user?.business_name || user?.name || user?.username || "Unassigned";
                const isExpanded = expandedId === c.id;
                return (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.07 }}
                    className={`flex flex-col gap-0 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${isExpanded ? 'border-purple-500/40 bg-purple-500/5' : 'bg-white/[0.02] border-white/[0.04] hover:border-white/10 hover:bg-white/[0.04]'}`}
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <div className="flex items-center gap-4 sm:gap-4 p-4 sm:p-4">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${c.thumbnail} flex-shrink-0 p-[1px]`}>
                        <div className="w-full h-full rounded-lg bg-[#0a0a0a] flex items-center justify-center">
                          <Video className="w-5 h-5 text-white/70" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500">{ownerName}</span>
                          <Badge className={`text-[10px] border ${statusColors[c.status] || statusColors.draft}`}>
                            {statusLabels[c.status] || c.status}
                          </Badge>
                        </div>
                      </div>

                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-500 hover:text-white flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); setEditing(c); }}>
                        <Edit2 className="w-3 h-3" />
                      </Button>

                      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${isExpanded ? 'text-purple-400 rotate-90' : 'text-gray-600'}`} />
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-0 border-t border-white/5">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                              <div className="flex flex-col items-center gap-1 p-4 rounded-lg bg-white/[0.03] border border-white/5">
                                <Target className="w-4 h-4 text-purple-400" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Status</span>
                                <span className="text-xs font-medium text-white">{statusLabels[c.status] || c.status}</span>
                              </div>
                              <div className="flex flex-col items-center gap-1 p-4 rounded-lg bg-white/[0.03] border border-white/5">
                                <TrendingUp className="w-4 h-4 text-cyan-400" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Type</span>
                                <span className="text-xs font-medium text-white truncate max-w-full">{c.type || 'TBD'}</span>
                              </div>
                              <div className="flex flex-col items-center gap-1 p-4 rounded-lg bg-white/[0.03] border border-white/5">
                                <CircleDollarSign className="w-4 h-4 text-green-400" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Budget</span>
                                <span className="text-xs font-medium text-white">{c.budget || '$0'}</span>
                              </div>
                              <div className="flex flex-col items-center gap-1 p-4 rounded-lg bg-white/[0.03] border border-white/5">
                                <BarChart3 className="w-4 h-4 text-blue-400" />
                                <span className="text-[10px] text-gray-500 uppercase tracking-wide">Platform</span>
                                <span className="text-xs font-medium text-white">{c.platform || 'TBD'}</span>
                              </div>
                            </div>
                            {c.description && (
                              <p className="text-xs text-gray-400 mt-3">{c.description}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-3 text-center">Campaign details and analytics coming soon</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Campaign Dialog */}
      <CampaignDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        users={users}
        onSaved={load}
      />

      {/* Edit Campaign Dialog */}
      {editing && (
        <CampaignDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          users={users}
          onSaved={load}
          campaign={editing}
        />
      )}
    </div>
  );
}

function CampaignDialog({ open, onClose, users, onSaved, campaign }: {
  open: boolean;
  onClose: () => void;
  users: Profile[];
  onSaved: () => void;
  campaign?: Campaign;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEdit = !!campaign;

  const [form, setForm] = useState({
    profile_id: "",
    name: "",
    status: "draft",
    type: "",
    budget: "$0",
    platform: "",
    description: "",
    thumbnail: "from-purple-600 to-blue-500",
  });

  useEffect(() => {
    if (open) {
      if (campaign) {
        setForm({
          profile_id: campaign.profile_id || "",
          name: campaign.name,
          status: campaign.status,
          type: campaign.type,
          budget: campaign.budget,
          platform: campaign.platform,
          description: campaign.description,
          thumbnail: campaign.thumbnail,
        });
      } else {
        setForm({
          profile_id: "", name: "", status: "draft", type: "",
          budget: "$0", platform: "", description: "",
          thumbnail: "from-purple-600 to-blue-500",
        });
      }
      setConfirmDelete(false);
    }
  }, [open, campaign]);

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        profile_id: form.profile_id || null,
      };
      const url = isEdit ? `/api/admin/campaigns/${campaign!.id}` : "/api/admin/campaigns";
      const res = await authFetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: isEdit ? "Updated" : "Created" });
      onSaved();
      onClose();
    } catch {
      toast({ title: "Error saving campaign", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!campaign) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Deleted" });
      onSaved();
      onClose();
    } catch {
      toast({ title: "Error deleting", variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white w-full max-w-md mx-2 sm:mx-auto rounded-xl p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/5">
          <DialogTitle className="text-white text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-purple-400" />
            {isEdit ? "Edit Campaign" : "New Campaign"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Assign to user */}
          <Field label="Assign to Business">
            <select value={form.profile_id} onChange={e => set("profile_id")(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 h-9">
              <option value="" className="bg-[#111]">Unassigned (Admin only)</option>
              {users.map(u => (
                <option key={u.id} value={u.id} className="bg-[#111]">
                  {u.business_name || u.name || u.username || u.email}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Campaign Name *">
            <Input value={form.name} onChange={e => set("name")(e.target.value)}
              placeholder="e.g. Spring Awareness Push"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-700 h-9 text-sm" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select value={form.status} onChange={e => set("status")(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 h-9">
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s} className="bg-[#111]">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <Input value={form.type} onChange={e => set("type")(e.target.value)}
                placeholder="e.g. Brand, Outreach"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-700 h-9 text-sm" />
            </Field>
            <Field label="Budget">
              <Input value={form.budget} onChange={e => set("budget")(e.target.value)}
                placeholder="$0"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-700 h-9 text-sm" />
            </Field>
            <Field label="Platform">
              <Input value={form.platform} onChange={e => set("platform")(e.target.value)}
                placeholder="e.g. Meta, Google, TikTok"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-700 h-9 text-sm" />
            </Field>
          </div>

          <Field label="Description">
            <textarea value={form.description} onChange={e => set("description")(e.target.value)}
              placeholder="Brief description of campaign goals..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/50 resize-none" />
          </Field>

          {/* Color */}
          <Field label="Color">
            <div className="flex flex-wrap gap-1.5">
              {GRADIENT_OPTIONS.map(g => (
                <button key={g} onClick={() => set("thumbnail")(g)}
                  className={`w-7 h-7 rounded-md bg-gradient-to-br ${g} border-2 transition-all ${form.thumbnail === g ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
                />
              ))}
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 space-y-2">
          <AnimatePresence>
            {confirmDelete && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300 flex-1">Delete this campaign permanently?</p>
                  <Button size="sm" className="bg-red-600 hover:bg-red-500 border-0 text-white h-7 text-xs flex-shrink-0" onClick={handleDelete} disabled={deleting}>
                    {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                  </Button>
                  <button className="text-gray-500 hover:text-white" onClick={() => setConfirmDelete(false)}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-2">
            {isEdit && (
              <Button variant="outline" size="sm"
                className="border-red-500/20 text-red-400 hover:bg-red-500/10 h-9 gap-1.5"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting || confirmDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            )}
            <Button variant="outline" className="flex-1 border-white/10 text-gray-400 h-9" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white h-9" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
