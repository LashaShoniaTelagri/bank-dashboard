import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from 'vite-plugin-pwa';
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 3000,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: false, // Disable service worker in development to avoid Vite dev server conflicts
        type: 'module'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB - increased from default 2 MB to accommodate large bundles
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.telagri\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'telagri-assets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes for API calls
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      includeAssets: [
        'favicon.ico', 
        'apple-touch-icon.png', 
        'masked-icon.svg',
        'pwa-icons/**/*.png'
      ],
      manifest: {
        name: 'TelAgri Bank Dashboard',
        short_name: 'TelAgri',
        description: 'Agricultural Finance Management Platform - Secure banking dashboard for farmer loans and F-100 reports',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['business', 'finance', 'productivity'],
        lang: 'en',
        dir: 'ltr',
        prefer_related_applications: false,
        icons: [
          // High-Resolution Android Icons (Primary for mobile)
          {
            src: 'pwa-icons/ios/1024.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/ios/512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/android/android-launchericon-512-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-icons/ios/256.png',
            sizes: '256x256',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/android/android-launchericon-192-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/android/android-launchericon-192-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-icons/android/android-launchericon-144-144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/android/android-launchericon-96-96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/android/android-launchericon-72-72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/android/android-launchericon-48-48.png',
            sizes: '48x48',
            type: 'image/png',
            purpose: 'any'
          },
          
          // iOS Icons (High Quality)
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/ios/180.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/ios/192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/ios/152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/ios/144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/ios/128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/ios/120.png',
            sizes: '120x120',
            type: 'image/png',
            purpose: 'any'
          },
          
          // Windows Icons (Desktop)
          {
            src: 'pwa-icons/windows11/LargeTile.scale-400.png',
            sizes: '1240x1240',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/windows11/LargeTile.scale-200.png',
            sizes: '620x620',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/windows11/Square150x150Logo.scale-400.png',
            sizes: '600x600',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/windows11/Square150x150Logo.scale-200.png',
            sizes: '300x300',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/windows11/Square44x44Logo.targetsize-256.png',
            sizes: '256x256',
            type: 'image/png',
            purpose: 'any'
          },
          
          // Fallback
          {
            src: 'favicon.ico',
            sizes: '48x48',
            type: 'image/x-icon',
            purpose: 'any'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
