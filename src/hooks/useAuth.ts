import { useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  user_id: string;
  role: 'admin' | 'bank_viewer' | 'specialist';
  bank_id?: string;
  created_at: string;
  invited_by?: string;
  invited_at?: string;
  invitation_accepted_at?: string;
  invitation_status?: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Use React Query for profile data with proper caching
  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }
      
      return data as UserProfile;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - profile data doesn't change often
    cacheTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    retry: 1, // Only retry once on failure
  });

  // Memoized auth state handler to prevent unnecessary re-renders
  const handleAuthStateChange = useCallback((event: any, session: Session | null) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
    
    // Invalidate profile query when user changes
    if (event === 'SIGNED_OUT') {
      queryClient.removeQueries({ queryKey: ['user-profile'] });
    }
  }, [queryClient]);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    // Check for existing session immediately
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [handleAuthStateChange]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    // Clear profile cache on sign out
    queryClient.removeQueries({ queryKey: ['user-profile'] });
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    profile: profile || null,
    loading: loading || (!!user?.id && profile === undefined), // Loading if we have user but no profile yet
    signIn,
    signOut,
  };
};