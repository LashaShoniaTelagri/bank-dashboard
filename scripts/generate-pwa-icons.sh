#!/bin/bash

# TelAgri PWA Icon Generator
# This script generates PWA icons from the SVG source

echo "🌾 Generating TelAgri PWA Icons..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found. Please install it first:"
    echo "   macOS: brew install imagemagick"
    echo "   Ubuntu: sudo apt-get install imagemagick"
    echo "   Or use online SVG to PNG converters:"
    echo "   - https://convertio.co/svg-png/"
    echo "   - https://cloudconvert.com/svg-to-png"
    echo ""
    echo "📋 Required icons to generate from public/masked-icon.svg:"
    echo "   - pwa-192x192.png (192x192px)"
    echo "   - pwa-512x512.png (512x512px)" 
    echo "   - apple-touch-icon.png (180x180px)"
    echo ""
    exit 1
fi

# Create icons directory if it doesn't exist
mkdir -p public/

# Generate PWA icons from SVG
echo "🔄 Converting SVG to PNG icons..."

# 192x192 PWA icon
convert public/masked-icon.svg -resize 192x192 public/pwa-192x192.png
echo "✅ Generated pwa-192x192.png"

# 512x512 PWA icon  
convert public/masked-icon.svg -resize 512x512 public/pwa-512x512.png
echo "✅ Generated pwa-512x512.png"

# 180x180 Apple Touch Icon
convert public/masked-icon.svg -resize 180x180 public/apple-touch-icon.png
echo "✅ Generated apple-touch-icon.png"

echo ""
echo "🎉 All PWA icons generated successfully!"
echo "📱 Your TelAgri app is now ready for installation on mobile devices."
echo ""
echo "🔍 Generated files:"
echo "   - public/pwa-192x192.png"
echo "   - public/pwa-512x512.png"
echo "   - public/apple-touch-icon.png"
echo "   - public/masked-icon.svg" 