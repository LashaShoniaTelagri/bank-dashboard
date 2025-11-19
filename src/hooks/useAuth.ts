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
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Check for active impersonation on mount and storage changes
  useEffect(() => {
    const checkImpersonation = () => {
      try {
        const stored = localStorage.getItem('impersonation_session');
        if (stored) {
          const session = JSON.parse(stored);
          setImpersonatedUserId(session.targetUserId);
        } else {
          setImpersonatedUserId(null);
        }
      } catch (err) {
        console.error('Failed to check impersonation:', err);
        setImpersonatedUserId(null);
      }
    };

    checkImpersonation();

    // Listen for storage changes (e.g., when impersonation starts/ends)
    window.addEventListener('storage', checkImpersonation);
    return () => window.removeEventListener('storage', checkImpersonation);
  }, []);

  // Use React Query for profile data with proper caching
  // When impersonating, fetch the impersonated user's profile instead
  const effectiveUserId = impersonatedUserId || user?.id;
  
  const { data: profile } = useQuery({
    queryKey: ['user-profile', effectiveUserId, impersonatedUserId ? 'impersonated' : 'real'],
    queryFn: async () => {
      if (!effectiveUserId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      
      if (error) {
        console.error('Profile fetch error:', error);
        return null;
      }
      
      return data as UserProfile;
    },
    enabled: !!effectiveUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes - profile data doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes cache (renamed from cacheTime in React Query v5)
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
    try {
      // Clear profile cache on sign out
      queryClient.removeQueries({ queryKey: ['user-profile'] });
      
      // Clear local state immediately
      setUser(null);
      setSession(null);
      setLoading(false);
      setImpersonatedUserId(null);
      
      // Attempt to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      // If there's an error but it's because session is already gone, that's fine
      if (error && !error.message.includes('session') && !error.message.includes('Auth')) {
        console.error('Sign out error:', error);
        return { error };
      }
      
      // Clear all local storage including impersonation
      const tourCompleted = localStorage.getItem('telagri-specialist-tour-completed');
      localStorage.clear();
      if (tourCompleted) {
        localStorage.setItem('telagri-specialist-tour-completed', tourCompleted);
      }
      
      return { error: null };
    } catch (err: any) {
      console.error('Unexpected sign out error:', err);
      // Even if there's an error, clear local state
      setUser(null);
      setSession(null);
      setImpersonatedUserId(null);
      localStorage.clear();
      return { error: null }; // Return success anyway since local state is cleared
    }
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