"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Mail, Users, Crown, Zap, Download, Upload, Plus, Trash2,
  Send, DollarSign, RefreshCw, Loader2, TrendingUp, Star,
  CheckCircle, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  subscription_tier: 'subscribed' | 'premium';
  subscribed: boolean;
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  premium: number;
  free: number;
  unsubscribed: number;
}

export function NewsletterStudio() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, premium: 0, free: 0, unsubscribed: 0 });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Add subscriber form
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<'subscribed' | 'premium'>('subscribed');
  const [addLoading, setAddLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Admin-only endpoints — `requireAdmin()` accepts either a Supabase
      // cookie session OR the `omni_token` bearer minted by the auth-login
      // edge function. Admin panel visitors hit the latter path, so always
      // forward the token when it's in localStorage.
      const token = typeof window !== 'undefined' ? localStorage.getItem('omni_token') : null;
      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [subRes, statRes] = await Promise.all([
        fetch('/api/newsletter/subscribers', { headers: authHeaders }),
        fetch('/api/newsletter/stats', { headers: authHeaders }),
      ]);
      if (subRes.ok) {
        const d = await subRes.json();
        setSubscribers(d.subscribers || []);
      }
      if (statRes.ok) {
        setStats(await statRes.json());
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load newsletter data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, []);

  const handleSendNow = async () => {
    if (!confirm('Send the newsletter now to all channels?')) return;
    setSending(true);
    try {
      const res = await fetch('/api/newsletter/send', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: '✅ Newsletter Sent',
          description: `"${data.subject}" — Telegram: ${data.telegram ? '✓' : '✗'} | Email: ${data.email ? '✓' : '✗'} | Premium: ${data.premium_recipients}`,
        });
      } else {
        toast({ title: 'Send Failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Connection error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/newsletter/export');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omni_newsletter_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Export Failed', description: 'Could not export CSV', variant: 'destructive' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/newsletter/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        toast({ title: '✅ Import Complete', description: `${data.added} added, ${data.skipped} skipped` });
        fetchAll();
      } else {
        toast({ title: 'Import Failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Import Error', description: 'Failed to process CSV', variant: 'destructive' });
    }
    e.target.value = '';
  };

  const handleCreatePaymentLink = async () => {
    setCreatingLink(true);
    try {
      const res = await fetch('/api/newsletter/payment-link', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setPaymentUrl(data.payment_url);
        toast({ title: '✅ Payment Link Created', description: '$5/month premium subscription link ready.' });
      } else {
        toast({ title: 'Stripe Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create payment link', variant: 'destructive' });
    } finally {
      setCreatingLink(false);
    }
  };

  const handleToggleTier = async (sub: Subscriber) => {
    setUpdatingId(sub.id);
    const newTier = sub.subscription_tier === 'premium' ? 'subscribed' : 'premium';
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('omni_token') : null;
      const res = await fetch(`/api/newsletter/subscribers/${sub.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ subscription_tier: newTier }),
      });
      if (res.ok) {
        setSubscribers(prev => prev.map(s => s.id === sub.id ? { ...s, subscription_tier: newTier } : s));
        setStats(prev => ({
          ...prev,
          premium: prev.premium + (newTier === 'premium' ? 1 : -1),
          free: prev.free + (newTier !== 'premium' ? 1 : -1),
        }));
        toast({ title: 'Updated', description: `${sub.email} → ${newTier}` });
      }
    } catch {
      toast({ title: 'Error', description: 'Update failed', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (sub: Subscriber) => {
    if (!confirm(`Remove ${sub.email}?`)) return;
    setUpdatingId(sub.id);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('omni_token') : null;
      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/newsletter/subscribers/${sub.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        setSubscribers(prev => prev.filter(s => s.id !== sub.id));
        toast({ title: 'Removed', description: sub.email });
        fetchAll();
      }
    } catch {
      toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddSubscriber = async () => {
    if (!newEmail) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/newsletter/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, first_name: newName || null, subscription_tier: newTier }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: '✅ Added', description: newEmail });
        setNewEmail(''); setNewName(''); setNewTier('subscribed');
        setAddOpen(false);
        fetchAll();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Connection error', variant: 'destructive' });
    } finally {
      setAddLoading(false);
    }
  };

  const statCards = [
    { label: 'Total', value: stats.total, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Active', value: stats.active, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Premium', value: stats.premium, icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Free', value: stats.free, icon: Mail, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-purple-400" />
            Newsletter Studio
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage subscribers, send newsletters, handle premium subscriptions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-white/20 bg-transparent text-gray-400"
          onClick={fetchAll}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        {/* Send Now */}
        <Button
          className="bg-gradient-to-r from-green-600 to-emerald-600 border-0 text-white"
          onClick={handleSendNow}
          disabled={sending}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {sending ? 'Sending…' : 'Send Now'}
        </Button>

        {/* Add Subscriber */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-white/20 bg-transparent text-gray-300">
              <Plus className="w-4 h-4 mr-2" />
              Add Subscriber
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0d0d1a] border border-white/10 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white">Add Subscriber</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Email *</label>
                <Input
                  placeholder="subscriber@example.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">First Name</label>
                <Input
                  placeholder="Optional"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Tier</label>
                <Select value={newTier} onValueChange={(v) => setNewTier(v as 'subscribed' | 'premium')}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d0d1a] border-white/10 text-white">
                    <SelectItem value="subscribed">Free (Subscribed)</SelectItem>
                    <SelectItem value="premium">Premium ($5/mo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 border-0"
                onClick={handleAddSubscriber}
                disabled={!newEmail || addLoading}
              >
                {addLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Subscriber
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import CSV */}
        <Button
          variant="outline"
          className="border-white/20 bg-transparent text-gray-300"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />

        {/* Export CSV */}
        <Button
          variant="outline"
          className="border-white/20 bg-transparent text-gray-300"
          onClick={handleExport}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>

        {/* Create Payment Link */}
        <Button
          variant="outline"
          className="border-yellow-500/30 bg-transparent text-yellow-400"
          onClick={handleCreatePaymentLink}
          disabled={creatingLink}
        >
          {creatingLink ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
          {creatingLink ? 'Creating…' : 'Create $5/mo Link'}
        </Button>
      </div>

      {/* Payment URL output */}
      {paymentUrl && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 flex items-start gap-4"
        >
          <Crown className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-yellow-300 font-medium mb-1">$5/month Premium Link</p>
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-yellow-400/80 underline break-all"
            >
              {paymentUrl}
            </a>
          </div>
        </motion.div>
      )}

      {/* Subscriber List */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            Subscribers ({subscribers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : subscribers.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">No subscribers yet. Import a CSV or add one above.</p>
          ) : (
            <div className="space-y-2">
              {subscribers.map(sub => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-4 p-4 rounded-lg border border-white/5 bg-white/[0.02]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">
                        {sub.first_name ? `${sub.first_name} — ` : ''}{sub.email}
                      </span>
                      {sub.subscription_tier === 'premium' ? (
                        <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                          <Crown className="w-2.5 h-2.5 mr-1" />PREMIUM
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-white/5 text-gray-400 border-white/10">
                          FREE
                        </Badge>
                      )}
                      {sub.subscribed === false && (
                        <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
                          UNSUB
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {/* Toggle tier */}
                    {sub.subscription_tier !== 'premium' ? (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-yellow-600/70 to-orange-600/70 border-0 text-white text-xs h-7"
                        onClick={() => handleToggleTier(sub)}
                        disabled={updatingId === sub.id}
                      >
                        {updatingId === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '→ Premium'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 bg-transparent text-gray-400 text-xs h-7"
                        onClick={() => handleToggleTier(sub)}
                        disabled={updatingId === sub.id}
                      >
                        {updatingId === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '→ Free'}
                      </Button>
                    )}
                    {/* Delete */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/20 bg-transparent text-red-400 text-xs h-7 w-7 p-0"
                      onClick={() => handleDelete(sub)}
                      disabled={updatingId === sub.id}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
