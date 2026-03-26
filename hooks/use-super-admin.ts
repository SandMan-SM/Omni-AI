import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
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
      const supabase = await getSupabase();

      // Fetch client_registry
      const { data: clientsData, error: clientsError } = await supabase
        .from('client_registry')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        setError('Failed to load clients');
        setClients([]);
        return;
      }

      const clientsList = (clientsData || []) as Client[];
      setClients(clientsList);

      // If no clients yet, select the first one
      if (clientsList.length > 0 && !selectedClient) {
        setSelectedClient(clientsList[0]);
      }

      // Fetch newsletter stats for aggregate data
      const { data: newslettersData, error: newslettersError } = await supabase
        .from('newsletters')
        .select('client_id, revenue, leads, subscribers_count')
        .order('sent_at', { ascending: false });

      if (!newslettersError && newslettersData) {
        const stats: AggregateStats = {
          total_revenue: 0,
          total_leads: 0,
          total_subscribers: 0,
          by_client: {},
        };

        (newslettersData as any[]).forEach((row) => {
          const clientId = row.client_id || 'unknown';
          if (!stats.by_client[clientId]) {
            stats.by_client[clientId] = {
              revenue: 0,
              leads: 0,
              subscribers: 0,
              newsletters_sent: 0,
            };
          }
          stats.by_client[clientId].revenue += row.revenue || 0;
          stats.by_client[clientId].leads += row.leads || 0;
          stats.by_client[clientId].subscribers += row.subscribers_count || 0;
          stats.by_client[clientId].newsletters_sent += 1;
          stats.total_revenue += row.revenue || 0;
          stats.total_leads += row.leads || 0;
          stats.total_subscribers += row.subscribers_count || 0;
        });

        setAggregateStats(stats);
      }
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
