import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

export interface Profile {
  id: string;
  email: string;
  role: string;
  is_admin: boolean;
  is_sponsor: boolean;
  tier: number;
  name: string | null;
  phone: string | null;
  business_owner: boolean;
  business_name: string | null;
  business_niche: string | null;
  business_details: string | null;
  activated_platforms: string[];
  onboarding_completed: boolean;
  created_at: string;
}

interface ProfileContextType {
  profile: Profile | null;
  profileLoading: boolean;
  isAdmin: boolean;
  isSponsor: boolean;
  tier: number;
  onboardingComplete: boolean;
  fetchProfile: () => Promise<void>;
  upsertProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
  fetchAllUsers: () => Promise<{ users: Profile[]; error: Error | null }>;
  updateUserRole: (userId: string, role: string) => Promise<{ error: Error | null }>;
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
        const newProfile = {
          id: user.id,
          email: user.email || '',
          role: user.email === 'sitanim6@gmail.com' ? 'sponsor' : 'user',
          is_admin: user.email === 'sitanim6@gmail.com' ? true : false,
          is_sponsor: user.email === 'sitanim6@gmail.com' ? true : false,
          tier: user.email === 'sitanim6@gmail.com' ? 3 : 0,
          name: null,
          phone: null,
          business_owner: false,
          business_name: null,
          business_niche: null,
          business_details: null,
          activated_platforms: [],
          onboarding_completed: false,
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
        setProfile({
          ...data,
          is_sponsor: data.is_sponsor ?? false,
          tier: data.tier ?? 0,
        });
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

  const updateUserRole = async (userId: string, role: string) => {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);

      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const isSponsor = profile?.role === 'sponsor' || profile?.is_sponsor === true;
  const tier = profile?.tier ?? 0;
  const onboardingComplete = profile?.onboarding_completed ?? false;

  return (
    <ProfileContext.Provider value={{
      profile,
      profileLoading,
      isAdmin,
      isSponsor,
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
