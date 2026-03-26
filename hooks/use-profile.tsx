import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

export interface Profile {
  id: string;
  email: string;
  role: string;
  is_admin: boolean;
  is_sponsor: boolean;
  sponsor_tier: 'standard' | 'vip' | null;
  tier: number;
  name: string | null;
  phone: string | null;
  business_owner: boolean;
  business_name: string | null;
  business_niche: string | null;
  business_details: string | null;
  activated_platforms: string[];
  onboarding_completed: boolean;
  sponsor_activated: boolean;
  sponsor_insights_paid: boolean;
  created_at: string;
}

interface ProfileContextType {
  profile: Profile | null;
  profileLoading: boolean;
  isAdmin: boolean;
  isSponsor: boolean;
  isVIPSponsor: boolean;
  tier: number;
  onboardingComplete: boolean;
  fetchProfile: () => Promise<void>;
  upsertProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
  fetchAllUsers: () => Promise<{ users: Profile[]; error: Error | null }>;
  updateUserRole: (userId: string, role: string, sponsorTier?: 'standard' | 'vip') => Promise<{ error: Error | null }>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

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

      if (error && (error.code === '42P01' || error.code === 'PGRST205' || (error.message?.includes('relation') && error.message?.includes('does not exist')) || error.message?.includes('Could not find the table'))) {
        console.warn('Profiles table does not exist yet. It will be auto-created on first profile access.');
        setProfileLoading(false);
        return;
      }

      if (error && error.code === 'PGRST116') {
        const isFray = user.email === 'fray1959@gmail.com' || user.username?.toLowerCase() === 'fray';
        const newProfile = {
          id: user.id,
          email: user.email || '',
          role: (user.email === 'sitanim6@gmail.com' || isFray) ? 'sponsor' : 'user',
          is_admin: user.email === 'sitanim6@gmail.com' ? true : false,
          is_sponsor: (user.email === 'sitanim6@gmail.com' || isFray) ? true : false,
          sponsor_tier: (user.email === 'sitanim6@gmail.com' || isFray) ? 'vip' : null,
          tier: (user.email === 'sitanim6@gmail.com' || isFray) ? 3 : 0,
          name: null,
          phone: null,
          business_owner: false,
          business_name: null,
          business_niche: null,
          business_details: null,
          activated_platforms: [],
          onboarding_completed: false,
          sponsor_activated: (user.email === 'sitanim6@gmail.com' || isFray) ? true : false,
          sponsor_insights_paid: (user.email === 'sitanim6@gmail.com' || isFray) ? true : false,
        };

        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          console.error('Failed to create profile:', createError);
        } else {
          setProfile(created);
        }
      } else if (error) {
        console.error('Failed to fetch profile:', error);
      } else {
        // For Fray, ensure sponsor fields and email are correct
        const isFray = user.email === 'fray1959@gmail.com' || user.username?.toLowerCase() === 'fray';
        if (isFray && (data.email !== 'fray1959@gmail.com' || data.sponsor_tier !== 'vip')) {
          const supabase = await getSupabase();
          await supabase
            .from('profiles')
            .update({
              email: 'fray1959@gmail.com',
              is_sponsor: true,
              role: 'sponsor',
              sponsor_tier: 'vip',
              tier: 3,
              sponsor_activated: true,
              sponsor_insights_paid: true
            })
            .eq('id', user.id);
          // Refetch profile after update
          const { data: updated } = await supabase.from('profiles').select().eq('id', user.id).single();
          if (updated) {
            setProfile(updated);
          }
        } else {
          setProfile({
            ...data,
            is_sponsor: data.is_sponsor ?? false,
            tier: data.tier ?? 0,
          });
        }
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading, fetchProfile]);

  const upsertProfile = async (data: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const supabase = await getSupabase();
      const upsertData = {
        id: user.id,
        email: user.email || '',
        ...data,
      };

      const { data: result, error } = await supabase
        .from('profiles')
        .upsert(upsertData, { onConflict: 'id' })
        .select()
        .single();

      if (!error && result) {
        setProfile(result);
      } else if (!error) {
        setProfile(prev => prev ? { ...prev, ...data } : null);
      }

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

      return { users: (data || []) as Profile[], error: error as Error | null };
    } catch (err) {
      return { users: [], error: err as Error };
    }
  };

  const updateUserRole = async (userId: string, role: string, sponsorTier?: 'standard' | 'vip') => {
    try {
      const supabase = await getSupabase();
      const updates: Record<string, unknown> = { role };
      
      // Also update is_admin and is_sponsor based on role
      if (role === 'admin') {
        updates.is_admin = true;
        updates.is_sponsor = true;
        updates.sponsor_tier = null;
      } else if (role === 'sponsor') {
        updates.is_admin = false;
        updates.is_sponsor = true;
        updates.sponsor_tier = sponsorTier || 'standard';
      } else {
        updates.is_admin = false;
        updates.is_sponsor = false;
        updates.sponsor_tier = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true || user?.is_admin === true;
  const isSponsor = profile?.role === 'sponsor' || profile?.is_sponsor === true || user?.is_sponsor === true;
  const isVIPSponsor = profile?.sponsor_tier === 'vip' || String(profile?.sponsor_tier) === 'VIP Sponsor' || user?.sponsor_tier === 'VIP Sponsor';
  const tier = Number(profile?.tier ?? user?.tier ?? 0);
  const onboardingComplete = profile?.onboarding_completed ?? false;

  return (
    <ProfileContext.Provider value={{
      profile,
      profileLoading,
      isAdmin,
      isSponsor,
      isVIPSponsor,
      tier,
      onboardingComplete,
      fetchProfile,
      upsertProfile,
      fetchAllUsers,
      updateUserRole,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
