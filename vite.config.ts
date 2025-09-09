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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
        short_name: 'TelAgri Bank',
        description: 'AgriTech Banking Platform for Farmer Financial Management',
        theme_color: '#10b981',
        background_color: '#f0fdf4',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['business', 'finance', 'productivity'],
        lang: 'en',
        dir: 'ltr',
        icons: [
          // Android Icons (High Quality)
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
            src: 'pwa-icons/android/android-launchericon-512-512.png',
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
          
          // iOS Icons (High Quality)
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
            src: 'pwa-icons/ios/256.png',
            sizes: '256x256',
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
            src: 'pwa-icons/ios/1024.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'any'
          },
          
          // Windows Icons (High Quality)
          {
            src: 'pwa-icons/windows11/Square150x150Logo.scale-200.png',
            sizes: '300x300',
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
            src: 'pwa-icons/windows11/LargeTile.scale-200.png',
            sizes: '620x620',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icons/windows11/Square44x44Logo.targetsize-256.png',
            sizes: '256x256',
            type: 'image/png',
            purpose: 'any'
          },
          
          // Fallback Icons
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          },
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
