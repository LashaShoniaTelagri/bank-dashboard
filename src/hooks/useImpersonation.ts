import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ImpersonationSession {
  sessionId: string;
  targetUserId: string;
  targetEmail: string;
  targetRole: string;
  targetProfile: any;
  adminUserId: string;
  adminEmail: string;
  startedAt: string;
  reason: string;
}

interface UseImpersonationReturn {
  isImpersonating: boolean;
  impersonationSession: ImpersonationSession | null;
  startImpersonation: (targetUserId: string, reason?: string) => Promise<void>;
  endImpersonation: () => Promise<void>;
  logAction: (actionType: string, details?: any) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useImpersonation(): UseImpersonationReturn {
  const { profile } = useAuth();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonationSession, setImpersonationSession] = useState<ImpersonationSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is an admin
  const isAdmin = profile && ['admin', 'system_admin', 'Administrator', 'System Administrator'].includes(profile.role);

  // Load active impersonation on mount
  useEffect(() => {
    const loadActiveImpersonation = async () => {
      try {
        const stored = localStorage.getItem('impersonation_session');
        console.log('🔍 Checking impersonation session:', stored ? 'Found' : 'Not found');
        if (stored) {
          const session = JSON.parse(stored);
          console.log('✅ Impersonation active:', session.targetEmail);
          setImpersonationSession(session);
          setIsImpersonating(true);
        } else {
          console.log('ℹ️ No active impersonation');
          setIsImpersonating(false);
          setImpersonationSession(null);
        }
      } catch (err) {
        console.error('❌ Failed to load impersonation session:', err);
      }
    };

    loadActiveImpersonation();
  }, []);

  // Start impersonation
  const startImpersonation = useCallback(async (targetUserId: string, reason?: string) => {
    if (!isAdmin) {
      setError('Only administrators can impersonate users');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: funcError } = await supabase.functions.invoke('impersonate-user', {
        body: {
          action: 'start',
          targetUserId,
          reason: reason || 'Admin support'
        }
      });

      if (funcError) throw funcError;
      if (!data.success) throw new Error('Failed to start impersonation');

      const session = data.impersonation;
      setImpersonationSession(session);
      setIsImpersonating(true);

      // Store session in localStorage for persistence
      localStorage.setItem('impersonation_session', JSON.stringify(session));

      // Log action
      await logAction('IMPERSONATION_STARTED', {
        targetUserId,
        targetEmail: session.targetEmail,
        reason: reason || 'Admin support'
      });

      // Reload the page to update all components with new user context
      // This ensures RLS policies and permissions are applied correctly
      window.location.reload();
    } catch (err: any) {
      console.error('Impersonation start error:', err);
      setError(err.message || 'Failed to start impersonation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // End impersonation
  const endImpersonation = useCallback(async () => {
    if (!impersonationSession) return;

    setIsLoading(true);
    setError(null);

    try {
      // Log action before ending
      await logAction('IMPERSONATION_ENDED', {
        duration: new Date().getTime() - new Date(impersonationSession.startedAt).getTime()
      });

      const { data, error: funcError } = await supabase.functions.invoke('impersonate-user', {
        body: {
          action: 'end',
          sessionId: impersonationSession.sessionId
        }
      });

      if (funcError) throw funcError;

      // Clear state
      setImpersonationSession(null);
      setIsImpersonating(false);
      localStorage.removeItem('impersonation_session');

      // Reload to restore admin session
      window.location.reload();
    } catch (err: any) {
      console.error('Impersonation end error:', err);
      setError(err.message || 'Failed to end impersonation');
    } finally {
      setIsLoading(false);
    }
  }, [impersonationSession]);

  // Log action during impersonation
  const logAction = useCallback(async (actionType: string, details?: any) => {
    if (!impersonationSession) return;

    try {
      await supabase.functions.invoke('impersonate-user', {
        body: {
          action: 'logAction',
          sessionId: impersonationSession.sessionId,
          actionType,
          actionDescription: JSON.stringify(details),
          pageUrl: window.location.href,
          requestData: details
        }
      });
    } catch (err) {
      console.error('Failed to log impersonation action:', err);
      // Don't throw - logging failures shouldn't break the app
    }
  }, [impersonationSession]);

  // Log page views automatically
  useEffect(() => {
    if (!isImpersonating) return;

    logAction('PAGE_VIEW', {
      path: window.location.pathname,
      search: window.location.search
    });
  }, [isImpersonating, logAction, window.location.pathname]);

  return {
    isImpersonating,
    impersonationSession,
    startImpersonation,
    endImpersonation,
    logAction,
    isLoading,
    error
  };
}

