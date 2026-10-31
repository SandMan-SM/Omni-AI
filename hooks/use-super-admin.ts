import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth';
import { useProfile } from '@/hooks/use-profile';

export interface Client {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'pending';
  website?: string;
  telegram_bot?: string;
  supabase_project?: string;
  stripe_status?: 'active' | 'inactive';
  created_at: string;
}

export interface ClientStats {
  revenue: number;
  leads: number;
  subscribers: number;
  newsletters_sent: number;
}

export interface AggregateStats {
  total_revenue: number;
  total_leads: number;
  total_subscribers: number;
  by_client: Record<string, ClientStats>;
}

export function useSuperAdmin() {
  const { profile, profileLoading } = useProfile();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [aggregateStats, setAggregateStats] = useState<AggregateStats>({
    total_revenue: 0,
    total_leads: 0,
    total_subscribers: 0,
    by_client: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === 'super_admin';

  const fetchClientsAndStats = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // The client list and the per-client KPIs come from the dashboard's
      // server endpoints, which hold the service role.
      //
      // They used to come from two direct browser reads that both failed
      // against the live schema: a `client_registry` table that does not
      // exist ("Could not find the table 'public.client_registry'"), and a
      // `newsletters` table read with `client_id / revenue / leads /
      // subscribers_count` columns that do not exist either. Both reads
      // errored, so this page showed "Failed to load clients" to every
      // super admin and the KPI tiles never held a number.
      const [businessesRes, statsRes] = await Promise.all([
        authFetch('/api/dashboard/businesses')
          .then((r) => (r.ok ? r.json() : { businesses: [] }))
          .catch(() => ({ businesses: [] })),
        authFetch('/api/dashboard/client-stats')
          .then((r) => (r.ok ? r.json() : { by_client: {} }))
          .catch(() => ({ by_client: {} })),
      ]);

      const businesses = (businessesRes?.businesses ?? []) as Array<{
        id: string;
        name?: string | null;
        website?: string | null;
        created_at?: string | null;
      }>;

      const clientsList: Client[] = businesses.map((b) => ({
        id: b.id,
        name: b.name ?? 'Unnamed workspace',
        status: 'active',
        website: b.website ?? undefined,
        created_at: b.created_at ?? new Date().toISOString(),
      }));
      setClients(clientsList);

      // If no clients yet, select the first one
      if (clientsList.length > 0 && !selectedClient) {
        setSelectedClient(clientsList[0]);
      }

      const byClient = (statsRes?.by_client ?? {}) as Record<string, ClientStats>;
      const stats: AggregateStats = {
        total_revenue: 0,
        total_leads: 0,
        total_subscribers: 0,
        by_client: byClient,
      };
      for (const key of Object.keys(byClient)) {
        const row = byClient[key];
        stats.total_revenue += row.revenue ?? 0;
        stats.total_leads += row.leads ?? 0;
        stats.total_subscribers += row.subscribers ?? 0;
      }
      setAggregateStats(stats);
    } catch (err) {
      console.error('Error in fetchClientsAndStats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, selectedClient]);

  useEffect(() => {
    if (!profileLoading) {
      fetchClientsAndStats();
    }
  }, [profileLoading, fetchClientsAndStats]);

  return {
    isSuperAdmin,
    clients,
    selectedClient,
    setSelectedClient,
    aggregateStats,
    loading,
    error,
    refetch: fetchClientsAndStats,
  };
}
