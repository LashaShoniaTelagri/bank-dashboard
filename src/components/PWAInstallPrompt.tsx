import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone, Share, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    console.log('🔍 PWA Install Prompt initialized');
    
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInStandaloneMode = (navigator as unknown as { standalone?: boolean }).standalone || isStandalone;
    
    console.log('📱 PWA Status:', {
      isStandalone,
      isInStandaloneMode,
      userAgent: navigator.userAgent
    });
    
    if (isInStandaloneMode) {
      console.log('✅ App already installed (standalone mode)');
      setIsInstalled(true);
      return;
    }

    // Check if user has already dismissed permanently
    const permanentlyDismissed = localStorage.getItem('pwa-permanently-dismissed') === 'true';
    if (permanentlyDismissed) {
      console.log('🚫 PWA prompt permanently dismissed by user');
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🎯 beforeinstallprompt event fired!');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show install prompt after a delay (shorter for better UX)
      setTimeout(() => {
        console.log('📢 Showing PWA install prompt');
        setShowPrompt(true);
      }, 2000);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      console.log('✅ App installed successfully');
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    // For iOS Safari, show manual install instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    console.log('🍎 iOS detected:', isIOS);
    
    if (isIOS && !isInStandaloneMode) {
      console.log('📱 Showing iOS install instructions in 3 seconds');
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    console.log('👂 Event listeners registered for PWA');

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
              // User accepted the install prompt
    } else {
              // User dismissed the install prompt
    }
    
    // Clear the deferredPrompt variable
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = (permanent = false) => {
    setShowPrompt(false);
    if (permanent) {
      localStorage.setItem('pwa-permanently-dismissed', 'true');
    } else {
      sessionStorage.setItem('pwa-prompt-dismissed', 'true');
    }
  };

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  // Don't show if no prompt available (except for iOS)
  if (!showPrompt) {
    return null;
  }

  // Check if already dismissed in this session
  if (sessionStorage.getItem('pwa-prompt-dismissed') === 'true') {
    return null;
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:max-w-sm md:bottom-4 md:right-4">
      <div className="bg-card/95 dark:bg-dark-card/95 backdrop-blur-md border border-emerald-200 dark:border-emerald-700/50 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <Smartphone className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-heading-primary text-sm mb-1">
              Install TelAgri App
            </h3>
            
            {isIOS && !deferredPrompt ? (
              <div className="text-xs text-body-secondary mb-3">
                <p className="mb-2">Install this app on your iPhone:</p>
                <div className="flex items-center gap-1 mb-1">
                  <span>1. Tap</span>
                  <Share className="h-3 w-3 mx-1 text-blue-500 dark:text-blue-400" />
                  <span>Share button</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>2. Select</span>
                  <Plus className="h-3 w-3 mx-1 text-blue-500 dark:text-blue-400" />
                  <span>"Add to Home Screen"</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-body-secondary mb-3">
                Get quick access to your agricultural finance dashboard. Install for a better mobile experience.
              </p>
            )}
            
            <div className="flex gap-2">
              {deferredPrompt && (
                <Button
                  onClick={handleInstallClick}
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 dark:from-emerald-600 dark:to-teal-600 dark:hover:from-emerald-700 dark:hover:to-teal-700 text-white text-xs h-8"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Install
                </Button>
              )}
              <Button
                onClick={() => handleDismiss(false)}
                variant="ghost"
                size="sm"
                className="text-body-muted hover:text-heading-primary h-8 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleDismiss(true)}
                variant="ghost"
                size="sm"
                className="text-body-muted hover:text-heading-secondary h-8 px-1 text-xs"
              >
                Don't ask
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 