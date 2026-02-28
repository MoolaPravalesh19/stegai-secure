import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as Profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            if (!isMounted) return;
            const userProfile = await fetchProfile(currentSession.user.id);
            if (isMounted) {
              setProfile(userProfile);
            }
          }, 0);
        } else {
          setProfile(null);
        }
        
        if (initialized) {
          setLoading(false);
        }
      }
    );

    // Then check for existing session
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          const userProfile = await fetchProfile(currentSession.user.id);
          if (isMounted) {
            setProfile(userProfile);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (isMounted) {
          setInitialized(true);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [initialized]);

  const signOut = async () => {
    // Avoid noisy 403s: only call backend signOut when a session exists.
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch (error) {
      // Even if backend signOut fails (e.g., already logged out), clear local state.
      console.log('SignOut completed with local cleanup');
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  // Update profile in database
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in' };
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    }
    
    return { data, error };
  };

  return { 
    user, 
    session, 
    profile, 
    loading, 
    signOut, 
    updateProfile,
    refetchProfile: () => user && fetchProfile(user.id).then(setProfile)
  };
};
