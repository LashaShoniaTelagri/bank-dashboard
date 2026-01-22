import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register service worker for PWA with auto-update handling
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration.scope);
        
        // Check for updates every 60 seconds
        setInterval(() => {
          registration.update().catch((error) => {
            console.error('Service Worker update check failed:', error);
          });
        }, 60000);
        
        // Handle waiting service worker (update available)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker installed and waiting
                console.log('🔄 New version available! Activating...');
                // Skip waiting and take control immediately
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                // Reload page to get new content
                window.location.reload();
              }
            });
          }
        });
        
        // Listen for service worker controlling page
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            console.log('🔄 Service Worker updated, reloading page...');
            window.location.reload();
          }
        });
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
