'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2, MailPlus, RefreshCw, Search, UserMinus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type Member = {
  id: string;
  site: string;
  email: string;
  first_name: string | null;
  source: string | null;
  unsubscribed: boolean;
  created_at: string | null;
};

const PUBLICATIONS = [
  ['utah-main-street', 'Utah Main Street'],
  ['beehive-biz-pulse', 'Beehive Biz Pulse'],
  ['wasatch-post', 'The Wasatch Post'],
] as const;

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('omni_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function PublicationListsManager() {
  const { toast } = useToast();
  const [site, setSite] = useState('utah-main-street');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/newsletter/publication-subscribers?site=${encodeURIComponent(site)}`,
        { cache: 'no-store', headers: authHeaders() },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load list');
      setMembers(data.members || []);
    } catch (error) {
      toast({
        title: 'Publication list unavailable',
        description: error instanceof Error ? error.message : 'Unable to load list',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [site, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (member) =>
        member.email.toLowerCase().includes(query) ||
        (member.first_name || '').toLowerCase().includes(query),
    );
  }, [members, search]);

  const activeCount = members.filter((member) => !member.unsubscribed).length;

  async function add() {
    if (!email.trim()) return;
    setBusy('add');
    try {
      const response = await fetch('/api/admin/newsletter/publication-subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ site, email, first_name: name || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to add subscriber');
      setEmail('');
      setName('');
      toast({ title: 'Subscriber added', description: data.member.email });
      await load();
    } catch (error) {
      toast({
        title: 'Add failed',
        description: error instanceof Error ? error.message : 'Unable to add subscriber',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  async function setActive(member: Member, active: boolean) {
    setBusy(member.email);
    try {
      const response = await fetch(
        `/api/admin/newsletter/publication-subscribers/${encodeURIComponent(site)}/${encodeURIComponent(member.email)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ active }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to update subscriber');
      await load();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unable to update subscriber',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Publication Lists
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Each newsroom sends only to its own active subscribers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={site}
              onChange={(event) => setSite(event.target.value)}
              className="h-9 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white"
              aria-label="Publication"
            >
              {PUBLICATIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Button variant="outline" size="icon" className="h-9 w-9 border-white/10" onClick={load}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          <div className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="text-xl font-bold text-green-400">{activeCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Active send set</div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="text-xl font-bold text-gray-300">{members.length - activeCount}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Unsubscribed</div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="subscriber@example.com" type="email" className="bg-white/5 border-white/10 text-white" />
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="First name (optional)" className="bg-white/5 border-white/10 text-white" />
          <Button onClick={add} disabled={!email.trim() || busy === 'add'} className="gap-2 bg-amber-500 text-black hover:bg-amber-400">
            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailPlus className="w-4 h-4" />}
            Add
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this list" className="pl-9 bg-white/5 border-white/10 text-white" />
        </div>

        <div className="divide-y divide-white/5 rounded-md border border-white/10">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">Loading subscribers…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No subscribers in this list.</div>
          ) : (
            filtered.map((member) => (
              <div key={member.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{member.email}</div>
                  <div className="text-xs text-gray-500">{member.first_name || 'No name'} · {member.source || 'website'}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === member.email}
                  onClick={() => setActive(member, member.unsubscribed)}
                  className={member.unsubscribed ? 'border-green-500/30 text-green-400' : 'border-white/10 text-gray-300'}
                >
                  {busy === member.email ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : member.unsubscribed ? (
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                  ) : (
                    <UserMinus className="w-4 h-4 mr-1.5" />
                  )}
                  {member.unsubscribed ? 'Reactivate' : 'Unsubscribe'}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
