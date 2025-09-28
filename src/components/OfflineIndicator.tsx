import { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertTriangle } from 'lucide-react';

export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Show offline message if already offline
    if (!navigator.onLine) {
      setShowOfflineMessage(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show anything if online
  if (isOnline && !showOfflineMessage) {
    return null;
  }

  return (
    <>
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white px-4 py-2 text-center text-sm font-medium">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" />
            You're offline - Some features may be limited
          </div>
        </div>
      )}

      {/* Connection Restored Toast */}
      {isOnline && showOfflineMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            <span className="text-sm font-medium">Connection restored</span>
          </div>
          {/* Auto-hide after 3 seconds */}
          <div 
            className="absolute inset-0" 
            onAnimationEnd={() => setShowOfflineMessage(false)}
            style={{ animation: 'fadeOut 1s ease-in-out 2s forwards' }}
          />
        </div>
      )}

      {/* Offline Page Content */}
      {!isOnline && window.location.pathname !== '/offline' && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-heading-primary mb-2">You're Offline</h2>
              <p className="text-body-secondary mb-4">
                TelAgri Bank Dashboard requires an internet connection for security and real-time data access.
              </p>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <WifiOff className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Limited Functionality</span>
              </div>
              <ul className="text-xs text-amber-700 text-left space-y-1">
                <li>• Financial data cannot be updated</li>
                <li>• F-100 reports cannot be uploaded</li>
                <li>• User authentication is disabled</li>
                <li>• Real-time sync is paused</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Please check your internet connection and try again.
            </p>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        .animate-in {
          animation-fill-mode: both;
        }
        
        .slide-in-from-right {
          animation: slideInFromRight 0.3s ease-out;
        }
        
        @keyframes slideInFromRight {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}; 