#!/bin/bash

# TelAgri PWA Requirements Checker
# This script helps diagnose PWA installation issues

echo "🔍 Checking PWA Requirements for TelAgri Bank Dashboard"
echo "=========================================================="
echo ""

# Check if manifest exists
echo "1️⃣ Checking manifest.webmanifest..."
if [ -f "dist/manifest.webmanifest" ]; then
    echo "✅ Manifest found"
    echo "   Content preview:"
    head -n 5 dist/manifest.webmanifest
else
    echo "❌ Manifest NOT found in dist/"
    echo "   Run 'npm run build' first"
fi
echo ""

# Check if service worker exists
echo "2️⃣ Checking service worker (sw.js)..."
if [ -f "dist/sw.js" ]; then
    echo "✅ Service Worker found"
    echo "   Size: $(wc -c < dist/sw.js) bytes"
else
    echo "❌ Service Worker NOT found in dist/"
    echo "   Run 'npm run build' first"
fi
echo ""

# Check for required icons
echo "3️⃣ Checking PWA icons..."
ICON_COUNT=$(find public/pwa-icons -name "*.png" 2>/dev/null | wc -l)
if [ "$ICON_COUNT" -gt 0 ]; then
    echo "✅ Found $ICON_COUNT PWA icons"
else
    echo "❌ No PWA icons found in public/pwa-icons/"
fi
echo ""

# Check if HTTPS is being used (required for PWA)
echo "4️⃣ PWA Installation Requirements:"
echo "   ✅ App must be served over HTTPS (or localhost)"
echo "   ✅ Manifest must include name, icons, start_url"
echo "   ✅ Service worker must be registered"
echo "   ✅ Icons must be at least 192x192 and 512x512"
echo ""

# Chrome/Edge specific requirements
echo "5️⃣ Chrome/Edge Requirements:"
echo "   • User must visit at least twice, with 5 minutes between visits"
echo "   • User must have engaged with the domain"
echo "   • beforeinstallprompt event will fire when eligible"
echo ""

# Testing instructions
echo "🧪 Testing Instructions:"
echo "=========================================================="
echo "1. Build the app: npm run build"
echo "2. Preview locally: npm run preview"
echo "3. Open Chrome DevTools → Application → Manifest"
echo "4. Check 'Service Workers' and 'Storage' sections"
echo "5. Look for console logs: '🔍 PWA Install Prompt initialized'"
echo ""

echo "📝 Common Issues:"
echo "=========================================================="
echo "• App already installed → Uninstall and clear cache"
echo "• Dismissed permanently → Clear localStorage"
echo "• Wrong domain → Check manifest start_url matches"
echo "• Not HTTPS → Use localhost or deploy to HTTPS"
echo ""

echo "🔧 Debug Commands:"
echo "=========================================================="
echo "  Clear PWA dismissal:     localStorage.removeItem('pwa-permanently-dismissed')"
echo "  Check if installed:      window.matchMedia('(display-mode: standalone)').matches"
echo "  Force show iOS prompt:   (Only works on iOS Safari)"
echo ""

