import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

// ── Real DB columns (as of migration 014) ──────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  role: string;
  is_admin: boolean;
  is_sponsor: boolean;
  sponsor_tier: 'standard' | 'vip' | null;
  sponsor_activated: boolean;
  sponsor_insights_paid: boolean;
  tier: number;
  tier_label: string | null;
  // Identity
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;           // display name (synced from first_name or set directly)
  phone: string | null;
  timezone: string | null;
  email_verified: boolean;
  // Business
  business_name: string | null;
  business_niche: string | null;
  business_details: string | null;
  // Status
  onboarding_completed: boolean;
  is_premium: boolean;
  is_subscribed: boolean;
  subscription_status: string | null;
  // Stripe / billing
  stripe_customer_id: string | null;
  premium_since: string | null;
  total_spent: number;
  gross_revenue: number;
  purchase_count: number;
  last_purchase_at: string | null;
  // CRM
  crm_status: 'lead' | 'prospect' | 'onboarding' | 'client' | 'churned' | null;
  lead_score: 'hot' | 'warm' | 'cold' | null;
  satisfaction_score: number | null;
  last_contacted: string | null;
  crm_notes: string | null;
  newsletter_subscribed: boolean | null;
  // Arena
  agent_name: string | null;
  agent_status: 'active' | 'idle' | 'dormant' | null;
  elo_rating: number | null;
  elo_rank: 'diamond' | 'gold' | 'silver' | 'bronze' | 'unranked' | null;
  elo_wins: number | null;
  elo_losses: number | null;
  elo_streak: number | null;
  elo_peak: number | null;
  // Meta
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ProfileContextType {
  profile: Profile | null;
  profileLoading: boolean;
  isAdmin: boolean;
  isSponsor: boolean;
  isVIPSponsor: boolean;
  tier: number;
  onboardingComplete: boolean;
  displayName: string;
  fetchProfile: () => Promise<void>;
  upsertProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
  fetchAllUsers: () => Promise<{ users: Profile[]; error: Error | null }>;
  updateUserRole: (userId: string, role: string, sponsorTier?: 'standard' | 'vip') => Promise<{ error: Error | null }>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

function normaliseProfile(data: any): Profile {
  return {
    ...data,
    name: data.name || (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : null),
    is_sponsor: data.is_sponsor ?? false,
    tier: data.tier ?? 0,
    onboarding_completed: data.onboarding_completed ?? false,
    crm_status: data.crm_status ?? 'lead',
    lead_score: data.lead_score ?? 'cold',
  };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();


      if (error && error.code === 'PGRST116') {
        // Profile not found by ID — check if one exists by username or email before creating
        let existingProfile = null;
        if (user.username) {
          const { data: byUsername } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', user.username)
            .single();
          existingProfile = byUsername;
        }
        if (!existingProfile && user.email) {
          const { data: byEmail } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', user.email)
            .single();
          existingProfile = byEmail;
        }

        if (existingProfile) {
          setProfile(normaliseProfile(existingProfile));
        } else {
          // Create minimal profile only if none exists
          const isFray = user.email === 'fray1959@gmail.com' || user.username?.toLowerCase() === 'fray';
          const isMafi = user.email === 'sitanim8@gmail.com' || user.username === '$Mafi';

          const newProfile: Partial<Profile> = {
            id: user.id,
            email: user.email || '',
            username: user.username || null,
            role: isMafi ? 'admin' : isFray ? 'sponsor' : 'user',
            is_admin: isMafi,
            is_sponsor: isFray || isMafi,
            sponsor_tier: isFray ? 'vip' : null,
            tier: isMafi ? 99 : isFray ? 3 : 0,
            crm_status: (isFray || isMafi) ? 'client' : 'lead',
            lead_score: (isFray || isMafi) ? 'hot' : 'cold',
            sponsor_activated: isFray,
            sponsor_insights_paid: isFray,
          };

          const { data: created } = await supabase.from('profiles').insert(newProfile).select().single();
          if (created) setProfile(normaliseProfile(created));
        }
      } else if (error) {
        console.error('Profile fetch error:', error);
      } else {
        setProfile(normaliseProfile(data));
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) fetchProfile();
  }, [user, authLoading, fetchProfile]);

  // ── Live sync: re-fetch when this user's profile row changes in DB ─────────
  // Covers admin edits from the admin panel flowing through to the dashboard.
  useEffect(() => {
    if (!user) return;

    const supabase = getSupabase();

    // Supabase real-time: listen for UPDATE on this user's profile row
    const channel = supabase
      .channel(`profile-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new) setProfile(normaliseProfile(payload.new as any));
        }
      )
      .subscribe();

    // Tab-focus re-fetch: catches edits made while the user was on another tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchProfile();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [user, fetchProfile]);

  const upsertProfile = async (data: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    try {
      const supabase = await getSupabase();
      const { data: result, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email || '', ...data }, { onConflict: 'id' })
        .select()
        .single();
      if (!error && result) setProfile(normaliseProfile(result));
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const fetchAllUsers = async () => {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      return { users: (data || []).map(normaliseProfile) as Profile[], error: error as Error | null };
    } catch (err) {
      return { users: [], error: err as Error };
    }
  };

  const updateUserRole = async (userId: string, role: string, sponsorTier?: 'standard' | 'vip') => {
    try {
      const supabase = await getSupabase();
      const updates: Record<string, unknown> = { role };
      if (role === 'admin') { updates.is_admin = true; updates.is_sponsor = true; updates.tier = 99; }
      else if (role === 'sponsor') { updates.is_admin = false; updates.is_sponsor = true; updates.sponsor_tier = sponsorTier || 'standard'; }
      else { updates.is_admin = false; updates.is_sponsor = false; updates.sponsor_tier = null; }
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true || user?.is_admin === true;
  const isSponsor = profile?.role === 'sponsor' || profile?.is_sponsor === true || user?.is_sponsor === true;
  const isVIPSponsor = profile?.sponsor_tier === 'vip' || user?.sponsor_tier === 'VIP Sponsor';
  const tier = Number(profile?.tier ?? user?.tier ?? 0);
  const onboardingComplete = profile?.onboarding_completed ?? false;
  const displayName = profile?.name || profile?.username || profile?.first_name || user?.username || '';

  return (
    <ProfileContext.Provider value={{
      profile, profileLoading, isAdmin, isSponsor, isVIPSponsor,
      tier, onboardingComplete, displayName,
      fetchProfile, upsertProfile, fetchAllUsers, updateUserRole,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) throw new Error('useProfile must be used within a ProfileProvider');
  return context;
}
