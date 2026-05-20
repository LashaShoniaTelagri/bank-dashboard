import { useEffect } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useLocation } from 'react-router-dom';

/**
 * Analytics component - automatically tracks page views and user sessions
 * Only tracks specialists and bank viewers in production
 */
export const Analytics = () => {
  const { trackEvent } = useAnalytics();
  const location = useLocation();

  // Track page views on route change
  useEffect(() => {
    const isProduction = import.meta.env.PROD && window.location.hostname !== 'localhost';
    
    if (!isProduction) return;

    // Track page view in GTM
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'page_view',
        page_path: location.pathname,
        page_location: window.location.href,
        page_title: document.title
      });
    }

    // Track in custom analytics
    trackEvent('page_view', {
      page_path: location.pathname,
      page_location: window.location.href
    });
  }, [location.pathname, trackEvent]);

  // Component doesn't render anything
  return null;
};


