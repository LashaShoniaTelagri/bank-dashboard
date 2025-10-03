import { useEffect } from 'react';
import { useAuth } from './useAuth';

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    smartlook?: {
      (command: string, ...args: unknown[]): void;
      api: unknown[];
    };
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Analytics hook for Google Tag Manager and Smartlook integration
 * Only tracks specialists and bank viewers in production environment
 */
export const useAnalytics = () => {
  const { user, profile } = useAuth();

  useEffect(() => {
    // Only run in production
    const isProduction = import.meta.env.PROD && window.location.hostname !== 'localhost';
    
    if (!isProduction) {
      console.log('📊 Analytics disabled in development environment');
      return;
    }

    // Get analytics keys from environment
    const smartlookKey = import.meta.env.VITE_APP_SMARTLOOK_KEY;
    const tagManagerKey = import.meta.env.VITE_APP_TAG_MANAGER_KEY;

    if (!smartlookKey || !tagManagerKey) {
      console.warn('⚠️ Analytics keys not configured in environment variables');
      return;
    }

    // Only track specialists and bank viewers (exclude admins)
    const shouldTrack = profile?.role === 'specialist' || profile?.role === 'bank_viewer';
    
    if (!shouldTrack) {
      console.log('📊 Analytics disabled for admin users');
      return;
    }

    // Load and initialize Smartlook
    if (!window.smartlook) {
      try {
        // Load Smartlook SDK
        (function(d) {
          const smartlookFunc = function(...args: unknown[]) {
            smartlookFunc.api.push(args);
          };
          smartlookFunc.api = [] as unknown[];
          window.smartlook = smartlookFunc as typeof window.smartlook;
          
          const h = d.getElementsByTagName('head')[0];
          const c = d.createElement('script');
          c.async = true;
          c.type = 'text/javascript';
          c.charset = 'utf-8';
          c.src = 'https://web-sdk.smartlook.com/recorder.js';
          h.appendChild(c);
        })(document);

        // Initialize Smartlook
        if (window.smartlook) {
          window.smartlook('init', smartlookKey, { region: 'eu' });

          // Configure recording settings - track user behavior but mask passwords
          window.smartlook('record', {
            forms: true,
            numbers: true,
            emails: true,
            ips: true,
            // Ensure passwords are always masked for security
            mask: {
              selectors: ['input[type="password"]', '[data-password]']
            }
          });
        }

        console.log('✅ Smartlook SDK loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load Smartlook:', error);
      }
    }

    // Identify user in Smartlook
    if (user && profile && window.smartlook) {
      try {
        window.smartlook('identify', user.id, {
          name: user.email || 'Unknown',
          email: user.email,
          role: profile.role,
          bank_id: profile.bank_id || 'N/A',
          user_type: profile.role === 'specialist' ? 'Specialist' : 'Bank Viewer',
          created_at: profile.created_at,
          invitation_status: profile.invitation_status || 'N/A'
        });

        console.log('✅ Smartlook user identified:', {
          userId: user.id.slice(0, 8),
          role: profile.role,
          email: user.email?.replace(/(.{2}).*@/, '$1***@')
        });
      } catch (error) {
        console.error('❌ Failed to identify user in Smartlook:', error);
      }
    }

    // Load and initialize Google Tag Manager (GA4)
    if (!window.dataLayer) {
      try {
        // Initialize dataLayer
        window.dataLayer = window.dataLayer || [];
        window.gtag = function(...args: unknown[]) {
          window.dataLayer.push(args as Record<string, unknown>);
        };
        
        // Load GA4 script
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${tagManagerKey}`;
        document.head.appendChild(script);

        // Configure GA4
        script.onload = () => {
          if (window.gtag) {
            window.gtag('js', new Date());
            window.gtag('config', tagManagerKey, {
              user_properties: {
                role: profile?.role,
                user_type: profile?.role === 'specialist' ? 'Specialist' : 'Bank Viewer',
                bank_id: profile?.bank_id || 'N/A'
              }
            });
            console.log('✅ Google Tag Manager initialized successfully');
          }
        };
      } catch (error) {
        console.error('❌ Failed to load Google Tag Manager:', error);
      }
    }

    // Push user identification event to dataLayer
    if (window.dataLayer && profile) {
      window.dataLayer.push({
        event: 'user_identified',
        user_role: profile.role,
        user_type: profile.role === 'specialist' ? 'Specialist' : 'Bank Viewer',
        bank_id: profile.bank_id || 'N/A'
      });
    }
  }, [user, profile]);

  // Analytics event tracking function
  const trackEvent = (eventName: string, eventData?: Record<string, unknown>) => {
    const isProduction = import.meta.env.PROD && window.location.hostname !== 'localhost';
    const shouldTrack = profile?.role === 'specialist' || profile?.role === 'bank_viewer';

    if (!isProduction || !shouldTrack) return;

    try {
      // GTM event
      if (window.gtag) {
        window.gtag('event', eventName, eventData);
      }

      // DataLayer event
      if (window.dataLayer) {
        window.dataLayer.push({
          event: eventName,
          user_role: profile?.role,
          ...eventData
        });
      }

      // Smartlook custom event
      if (window.smartlook) {
        window.smartlook('track', eventName, eventData);
      }
    } catch (error) {
      console.error('❌ Failed to track analytics event:', error);
    }
  };

  return { trackEvent };
};


